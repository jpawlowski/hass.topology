"""Tests for the six response-returning read service actions.

These actions are the only way a template, script, or blueprint can reach the
adjacency graph, a connection's cardinal ``side``/``glazed`` detail, the full
perimeter set, and the health lists — none of which is an entity attribute by
design. What matters here is therefore not only that each returns *something*,
but that it returns the *same* thing as the WebSocket command it mirrors, that a
read is not admin-gated, and that nothing is written.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest

from custom_components.topology.const import (
    DOMAIN,
    EVENT_TOPOLOGY_UPDATED,
    SERVICE_GET_CONNECTIONS_FACING_OUTDOOR,
    SERVICE_GET_HEALTH,
    SERVICE_GET_MODEL,
    SERVICE_GET_NEIGHBORS,
    SERVICE_GET_PATH,
    SERVICE_GET_PERIMETER,
)
from custom_components.topology.websocket_api import async_register_websocket_api
from homeassistant.core import Context, SupportsResponse
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError
from homeassistant.setup import async_setup_component

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry, MockUser
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant

_READ_SERVICES = (
    SERVICE_GET_NEIGHBORS,
    SERVICE_GET_PATH,
    SERVICE_GET_PERIMETER,
    SERVICE_GET_CONNECTIONS_FACING_OUTDOOR,
    SERVICE_GET_HEALTH,
    SERVICE_GET_MODEL,
)

_TOPOLOGY_DIR = Path(__file__).parent.parent / "custom_components" / "topology"


async def _read(hass: HomeAssistant, service: str, data: dict[str, Any] | None = None, **kwargs: Any) -> Any:
    """Call a read action and return its response payload."""
    return await hass.services.async_call(
        DOMAIN,
        service,
        data or {},
        blocking=True,
        return_response=True,
        **kwargs,
    )


# --- registration ----------------------------------------------------------


async def test_read_services_registered_response_only(hass: HomeAssistant) -> None:
    """All six exist after async_setup and declare ONLY (action-setup)."""
    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    for service in _READ_SERVICES:
        assert hass.services.has_service(DOMAIN, service), service
        registered = hass.services.async_services_for_domain(DOMAIN)[service]
        assert registered.supports_response is SupportsResponse.ONLY, service


async def test_read_services_documented(hass: HomeAssistant) -> None:
    """Every read action has a services.yaml key and a translated name/description.

    ``docs-actions`` is a real Platinum row, and hassfest only checks the pairing
    for keys that exist in both files — a service registered in code but missing
    from services.yaml simply renders nameless in the UI.
    """
    import yaml  # noqa: PLC0415

    services_yaml = yaml.safe_load((_TOPOLOGY_DIR / "services.yaml").read_text(encoding="utf-8"))
    translations = json.loads((_TOPOLOGY_DIR / "translations" / "en.json").read_text(encoding="utf-8"))
    for service in _READ_SERVICES:
        assert service in services_yaml, service
        block = translations["services"][service]
        assert block["name"]
        assert block["description"]


async def test_read_services_are_not_admin_gated(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    hass_read_only_user: MockUser,
) -> None:
    """A non-admin context may read; the write actions stay admin-only.

    A read behind ``Unauthorized`` would put the graph out of reach of the
    automations these actions exist for.
    """
    response = await _read(
        hass,
        SERVICE_GET_HEALTH,
        context=Context(user_id=hass_read_only_user.id),
    )
    assert response["status"] in {"ok", "warning"}


# --- payload parity with the WebSocket transport ---------------------------


async def test_neighbors_matches_websocket(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """get_neighbors returns byte-identical data to topology/neighbors."""
    load_payload(setup_integration, store_payload_full)
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/neighbors", "area_id": "flur"})
    ws_response = await client.receive_json()

    service_response = await _read(hass, SERVICE_GET_NEIGHBORS, {"area_id": "flur"})
    assert service_response == ws_response["result"]
    assert {n["area_id"] for n in service_response["neighbors"]} == {"wohnzimmer", "kueche"}


async def test_path_renames_only_the_endpoint_keys(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """get_path == topology/path apart from from/to -> from_area/to_area.

    The rename is deliberate (``from`` is a Jinja keyword, so ``result.from``
    will not parse in the very templates this action serves). Everything else
    must stay identical, and ``from``/``to`` must not survive into the response —
    a caller that finds both would have no idea which one is authoritative.
    """
    load_payload(setup_integration, store_payload_full)
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/path", "from": "kueche", "to": "flur"})
    ws_result = (await client.receive_json())["result"]

    response = await _read(hass, SERVICE_GET_PATH, {"from_area": "kueche", "to_area": "flur"})
    assert "from" not in response
    assert "to" not in response
    assert response["from_area"] == ws_result["from"]
    assert response["to_area"] == ws_result["to"]
    for key in ("path", "hops", "distance"):
        assert response[key] == ws_result[key], key


async def test_path_template_usable(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Every response key is reachable with Jinja dot access.

    This is the whole reason ``from_area`` exists; asserting it keeps someone
    from "fixing" the key back to the WebSocket spelling.
    """
    from homeassistant.helpers.template import Template  # noqa: PLC0415

    load_payload(setup_integration, store_payload_full)
    response = await _read(hass, SERVICE_GET_PATH, {"from_area": "kueche", "to_area": "flur"})
    assert response is not None
    for key in response:
        rendered = Template("{{ result." + key + " }}", hass).async_render({"result": response}, parse_result=False)
        assert rendered != ""


async def test_path_traversable_only(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """traversable_only reaches the traversal (default False keeps walls usable)."""
    payload = json.loads(json.dumps(store_payload_full))
    payload["edges"]["flur::kueche"]["connections"] = [{"passage": "none", "barrier": "solid"}]
    del payload["edges"]["kueche::wohnzimmer"]
    load_payload(setup_integration, payload)

    lenient = await _read(hass, SERVICE_GET_PATH, {"from_area": "kueche", "to_area": "flur"})
    strict = await _read(
        hass,
        SERVICE_GET_PATH,
        {"from_area": "kueche", "to_area": "flur", "traversable_only": True},
    )
    assert lenient["path"] == ["kueche", "flur"]
    assert strict["path"] is None
    assert strict["hops"] == -1
    assert strict["distance"] is None


async def test_health_matches_websocket(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """get_health returns exactly the topology/health payload (R6)."""
    load_payload(setup_integration, store_payload_full)
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/health"})
    ws_result = (await client.receive_json())["result"]

    assert await _read(hass, SERVICE_GET_HEALTH) == ws_result


async def test_model_matches_read_hook(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """get_model returns exactly the read_hook payload (R3/R7/R8 escape hatch)."""
    load_payload(setup_integration, store_payload_full)
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/read_hook"})
    ws_result = (await client.receive_json())["result"]

    response = await _read(hass, SERVICE_GET_MODEL)
    assert response == ws_result
    # The three things only this action reaches.
    flur = next(area for area in response["areas"] if area["area_id"] == "flur")
    assert flur["beyond"] == {"N": "neighbor"}
    assert flur["trust"] == "private"
    assert response["edges"][0]["connections"][0]["passage"]


# --- the data that used to be unreachable ----------------------------------


async def test_perimeter_exposes_the_full_set(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """get_perimeter returns every perimeter connection, open or not (R5)."""
    load_payload(setup_integration, store_payload_full)
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/read_hook"})
    ws_perimeter = (await client.receive_json())["result"]["perimeter"]

    response = await _read(hass, SERVICE_GET_PERIMETER)
    assert response["connections"] == ws_perimeter
    assert response["count"] == len(ws_perimeter)
    assert response["monitored_count"] == sum(1 for c in ws_perimeter if c["sensor_entity_id"] is not None)
    # The unmonitored remainder is the point of the two counts.
    assert response["count"] > response["monitored_count"]


async def test_connections_facing_outdoor_filters(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """side + glazed_only reach the cardinal/glazed detail no entity carries (R1/R2)."""
    load_payload(setup_integration, store_payload_full)

    unfiltered = await _read(hass, SERVICE_GET_CONNECTIONS_FACING_OUTDOOR)
    assert unfiltered["count"] == len(unfiltered["connections"])
    assert {c["side"] for c in unfiltered["connections"]} == {"S"}

    south_glazed = await _read(
        hass,
        SERVICE_GET_CONNECTIONS_FACING_OUTDOOR,
        {"side": ["S"], "glazed_only": True},
    )
    assert south_glazed["area_ids"] == ["kueche", "wohnzimmer"]
    assert all(c["glazed"] for c in south_glazed["connections"])
    # R3: passage/barrier travel with each entry.
    assert all(c["passage"] and c["barrier"] for c in south_glazed["connections"])

    west = await _read(hass, SERVICE_GET_CONNECTIONS_FACING_OUTDOOR, {"side": ["W"]})
    assert west["connections"] == []
    assert west["area_ids"] == []


# --- failure modes ---------------------------------------------------------


async def test_unknown_area_raises_translated_error(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """An unknown area id fails with the translated area_not_found (§3)."""
    with pytest.raises(ServiceValidationError) as err:
        await _read(hass, SERVICE_GET_NEIGHBORS, {"area_id": "nope"})
    assert err.value.translation_key == "area_not_found"

    with pytest.raises(ServiceValidationError):
        await _read(hass, SERVICE_GET_PATH, {"from_area": "flur", "to_area": "nope"})


async def test_reads_fail_when_not_loaded(hass: HomeAssistant) -> None:
    """Without a loaded entry every read raises the translated not_loaded (§3)."""
    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    for service in _READ_SERVICES:
        data = {"area_id": "x"} if service == SERVICE_GET_NEIGHBORS else {}
        if service == SERVICE_GET_PATH:
            data = {"from_area": "x", "to_area": "y"}
        with pytest.raises(HomeAssistantError) as err:
            await _read(hass, service, data)
        assert err.value.translation_key == "not_loaded", service


async def test_reads_write_nothing(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """No read publishes an update or mutates the store."""
    load_payload(setup_integration, store_payload_full)
    events: list[Any] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, events.append)
    before = json.dumps(setup_integration.runtime_data.store.data, sort_keys=True)

    await _read(hass, SERVICE_GET_NEIGHBORS, {"area_id": "flur"})
    await _read(hass, SERVICE_GET_PATH, {"from_area": "flur", "to_area": "kueche"})
    await _read(hass, SERVICE_GET_PERIMETER)
    await _read(hass, SERVICE_GET_CONNECTIONS_FACING_OUTDOOR)
    await _read(hass, SERVICE_GET_HEALTH)
    await _read(hass, SERVICE_GET_MODEL)
    await hass.async_block_till_done()

    assert events == []
    assert json.dumps(setup_integration.runtime_data.store.data, sort_keys=True) == before
