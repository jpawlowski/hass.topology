"""Registry-event reaction tests (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING, Any

from custom_components.topology.const import EVENT_TOPOLOGY_UPDATED
from homeassistant.helpers import area_registry as ar, floor_registry as fr

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant


async def test_area_removed_orphans_edges(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Removing an area marks its edges and annotation orphaned, keeping the data."""
    load_payload(setup_integration, store_payload_full)
    store = setup_integration.runtime_data.store

    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()

    assert store.data["areas"]["wohnzimmer"].get("orphaned_at") is not None
    assert store.data["edges"]["flur::wohnzimmer"].get("orphaned_at") is not None
    assert store.data["edges"]["kueche::wohnzimmer"].get("orphaned_at") is not None
    # Data is kept, not deleted.
    assert store.data["areas"]["wohnzimmer"]["type"] == "living"


async def test_area_recreated_clears_orphan(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Recreating a removed area with the same id clears its orphan flags."""
    load_payload(setup_integration, store_payload_full)
    store = setup_integration.runtime_data.store

    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()
    assert store.data["areas"]["wohnzimmer"].get("orphaned_at") is not None
    assert store.data["edges"]["flur::wohnzimmer"].get("orphaned_at") is not None

    recreated = area_registry.async_create("wohnzimmer")
    assert recreated.id == "wohnzimmer"
    await hass.async_block_till_done()

    assert "orphaned_at" not in store.data["areas"]["wohnzimmer"]
    assert "orphaned_at" not in store.data["edges"]["flur::wohnzimmer"]
    assert "orphaned_at" not in store.data["edges"]["kueche::wohnzimmer"]


async def test_area_removed_fires_event(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Orphaning pushes a change:'orphan' event with the affected ids."""
    load_payload(setup_integration, store_payload_full)
    events: list[dict[str, Any]] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, lambda event: events.append(event.data))

    area_registry.async_delete("kueche")
    await hass.async_block_till_done()

    orphan_events = [event for event in events if event["change"] == "orphan"]
    assert orphan_events
    affected = set(orphan_events[-1]["ids"])
    assert "kueche" in affected
    assert "flur::kueche" in affected


async def test_area_rename_no_store_change(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """An update action fans out without changing the stored bytes."""
    load_payload(setup_integration, store_payload_full)
    store = setup_integration.runtime_data.store
    before = copy.deepcopy(store.data)

    events: list[dict[str, Any]] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, lambda event: events.append(event.data))
    area_registry.async_update("flur", name="Hallway")
    await hass.async_block_till_done()

    assert store.data == before
    assert any(event["change"] == "area" for event in events)


async def test_area_created_updates_snapshot(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A new area appears as unannotated in the health signal."""
    from custom_components.topology.websocket_api import _build_health  # noqa: PLC0415

    new_area = area_registry.async_create("Basement")
    await hass.async_block_till_done()

    health = _build_health(setup_integration.runtime_data.coordinator.data, area_registry)
    assert new_area.id in health["unannotated_areas"]


async def test_floor_registry_fanout(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    floor_registry: fr.FloorRegistry,
) -> None:
    """A floor level change re-emits a snapshot fanout."""
    floor = next(iter(floor_registry.async_list_floors()))
    events: list[dict[str, Any]] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, lambda event: events.append(event.data))

    floor_registry.async_update(floor.floor_id, level=2)
    await hass.async_block_till_done()

    assert any(event["change"] == "floor" for event in events)


async def test_floor_removed_orphans_override(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    floor_registry: fr.FloorRegistry,
) -> None:
    """Removing a floor marks its level_override entry orphaned."""
    store = setup_integration.runtime_data.store
    floor = floor_registry.async_create("Attic")  # level None
    await store.async_set_floor_level(floor.floor_id, 4)

    floor_registry.async_delete(floor.floor_id)
    await hass.async_block_till_done()

    assert store.data["floors"][floor.floor_id].get("orphaned_at") is not None
