"""Phase 4 adjacency-graph query command tests (PLAN-topology-phase4.md §7, §4)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.websocket_api import async_register_websocket_api
from homeassistant.helpers import area_registry as ar

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant


async def _query(client: Any, payload: dict[str, Any]) -> dict[str, Any]:
    await client.send_json_auto_id(payload)
    return await client.receive_json()


async def test_ws_neighbors(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """neighbors returns adjacent areas with edge/axis/perimeter/traversable (§4.1)."""
    load_payload(setup_integration, store_payload_full)
    client = await hass_ws_client(hass)
    response = await _query(client, {"type": "topology/neighbors", "area_id": "flur"})
    assert response["success"]
    neighbors = {n["area_id"]: n for n in response["result"]["neighbors"]}
    assert set(neighbors) == {"wohnzimmer", "kueche"}
    assert neighbors["wohnzimmer"]["edge_id"] == "flur::wohnzimmer"
    assert neighbors["wohnzimmer"]["traversable"] is True


async def test_ws_neighbors_unknown_area(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """An unknown area_id fails with area_not_found (§4.1)."""
    client = await hass_ws_client(hass)
    response = await _query(client, {"type": "topology/neighbors", "area_id": "nope"})
    assert not response["success"]
    assert response["error"]["code"] == "area_not_found"


async def test_ws_path_found(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """path returns the shortest hop path across the §2.5 flat (§4.2)."""
    load_payload(setup_integration, store_payload_full)
    client = await hass_ws_client(hass)
    response = await _query(client, {"type": "topology/path", "from": "wohnzimmer", "to": "kueche"})
    assert response["success"]
    result = response["result"]
    assert result["path"][0] == "wohnzimmer"
    assert result["path"][-1] == "kueche"
    assert result["hops"] == len(result["path"]) - 1


async def test_ws_path_none_and_self(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Disconnected areas give path null/hops -1; a self path is zero hops (§4.2)."""
    client = await hass_ws_client(hass)
    disconnected = await _query(client, {"type": "topology/path", "from": "flur", "to": "kueche"})
    assert disconnected["result"]["path"] is None
    assert disconnected["result"]["hops"] == -1

    self_path = await _query(client, {"type": "topology/path", "from": "flur", "to": "flur"})
    assert self_path["result"]["path"] == ["flur"]
    assert self_path["result"]["hops"] == 0


async def test_ws_path_traversable_only(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """A solid-only edge is walked normally but skipped when traversable_only (§4.2, D13/D14)."""
    store = setup_integration.runtime_data.store
    await store.async_upsert_edge("flur", "wohnzimmer", [{"passage": "none", "barrier": "solid"}])
    setup_integration.runtime_data.coordinator.async_publish(store.snapshot(), "edge", ["flur::wohnzimmer"])
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    walked = await _query(client, {"type": "topology/path", "from": "flur", "to": "wohnzimmer"})
    assert walked["result"]["path"] == ["flur", "wohnzimmer"]

    strict = await _query(
        client, {"type": "topology/path", "from": "flur", "to": "wohnzimmer", "traversable_only": True}
    )
    assert strict["result"]["path"] is None


async def test_ws_connections_facing_outdoor(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Only proven open-air openings are returned, with passage+barrier (§4.3, D15)."""
    load_payload(setup_integration, store_payload_full)
    client = await hass_ws_client(hass)
    response = await _query(client, {"type": "topology/connections_facing_outdoor"})
    assert response["success"]
    connections = response["result"]["connections"]
    areas = {c["area_id"] for c in connections}
    # wohnzimmer + kueche windows sit on beyond: outdoor sides; flur's door is on
    # a neighbor side and is excluded.
    assert areas == {"wohnzimmer", "kueche"}
    assert all("passage" in c and "barrier" in c for c in connections)
    assert "flur" not in areas


async def test_ws_connections_facing_outdoor_edge(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """An interior edge onto a modelled outdoor area is returned (§4.3, D15)."""
    garten = area_registry.async_create("Garten")
    store = setup_integration.runtime_data.store
    await store.async_update_area(garten.id, {"environment": "outdoor"})
    await store.async_upsert_edge("flur", garten.id, [{"passage": "level", "barrier": "door", "glazed": True}])
    setup_integration.runtime_data.coordinator.async_publish(store.snapshot(), "edge", ["updated"])
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    response = await _query(client, {"type": "topology/connections_facing_outdoor"})
    edge_entries = [c for c in response["result"]["connections"] if c["source"] == "edge"]
    assert len(edge_entries) == 1
    assert edge_entries[0]["barrier"] == "door"
    assert edge_entries[0]["passage"] == "level"


async def test_ws_query_not_loaded(
    hass: HomeAssistant,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """All three query commands fail with not_loaded before setup (§4)."""
    async_register_websocket_api(hass)
    client = await hass_ws_client(hass)
    for payload in (
        {"type": "topology/neighbors", "area_id": "flur"},
        {"type": "topology/path", "from": "a", "to": "b"},
        {"type": "topology/connections_facing_outdoor"},
    ):
        response = await _query(client, payload)
        assert not response["success"]
        assert response["error"]["code"] == "not_loaded"


async def test_ws_query_excludes_orphans(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: WebSocketGenerator,
) -> None:
    """Orphaned edges drop out of neighbours (§4, D12)."""
    load_payload(setup_integration, store_payload_full)
    area_registry.async_delete("kueche")
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    response = await _query(client, {"type": "topology/neighbors", "area_id": "flur"})
    neighbors = {n["area_id"] for n in response["result"]["neighbors"]}
    assert "kueche" not in neighbors
    assert "wohnzimmer" in neighbors
