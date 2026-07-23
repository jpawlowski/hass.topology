"""Orphan-undo-window tests (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from pytest_homeassistant_custom_component.common import async_fire_time_changed

from custom_components.topology.const import EVENT_TOPOLOGY_UPDATED, STORAGE_KEY, STORAGE_VERSION
from homeassistant.helpers import area_registry as ar
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant

_T0 = "2026-07-23T10:00:00+00:00"


async def _orphan_wohnzimmer(
    hass: HomeAssistant,
    entry: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    load_payload(entry, payload)
    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()


async def test_orphan_kept_within_window(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    freezer: Any,
) -> None:
    """71 h after orphaning, the daily cleanup keeps the entries."""
    freezer.move_to(_T0)
    await _orphan_wohnzimmer(hass, setup_integration, area_registry, store_payload_full, load_payload)

    freezer.tick(71 * 3600)
    async_fire_time_changed(hass, dt_util.utcnow())
    await hass.async_block_till_done()

    store = setup_integration.runtime_data.store
    assert "flur::wohnzimmer" in store.data["edges"]
    assert "wohnzimmer" in store.data["areas"]


async def test_orphan_purged_after_window(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    freezer: Any,
) -> None:
    """73 h after orphaning, the daily cleanup purges the entries and fires purge."""
    freezer.move_to(_T0)
    await _orphan_wohnzimmer(hass, setup_integration, area_registry, store_payload_full, load_payload)

    events: list[dict[str, Any]] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, lambda event: events.append(event.data))

    freezer.tick(73 * 3600)
    async_fire_time_changed(hass, dt_util.utcnow())
    await hass.async_block_till_done()

    store = setup_integration.runtime_data.store
    assert "flur::wohnzimmer" not in store.data["edges"]
    assert "kueche::wohnzimmer" not in store.data["edges"]
    assert "wohnzimmer" not in store.data["areas"]
    assert any(event["change"] == "purge" for event in events)


async def test_orphan_restore_via_ws(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: Any,
) -> None:
    """Re-creating the area and calling restore_edge clears orphaned_at."""
    await _orphan_wohnzimmer(hass, setup_integration, area_registry, store_payload_full, load_payload)
    store = setup_integration.runtime_data.store
    assert store.data["edges"]["flur::wohnzimmer"].get("orphaned_at") is not None

    area_registry.async_create("wohnzimmer")
    await hass.async_block_till_done()

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/restore_edge", "edge_id": "flur::wohnzimmer"})
    response = await client.receive_json()
    assert response["success"]
    assert response["result"]["orphaned_at"] is None
    assert store.data["edges"]["flur::wohnzimmer"].get("orphaned_at") is None


async def test_orphan_restore_missing_area_rejected(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    hass_ws_client: Any,
) -> None:
    """restore_edge while a referenced area is still missing returns area_not_found."""
    await _orphan_wohnzimmer(hass, setup_integration, area_registry, store_payload_full, load_payload)

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/restore_edge", "edge_id": "flur::wohnzimmer"})
    response = await client.receive_json()
    assert response["error"]["code"] == "area_not_found"


async def test_orphan_cleanup_on_startup(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> None:
    """Entries already past their window at setup are purged during setup."""
    path = Path(hass.config.path(".storage", STORAGE_KEY))
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "schema_version": STORAGE_VERSION,
        "home_config": {
            "occupancy_extent": "whole_property",
            "projection_toggles": {"environment": False, "type": False, "trust": False},
            "imports_done_at": {"aliases": None, "labels": None},
            "unannotated_repair_threshold": 3,
        },
        "areas": {},
        "edges": {
            "a::b": {
                "area_a": "a",
                "area_b": "b",
                "connections": [{"passage": "level", "barrier": "door"}],
                "created_at": "2020-01-01T00:00:00+00:00",
                "orphaned_at": "2020-01-01T00:00:00+00:00",
            }
        },
        "floors": {},
    }
    envelope = {"version": STORAGE_VERSION, "minor_version": 1, "key": STORAGE_KEY, "data": data}
    path.write_text(json.dumps(envelope), encoding="utf-8")

    mock_config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    assert mock_config_entry.runtime_data.store.data["edges"] == {}
