"""Phase 4 graph-consistency check tests (PLAN-topology-phase4.md §7, §3)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.entity_utils.derivations import build_health, derive_consistency
from homeassistant.helpers import area_registry as ar, floor_registry as fr

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant


def _report(entry: MockConfigEntry, area_reg: ar.AreaRegistry) -> Any:
    return derive_consistency(entry.runtime_data.store.snapshot(), area_reg)


async def test_consistency_all_clear(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """The fully wired §2.5 home reports no consistency defects (§3)."""
    load_payload(setup_integration, store_payload_full)
    report = _report(setup_integration, area_registry)
    assert report.isolated_areas == ()
    assert report.indoor_areas_without_floor == ()
    assert report.contradictory_bearings == ()
    assert report.exterior_on_non_outdoor_side == ()


async def test_isolated_area_listed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A registry area with no interior edge is isolated (§3.1, D8)."""
    report = _report(setup_integration, area_registry)
    assert "flur" in report.isolated_areas


async def test_isolated_ignores_exterior_only(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """An area with only an exterior connection (no edge) is still isolated (§3.1, D8)."""
    await setup_integration.runtime_data.store.async_set_exterior_connections(
        "flur", [{"passage": "none", "barrier": "door", "side": "S", "glazed": True}]
    )
    report = _report(setup_integration, area_registry)
    assert "flur" in report.isolated_areas


async def test_indoor_without_floor_listed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    floor_registry: fr.FloorRegistry,
) -> None:
    """An indoor floorless area is flagged once the home uses floors (§3.2, D9)."""
    floor = next(iter(floor_registry.async_list_floors()))
    area_registry.async_update("flur", floor_id=floor.floor_id)  # home now uses floors
    await setup_integration.runtime_data.store.async_update_area("wohnzimmer", {"environment": "indoor"})
    report = _report(setup_integration, area_registry)
    assert "wohnzimmer" in report.indoor_areas_without_floor
    assert "flur" not in report.indoor_areas_without_floor


async def test_indoor_without_floor_null_env_skip(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    floor_registry: fr.FloorRegistry,
) -> None:
    """An area with unknown environment is not flagged as indoor-without-floor (§3.2)."""
    floor = next(iter(floor_registry.async_list_floors()))
    area_registry.async_update("flur", floor_id=floor.floor_id)
    report = _report(setup_integration, area_registry)  # wohnzimmer has no annotation
    assert "wohnzimmer" not in report.indoor_areas_without_floor


async def test_indoor_without_floor_skipped_without_floors(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A single-storey home that models no floors is never nagged (§3.2, D9)."""
    await setup_integration.runtime_data.store.async_update_area("flur", {"environment": "indoor"})
    report = _report(setup_integration, area_registry)
    assert report.indoor_areas_without_floor == ()


async def test_contradictory_bearing_same_side(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A side that is both interior-edge and beyond is contradictory (§3.3, D10)."""
    store = setup_integration.runtime_data.store
    await store.async_upsert_edge("flur", "wohnzimmer", [{"passage": "level", "barrier": "door", "side": "N"}])
    await store.async_set_beyond("flur", "N", "outdoor")
    report = _report(setup_integration, area_registry)
    assert "flur" in report.contradictory_bearings


async def test_exterior_on_non_outdoor_side_listed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A glazed exterior opening on an earth/neighbor side is flagged (§3.4, D11)."""
    store = setup_integration.runtime_data.store
    await store.async_set_beyond("flur", "N", "earth")
    await store.async_set_exterior_connections(
        "flur", [{"passage": "none", "barrier": "door", "side": "N", "glazed": True}]
    )
    report = _report(setup_integration, area_registry)
    assert "flur" in report.exterior_on_non_outdoor_side


async def test_exterior_neighbor_door_allowed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A non-glazed door on a neighbor side is legitimate (the §2.5 case, D11)."""
    store = setup_integration.runtime_data.store
    await store.async_set_beyond("flur", "N", "neighbor")
    await store.async_set_exterior_connections("flur", [{"passage": "level", "barrier": "door", "side": "N"}])
    report = _report(setup_integration, area_registry)
    assert "flur" not in report.exterior_on_non_outdoor_side


async def test_exterior_without_side_skipped(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A side-less exterior connection cannot be checked and is not flagged (§3.4)."""
    store = setup_integration.runtime_data.store
    await store.async_set_beyond("flur", "N", "earth")
    await store.async_set_exterior_connections("flur", [{"passage": "none", "barrier": "door", "glazed": True}])
    report = _report(setup_integration, area_registry)
    assert "flur" not in report.exterior_on_non_outdoor_side


async def test_health_lists_match_derived(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """topology/health lists equal the derived consistency report (§5.3)."""
    await setup_integration.runtime_data.store.async_set_exterior_connections(
        "flur", [{"passage": "none", "barrier": "door", "side": "S", "glazed": True}]
    )
    setup_integration.runtime_data.coordinator.async_publish(
        setup_integration.runtime_data.store.snapshot(), "exterior", ["flur"]
    )
    await hass.async_block_till_done()

    health = build_health(setup_integration.runtime_data.coordinator.data, area_registry)
    report = setup_integration.runtime_data.coordinator.derived.consistency
    assert health["isolated_areas"] == list(report.isolated_areas)
    assert health["status"] == "warning"  # flur isolated


async def test_read_hook_health_lists_filled(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """read_hook.health carries the populated four lists (§3, §5.3)."""
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/read_hook"})
    response = await client.receive_json()
    assert response["success"]
    health = response["result"]["health"]
    # flur/wohnzimmer/kueche exist but have no edges -> all isolated.
    assert set(health["isolated_areas"]) == {"flur", "wohnzimmer", "kueche"}
