"""Error paths of the WebSocket contract (§4 error codes).

The happy paths live in ``test_websocket.py``; this module covers the branches a
consumer only meets when something is wrong — every command's ``not_loaded``
guard, the existence checks, the enum and connection validators, and the
``store_error`` wrapper. Those are the responses an external consumer (Residents,
a template, the panel's error toast) actually has to code against, so they are
part of the contract rather than incidental.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any
from unittest.mock import patch

import pytest

from custom_components.topology.store import TopologyStore
from custom_components.topology.websocket_api import async_register_websocket_api
from homeassistant.exceptions import HomeAssistantError

if TYPE_CHECKING:
    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers import area_registry as ar

_DOOR = {"passage": "level", "barrier": "door"}

# One representative payload per command, so the ``not_loaded`` sweep can be a
# single parametrization instead of fifteen near-identical tests. Payloads only
# have to pass the voluptuous schema — the guard runs before anything else.
_ALL_COMMANDS: list[dict[str, Any]] = [
    {"type": "topology/list_annotations"},
    {"type": "topology/read_hook"},
    {"type": "topology/health"},
    {"type": "topology/subscribe_updates"},
    {"type": "topology/neighbors", "area_id": "flur"},
    {"type": "topology/path", "from": "flur", "to": "kueche"},
    {"type": "topology/connections_facing_outdoor"},
    {"type": "topology/update_area", "area_id": "flur", "annotation": {"type": "hallway"}},
    {"type": "topology/upsert_edge", "area_a": "flur", "area_b": "kueche", "connections": [_DOOR]},
    {"type": "topology/delete_edge", "edge_id": "flur::kueche"},
    {"type": "topology/restore_edge", "edge_id": "flur::kueche"},
    {"type": "topology/set_beyond", "area_id": "flur", "side": "N", "beyond": "outdoor"},
    {"type": "topology/set_exterior_connections", "area_id": "flur", "connections": []},
    {"type": "topology/set_floor_level", "floor_id": "ground", "level": 0},
    {"type": "topology/update_home_config", "occupancy_extent": "whole_property"},
]


async def _send(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    return await client.receive_json()


async def _error(client: Any, payload: dict[str, Any]) -> str:
    response = await _send(client, payload)
    assert not response["success"], payload["type"]
    return response["error"]["code"]


@pytest.mark.parametrize("payload", _ALL_COMMANDS, ids=lambda payload: payload["type"].split("/")[1])
async def test_every_command_guards_not_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    payload: dict[str, Any],
) -> None:
    """No command may touch runtime data before an entry is loaded.

    The commands are registered once in ``async_setup``, so they answer as soon
    as the integration is imported — long before there is a store to read.
    """
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    assert await _error(client, payload) == "not_loaded"


# --- existence checks ------------------------------------------------------


@pytest.mark.usefixtures("setup_integration", "area_registry")
async def test_unknown_ids_are_reported_by_kind(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Each registry lookup has its own error code, not one generic failure."""
    client = await hass_ws_client(hass)
    assert await _error(client, {"type": "topology/neighbors", "area_id": "nope"}) == "area_not_found"
    assert await _error(client, {"type": "topology/path", "from": "flur", "to": "nope"}) == "area_not_found"
    assert (
        await _error(client, {"type": "topology/update_area", "area_id": "nope", "annotation": {}}) == "area_not_found"
    )
    assert (
        await _error(client, {"type": "topology/set_beyond", "area_id": "nope", "side": "N", "beyond": None})
        == "area_not_found"
    )
    assert (
        await _error(client, {"type": "topology/set_exterior_connections", "area_id": "nope", "connections": []})
        == "area_not_found"
    )
    assert (
        await _error(
            client,
            {"type": "topology/upsert_edge", "area_a": "flur", "area_b": "nope", "connections": [_DOOR]},
        )
        == "area_not_found"
    )
    assert await _error(client, {"type": "topology/delete_edge", "edge_id": "a::b"}) == "edge_not_found"
    assert await _error(client, {"type": "topology/restore_edge", "edge_id": "a::b"}) == "edge_not_found"
    assert (
        await _error(client, {"type": "topology/set_floor_level", "floor_id": "nope", "level": 0}) == "floor_not_found"
    )


@pytest.mark.usefixtures("area_registry")
async def test_restore_edge_refuses_while_an_area_is_still_missing(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Re-adopting an edge whose area never came back would recreate a dangler."""
    store = setup_integration.runtime_data.store
    _snapshot, edge_id = await store.async_upsert_edge("flur", "kueche", [_DOOR])
    store.data["edges"][edge_id]["area_a"] = "gone"
    store.data["edges"][edge_id]["orphaned_at"] = "2026-01-01T00:00:00+00:00"

    client = await hass_ws_client(hass)
    assert await _error(client, {"type": "topology/restore_edge", "edge_id": edge_id}) == "area_not_found"


# --- validators ------------------------------------------------------------


@pytest.mark.usefixtures("setup_integration", "area_registry")
@pytest.mark.parametrize(
    ("connection", "expected"),
    [
        ({"passage": "teleport", "barrier": "door"}, "invalid_enum"),
        ({"passage": "level", "barrier": "forcefield"}, "invalid_enum"),
        ({"passage": "level", "barrier": "door", "side": "NW"}, "invalid_enum"),
        # A sensor only makes sense on something that opens and closes.
        ({"passage": "level", "barrier": "open", "sensor_entity_id": "binary_sensor.x"}, "invalid_connection"),
        ({"passage": "level", "barrier": "door", "sensor_entity_id": "sensor.x"}, "invalid_connection"),
        # inline_trust is an exterior-only concept.
        ({"passage": "level", "barrier": "door", "inline_trust": "shared"}, "invalid_connection"),
    ],
    ids=["passage", "barrier", "side", "sensor-needs-door", "sensor-shape", "inline-trust-interior"],
)
async def test_interior_connection_validation(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    connection: dict[str, Any],
    expected: str,
) -> None:
    """Each rule in the connection validator has its own error code."""
    client = await hass_ws_client(hass)
    payload = {
        "type": "topology/upsert_edge",
        "area_a": "flur",
        "area_b": "kueche",
        "connections": [connection],
    }
    assert await _error(client, payload) == expected


@pytest.mark.usefixtures("setup_integration", "area_registry")
async def test_exterior_allows_inline_trust_but_still_validates_it(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """``inline_trust`` is legal here — but only with a value from the catalog."""
    client = await hass_ws_client(hass)
    payload = {
        "type": "topology/set_exterior_connections",
        "area_id": "flur",
        "connections": [{**_DOOR, "inline_trust": "confidential"}],
    }
    assert await _error(client, payload) == "invalid_enum"

    payload["connections"] = [{**_DOOR, "inline_trust": "shared"}]
    assert (await _send(client, payload))["success"]


@pytest.mark.usefixtures("setup_integration", "area_registry")
@pytest.mark.parametrize(
    "payload",
    [
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"environment": "underwater"}},
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"trust": "confidential"}},
        {"type": "topology/set_beyond", "area_id": "flur", "side": "N", "beyond": "lava"},
        {"type": "topology/update_home_config", "occupancy_extent": "treehouse"},
    ],
    ids=["environment", "trust", "beyond", "occupancy_extent"],
)
async def test_closed_enums_are_rejected(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
    payload: dict[str, Any],
) -> None:
    """A value outside a closed catalog fails as invalid_enum, not invalid_format."""
    client = await hass_ws_client(hass)
    assert await _error(client, payload) == "invalid_enum"


@pytest.mark.usefixtures("setup_integration", "area_registry")
async def test_open_type_catalog_accepts_anything(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """``type`` is an open catalog, so a user's own value is not an error (§2.4)."""
    client = await hass_ws_client(hass)
    response = await _send(
        client,
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"type": "sauna"}},
    )
    assert response["success"]
    assert response["result"]["type"] == "sauna"


# --- store failures --------------------------------------------------------


@pytest.mark.usefixtures("area_registry")
@pytest.mark.parametrize(
    ("method", "payload"),
    [
        ("async_update_area", {"type": "topology/update_area", "area_id": "flur", "annotation": {}}),
        (
            "async_upsert_edge",
            {"type": "topology/upsert_edge", "area_a": "flur", "area_b": "kueche", "connections": [_DOOR]},
        ),
        (
            "async_set_beyond",
            {"type": "topology/set_beyond", "area_id": "flur", "side": "N", "beyond": "outdoor"},
        ),
        (
            "async_set_exterior_connections",
            {"type": "topology/set_exterior_connections", "area_id": "flur", "connections": []},
        ),
        ("async_update_home_config", {"type": "topology/update_home_config", "occupancy_extent": "whole_property"}),
    ],
    ids=["update_area", "upsert_edge", "set_beyond", "set_exterior", "home_config"],
)
async def test_store_failures_surface_as_store_error(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
    method: str,
    payload: dict[str, Any],
) -> None:
    """A failed write is reported, never swallowed into a success response."""
    client = await hass_ws_client(hass)
    with patch.object(TopologyStore, method, side_effect=HomeAssistantError("disk on fire")):
        response = await _send(client, payload)
    assert not response["success"]
    assert response["error"]["code"] == "store_error"
    assert "disk on fire" in response["error"]["message"]


@pytest.mark.usefixtures("area_registry")
async def test_store_failure_on_delete_and_restore(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The two edge-lifecycle commands wrap store errors the same way."""
    store = setup_integration.runtime_data.store
    _snapshot, edge_id = await store.async_upsert_edge("flur", "kueche", [_DOOR])
    client = await hass_ws_client(hass)

    with patch.object(TopologyStore, "async_delete_edge", side_effect=HomeAssistantError("nope")):
        assert await _error(client, {"type": "topology/delete_edge", "edge_id": edge_id}) == "store_error"
    with patch.object(TopologyStore, "async_restore_edge", side_effect=HomeAssistantError("nope")):
        assert await _error(client, {"type": "topology/restore_edge", "edge_id": edge_id}) == "store_error"


@pytest.mark.usefixtures("area_registry", "floor_registry")
async def test_store_failure_on_floor_level(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
    floor_registry: ar.AreaRegistry,
) -> None:
    """``set_floor_level`` wraps a store error rather than half-applying it."""
    floor_id = next(iter(floor_registry.async_list_floors())).floor_id
    client = await hass_ws_client(hass)
    with patch.object(TopologyStore, "async_set_floor_level", side_effect=HomeAssistantError("nope")):
        payload = {"type": "topology/set_floor_level", "floor_id": floor_id, "level": 1}
        assert await _error(client, payload) == "store_error"
