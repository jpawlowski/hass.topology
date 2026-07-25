"""WebSocket command tests (PLAN-topology-phase2.md §7, §4)."""

from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

from custom_components.topology.const import EVENT_TOPOLOGY_UPDATED
from custom_components.topology.websocket_api import async_register_websocket_api
from homeassistant.helpers import area_registry as ar, floor_registry as fr

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant

_DOOR = {"passage": "level", "barrier": "door"}


async def test_ws_not_loaded(hass: HomeAssistant, hass_ws_client: WebSocketGenerator) -> None:
    """Any command before setup returns not_loaded."""
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/list_annotations"})
    response = await client.receive_json()
    assert not response["success"]
    assert response["error"]["code"] == "not_loaded"


async def test_ws_list_annotations_snapshot(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The snapshot lists every registry area, edges, presets, and home_config."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/list_annotations"})
    response = await client.receive_json()
    assert response["success"]
    result = response["result"]
    area_ids = {area["area_id"] for area in result["areas"]}
    assert {"flur", "wohnzimmer", "kueche"} <= area_ids
    assert len(result["presets"]) == 11
    assert result["home_config"]["occupancy_extent"] == "whole_property"
    # The type catalog + cascade ship with the snapshot so the panel holds no
    # second copy of either (the preset table's rule, applied to types).
    assert "bedroom" in result["area_types"]["catalog"]
    assert result["area_types"]["cascade"]["bedroom"] == {"environment": "indoor", "trust": "private"}
    assert result["area_types"]["cascade"]["terrace"]["trust"] is None


async def test_ws_update_area_success(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """update_area persists, echoes area_out, and fires topology_updated."""
    events: list[dict[str, Any]] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, lambda event: events.append(event.data))

    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"type": "hallway", "trust": "shared"}}
    )
    response = await client.receive_json()
    assert response["success"]
    assert response["result"]["type"] == "hallway"
    assert response["result"]["trust"] == "shared"
    await hass.async_block_till_done()
    assert {"change": "area", "ids": ["flur"]} in events


async def test_ws_update_area_partial_and_clear(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Omitted keys are untouched; explicit null clears a field."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"type": "hallway", "environment": "indoor"}}
    )
    await client.receive_json()
    await client.send_json_auto_id(
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"environment": None}}
    )
    response = await client.receive_json()
    assert response["success"]
    assert response["result"]["type"] == "hallway"  # untouched
    assert response["result"]["environment"] is None  # cleared


async def test_ws_update_area_unknown_area(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """An unknown area_id returns area_not_found."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/update_area", "area_id": "nope", "annotation": {"type": "kitchen"}}
    )
    response = await client.receive_json()
    assert response["error"]["code"] == "area_not_found"


async def test_ws_update_area_invalid_enum(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """A bad enum value returns invalid_enum (vol passes the string)."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"environment": "wet"}}
    )
    response = await client.receive_json()
    assert response["error"]["code"] == "invalid_enum"


async def test_ws_write_denied_non_admin(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
    hass_read_only_access_token: str,
) -> None:
    """A write command is unauthorized for a non-admin user."""
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id(
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"type": "hallway"}}
    )
    response = await client.receive_json()
    assert response["error"]["code"] == "unauthorized"


async def test_ws_payload_validation(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """A missing required field returns invalid_format from the WS layer."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/update_area", "area_id": "flur"})
    response = await client.receive_json()
    assert response["error"]["code"] == "invalid_format"


async def test_ws_upsert_edge_create_and_replace(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The first call creates a deterministic edge; the second replaces its bundle."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/upsert_edge", "area_a": "flur", "area_b": "kueche", "connections": [_DOOR]}
    )
    first = await client.receive_json()
    assert first["success"]
    assert first["result"]["edge_id"] == "flur::kueche"
    assert len(first["result"]["connections"]) == 1

    await client.send_json_auto_id(
        {
            "type": "topology/upsert_edge",
            "area_a": "flur",
            "area_b": "kueche",
            "connections": [_DOOR, {"passage": "level", "barrier": "open"}],
        }
    )
    second = await client.receive_json()
    assert second["success"]
    assert len(second["result"]["connections"]) == 2


async def test_ws_upsert_edge_empty_bundle_rejected(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """An empty connection bundle is rejected (§2.2/§4.3 minItems: 1)."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/upsert_edge", "area_a": "flur", "area_b": "kueche", "connections": []}
    )
    response = await client.receive_json()
    assert response["error"]["code"] == "invalid_format"
    assert not setup_integration.runtime_data.store.edge_exists("flur::kueche")


async def test_ws_upsert_edge_normalizes_pair(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """(b, a) and (a, b) hit the same edge_id."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/upsert_edge", "area_a": "kueche", "area_b": "flur", "connections": [_DOOR]}
    )
    response = await client.receive_json()
    assert response["result"]["edge_id"] == "flur::kueche"


async def test_ws_upsert_edge_same_area_rejected(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """area_a == area_b returns invalid_connection."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/upsert_edge", "area_a": "flur", "area_b": "flur", "connections": [_DOOR]}
    )
    response = await client.receive_json()
    assert response["error"]["code"] == "invalid_connection"


async def test_ws_upsert_edge_sensor_rules(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """A sensor on a non-door barrier or a non-binary_sensor id is rejected."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "topology/upsert_edge",
            "area_a": "flur",
            "area_b": "kueche",
            "connections": [{"passage": "level", "barrier": "open", "sensor_entity_id": "binary_sensor.x"}],
        }
    )
    assert (await client.receive_json())["error"]["code"] == "invalid_connection"

    await client.send_json_auto_id(
        {
            "type": "topology/upsert_edge",
            "area_a": "flur",
            "area_b": "kueche",
            "connections": [{"passage": "level", "barrier": "door", "sensor_entity_id": "sensor.not_binary"}],
        }
    )
    assert (await client.receive_json())["error"]["code"] == "invalid_connection"


async def test_ws_upsert_edge_inline_trust_interior_rejected(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """inline_trust on an interior edge connection is rejected."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "topology/upsert_edge",
            "area_a": "flur",
            "area_b": "kueche",
            "connections": [{"passage": "level", "barrier": "door", "inline_trust": "shared"}],
        }
    )
    response = await client.receive_json()
    assert response["error"]["code"] == "invalid_connection"


async def test_ws_delete_edge(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """delete_edge removes the edge; an unknown id returns edge_not_found."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/upsert_edge", "area_a": "flur", "area_b": "kueche", "connections": [_DOOR]}
    )
    await client.receive_json()
    await client.send_json_auto_id({"type": "topology/delete_edge", "edge_id": "flur::kueche"})
    response = await client.receive_json()
    assert response["success"]
    assert response["result"] == {"deleted": True}

    await client.send_json_auto_id({"type": "topology/delete_edge", "edge_id": "flur::kueche"})
    response = await client.receive_json()
    assert response["error"]["code"] == "edge_not_found"


async def test_ws_set_beyond_success_and_clear(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """set_beyond sets then clears a side."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "topology/set_beyond", "area_id": "flur", "side": "N", "beyond": "neighbor"}
    )
    response = await client.receive_json()
    assert response["success"]
    assert response["result"]["beyond"] == {"N": "neighbor"}

    await client.send_json_auto_id({"type": "topology/set_beyond", "area_id": "flur", "side": "N", "beyond": None})
    response = await client.receive_json()
    assert response["result"]["beyond"] == {}


async def test_ws_set_exterior_connections(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """set_exterior_connections replaces the list; inline_trust is accepted."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "topology/set_exterior_connections",
            "area_id": "flur",
            "connections": [{"passage": "level", "barrier": "door", "inline_trust": "shared"}],
        }
    )
    response = await client.receive_json()
    assert response["success"]
    assert len(response["result"]["exterior_connections"]) == 1

    await client.send_json_auto_id({"type": "topology/set_exterior_connections", "area_id": "flur", "connections": []})
    response = await client.receive_json()
    assert response["result"]["exterior_connections"] == []


async def test_ws_set_floor_level(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The override is stored, inert when the registry level is set; unknown id fails."""
    registry = fr.async_get(hass)
    no_level = registry.async_create("Attic")  # level None
    with_level = registry.async_create("Ground", level=0)

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/set_floor_level", "floor_id": no_level.floor_id, "level": 3})
    response = await client.receive_json()
    assert response["success"]
    assert response["result"]["effective_level"] == 3
    assert response["result"]["level_override"] == 3

    await client.send_json_auto_id({"type": "topology/set_floor_level", "floor_id": with_level.floor_id, "level": 9})
    response = await client.receive_json()
    assert response["result"]["effective_level"] == 0  # registry wins

    await client.send_json_auto_id({"type": "topology/set_floor_level", "floor_id": "ghost", "level": 1})
    response = await client.receive_json()
    assert response["error"]["code"] == "floor_not_found"


async def test_home_config_survives_reload(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
    persisted_store: None,
) -> None:
    """The regression this change exists for: a panel edit survives a reload.

    Setup no longer applies ``entry.data`` over the store, so a reload re-reads
    the store and leaves the panel's values alone (§2.5).
    """
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "topology/update_home_config",
            "occupancy_extent": "unit_within_building",
            "unannotated_repair_threshold": 9,
        }
    )
    response = await client.receive_json()
    assert response["success"]
    await setup_integration.runtime_data.store.async_save_now()

    await hass.config_entries.async_reload(setup_integration.entry_id)
    await hass.async_block_till_done()

    home = setup_integration.runtime_data.store.data["home_config"]
    assert home["occupancy_extent"] == "unit_within_building"
    assert home["unannotated_repair_threshold"] == 9


async def test_update_home_config_leaves_entry_data_empty(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The panel edit writes the store only — no mirror back into entry.data."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "topology/update_home_config",
            "occupancy_extent": "unit_within_building",
            "projection_toggles": {"environment": True},
            "unannotated_repair_threshold": 9,
        }
    )
    response = await client.receive_json()
    assert response["success"]
    assert setup_integration.data == {}
    # The response payload is unchanged: the frozen §4.9 contract still applies.
    assert response["result"]["occupancy_extent"] == "unit_within_building"
    assert response["result"]["unannotated_repair_threshold"] == 9


async def test_setup_does_not_write_home_config(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    persisted_store: None,
) -> None:
    """A setup over a populated store mutates no home_config field (§2.5)."""
    load_payload(setup_integration, store_payload_full)
    store = setup_integration.runtime_data.store
    await store.async_update_home_config(occupancy_extent="unit_within_building")
    await store.async_save_now()
    before = deepcopy(store.data["home_config"])

    with patch("custom_components.topology.store.TopologyStore.async_apply_home_config") as apply:
        await hass.config_entries.async_reload(setup_integration.entry_id)
        await hass.async_block_till_done()
        assert apply.call_count == 0

    assert setup_integration.runtime_data.store.data["home_config"] == before


async def test_ws_read_hook_envelope(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    floor_registry: fr.FloorRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """read_hook has api_version 1, merged floors, and null unannotated areas."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/read_hook"})
    response = await client.receive_json()
    assert response["success"]
    result = response["result"]
    assert result["api_version"] == 1
    assert result["home"]["floors"][0]["effective_level"] == 0
    flur = next(area for area in result["areas"] if area["area_id"] == "flur")
    assert flur["type"] is None
    assert flur["environment"] is None


async def test_ws_read_hook_perimeter_derivation(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The §2.5 payload yields the apartment door + both windows as perimeter."""
    load_payload(setup_integration, store_payload_full)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/read_hook"})
    response = await client.receive_json()
    perimeter = response["result"]["perimeter"]
    assert len(perimeter) == 3
    assert all(entry["source"] == "exterior" for entry in perimeter)
    owners = {entry["area_id"] for entry in perimeter}
    assert owners == {"flur", "wohnzimmer", "kueche"}


async def test_ws_read_hook_axis_derivation(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Axis is vertical across floors, horizontal on one floor, unknown otherwise."""
    area_reg = ar.async_get(hass)
    floor_reg = fr.async_get(hass)
    ground = floor_reg.async_create("Ground", level=0)
    upper = floor_reg.async_create("Upper", level=1)
    flur = area_reg.async_create("flur")
    wohn = area_reg.async_create("wohnzimmer")
    kueche = area_reg.async_create("kueche")
    solo = area_reg.async_create("solo")  # no floor
    area_reg.async_update(flur.id, floor_id=ground.floor_id)
    area_reg.async_update(wohn.id, floor_id=upper.floor_id)
    area_reg.async_update(kueche.id, floor_id=ground.floor_id)

    store = setup_integration.runtime_data.store
    await store.async_upsert_edge(flur.id, wohn.id, [_DOOR])  # vertical
    await store.async_upsert_edge(flur.id, kueche.id, [_DOOR])  # horizontal
    await store.async_upsert_edge(flur.id, solo.id, [_DOOR])  # unknown
    setup_integration.runtime_data.coordinator.async_seed(store.snapshot())

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/read_hook"})
    response = await client.receive_json()
    edges = {edge["edge_id"]: edge["axis"] for edge in response["result"]["edges"]}
    assert edges["::".join(sorted([flur.id, wohn.id]))] == "vertical"
    assert edges["::".join(sorted([flur.id, kueche.id]))] == "horizontal"
    assert edges["::".join(sorted([flur.id, solo.id]))] == "unknown"

    # level_delta carries the direction the axis cannot: signed area_a -> area_b.
    deltas = {edge["edge_id"]: edge["level_delta"] for edge in response["result"]["edges"]}
    vertical_id = "::".join(sorted([flur.id, wohn.id]))
    area_a = next(e["area_a"] for e in response["result"]["edges"] if e["edge_id"] == vertical_id)
    assert deltas[vertical_id] == (1 if area_a == flur.id else -1)
    assert deltas["::".join(sorted([flur.id, kueche.id]))] == 0
    assert deltas["::".join(sorted([flur.id, solo.id]))] is None


async def test_ws_floors_ordered_top_down(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Floors are served highest level first, unlevelled last, whatever the registry order.

    The registry lists floors in creation order, so a consumer that renders them
    as received would show a building upside down. Level 0 is an ordinary ground
    floor and negatives are basements — only the relative order is used.
    """
    floor_reg = fr.async_get(hass)
    # Deliberately created out of order, with a basement and an unlevelled floor.
    ground = floor_reg.async_create("Ground", level=0)
    attic = floor_reg.async_create("Attic", level=2)
    basement = floor_reg.async_create("Basement", level=-1)
    loft = floor_reg.async_create("Loft")  # no level at all
    upper = floor_reg.async_create("Upper", level=1)

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/list_annotations"})
    response = await client.receive_json()
    assert response["success"]
    order = [floor["floor_id"] for floor in response["result"]["floors"]]
    assert order == [
        attic.floor_id,
        upper.floor_id,
        ground.floor_id,
        basement.floor_id,
        loft.floor_id,
    ]


async def test_ws_upsert_edge_dedupes_identical_connections(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Identical bundle entries collapse; distinct ones are all kept.

    A bundle models the distinct ways across one boundary, so a repeated entry
    adds nothing and only shifts the ``connection_index`` that the perimeter list
    and the binary sensor address.
    """
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "topology/upsert_edge",
            "area_a": "flur",
            "area_b": "wohnzimmer",
            "connections": [_DOOR, dict(_DOOR), {"passage": "stairs", "barrier": "open"}],
        }
    )
    response = await client.receive_json()
    assert response["success"]
    connections = response["result"]["connections"]
    assert len(connections) == 2
    assert connections[0]["passage"] == "level"
    assert connections[1]["passage"] == "stairs"


async def test_ws_health_minimal(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The health-only response matches the frozen shape with empty Phase-4 lists."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/health"})
    response = await client.receive_json()
    assert response["success"]
    health = response["result"]
    assert set(health) == {
        "status",
        "area_count",
        "annotated_count",
        "unannotated_areas",
        "orphaned_edges",
        "orphaned_areas",
        "orphaned_floors",
        "unknown_enum_values",
        "isolated_areas",
        "indoor_areas_without_floor",
        "contradictory_bearings",
        "exterior_on_non_outdoor_side",
        # Edge-geometry advisories; these two hold edge_ids, not area_ids.
        "edges_spanning_multiple_floors",
        "vertical_edges_without_vertical_passage",
    }
    assert health["isolated_areas"] == []
    assert health["indoor_areas_without_floor"] == []
    assert health["edges_spanning_multiple_floors"] == []
    assert health["vertical_edges_without_vertical_passage"] == []


async def test_ws_subscribe_updates(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """A subscription receives change events; unsubscribing stops delivery."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/subscribe_updates"})
    subscribe = await client.receive_json()
    assert subscribe["success"]
    subscription_id = subscribe["id"]

    await client.send_json_auto_id(
        {"type": "topology/update_area", "area_id": "flur", "annotation": {"type": "hallway"}}
    )
    event = await client.receive_json()
    while event.get("type") != "event":
        event = await client.receive_json()
    assert event["event"] == {"change": "area", "ids": ["flur"]}

    await client.send_json_auto_id({"type": "unsubscribe_events", "subscription": subscription_id})
    await client.receive_json()
