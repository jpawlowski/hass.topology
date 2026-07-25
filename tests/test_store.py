"""Store persistence + migration tests (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import AsyncMock, patch

from custom_components.topology import data as topology_data
from custom_components.topology.const import DOMAIN, STORAGE_KEY, STORAGE_VERSION
from custom_components.topology.store import TopologyStore, async_migrate_store, default_store_data
from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import issue_registry as ir
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from typing import Any

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant


def _storage_path(hass: HomeAssistant) -> Path:
    path = Path(hass.config.path(".storage", STORAGE_KEY))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _write_envelope(hass: HomeAssistant, version: int, data: dict[str, Any]) -> Path:
    path = _storage_path(hass)
    envelope = {"version": version, "minor_version": 1, "key": STORAGE_KEY, "data": data}
    path.write_text(json.dumps(envelope), encoding="utf-8")
    return path


async def test_store_v1_roundtrip_empty(hass: HomeAssistant) -> None:
    """Fresh install loads defaults and round-trips the empty structure."""
    store = TopologyStore(hass)
    snapshot = await store.async_load()
    assert snapshot.areas == ()
    assert snapshot.edges == ()
    assert snapshot.floors == ()
    assert store.data == default_store_data()

    await store.async_save_now()
    reloaded = TopologyStore(hass)
    await reloaded.async_load()
    assert reloaded.data == default_store_data()


async def test_store_v1_roundtrip_full(store_payload_full: dict[str, Any]) -> None:
    """The §2.5 payload survives snapshot conversion byte-identically."""
    snapshot = topology_data.snapshot_from_store(store_payload_full)

    rebuilt = {
        "schema_version": STORAGE_VERSION,
        "home_config": topology_data.home_config_to_dict(snapshot.home_config, store_payload_full["home_config"]),
        "areas": {
            annotation.area_id: topology_data.area_annotation_to_dict(
                annotation, store_payload_full["areas"][annotation.area_id]
            )
            for annotation in snapshot.areas
        },
        "edges": {
            edge.edge_id: topology_data.edge_to_dict(edge, store_payload_full["edges"][edge.edge_id])
            for edge in snapshot.edges
        },
        "floors": {floor.floor_id: topology_data.floor_override_to_dict(floor) for floor in snapshot.floors},
    }

    def _norm(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: _norm(value[key]) for key in sorted(value)}
        if isinstance(value, list):
            return [_norm(item) for item in value]
        return value

    assert _norm(rebuilt) == _norm(store_payload_full)
    assert snapshot.unknown_enum_values == ()


async def test_store_load_missing_file(hass: HomeAssistant) -> None:
    """A missing store file yields defaults with no error and no repair issue."""
    store = TopologyStore(hass)
    await store.async_load()
    assert store.data == default_store_data()
    registry = ir.async_get(hass)
    assert not [issue for issue in registry.issues.values() if issue.domain == DOMAIN]


async def test_store_corrupt_json(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> None:
    """Corrupt JSON fails setup with ConfigEntryError and leaves the file untouched."""
    path = _storage_path(hass)
    path.write_text("{ this is not valid json", encoding="utf-8")
    mock_config_entry.add_to_hass(hass)

    assert not await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()
    assert mock_config_entry.state is ConfigEntryState.SETUP_ERROR
    assert path.read_text(encoding="utf-8") == "{ this is not valid json"


async def test_store_migration_hook_called(hass: HomeAssistant) -> None:
    """A version-0 payload triggers async_migrate_store exactly once."""
    _write_envelope(hass, 0, default_store_data())

    wrapped = AsyncMock(side_effect=async_migrate_store)
    with patch("custom_components.topology.store.async_migrate_store", wrapped):
        store = TopologyStore(hass)
        await store.async_load()

    assert wrapped.call_count == 1
    args = wrapped.call_args.args
    assert args[0] is hass
    assert args[2] == 0


async def test_store_migration_returns_new_dict(hass: HomeAssistant) -> None:
    """The migration hook returns a new dict and does not mutate its input."""
    source = default_store_data()
    result = await async_migrate_store(hass, source, 0)
    assert result == source
    assert result is not source
    result["schema_version"] = 99
    assert source["schema_version"] == STORAGE_VERSION


async def test_store_future_version_rejected(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> None:
    """A version-2 payload fails setup, creates a repair, and is not rewritten."""
    data = default_store_data()
    data["schema_version"] = 2
    path = _write_envelope(hass, 2, data)
    original = path.read_text(encoding="utf-8")
    mock_config_entry.add_to_hass(hass)

    assert not await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()
    assert mock_config_entry.state is ConfigEntryState.SETUP_ERROR
    assert ir.async_get(hass).async_get_issue(DOMAIN, "store_future_version") is not None
    assert path.read_text(encoding="utf-8") == original


async def test_store_save_debounced(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """Two mutations in quick succession coalesce into a single disk write."""
    from homeassistant.const import EVENT_HOMEASSISTANT_FINAL_WRITE  # noqa: PLC0415

    store = setup_integration.runtime_data.store
    backend = store._store  # noqa: SLF001

    # Patch _async_write_data (not _async_handle_write_data): the latter also
    # owns the delay-timer cleanup, so replacing it wholesale leaves the
    # pending Store._async_schedule_callback_delayed_write timer uncancelled
    # and fails the test suite's lingering-timer check.
    with patch.object(backend, "_async_write_data", AsyncMock()) as write:
        await store.async_update_area("a", {"type": "kitchen"})
        await store.async_update_area("b", {"type": "living"})
        assert write.call_count == 0  # both mutations only scheduled a delayed write
        # Flush the pending (coalesced) delayed write.
        hass.bus.async_fire(EVENT_HOMEASSISTANT_FINAL_WRITE)
        await hass.async_block_till_done()

    assert write.call_count == 1

    # The final-write flush does not disarm the delayed-write timer, and a timer
    # surviving the test fails the harness cleanup check. ``Store.async_save``
    # cancels the delay listener, so a real save settles it.
    await store.async_save_now()


async def test_store_timestamps_utc_iso(setup_integration: MockConfigEntry, freezer: Any) -> None:
    """Timestamps are written as aware UTC ISO 8601 strings."""
    freezer.move_to("2026-07-23T10:00:00+00:00")
    store = setup_integration.runtime_data.store
    await store.async_update_area("a", {"type": "kitchen"})

    updated_at = store.data["areas"]["a"]["updated_at"]
    parsed = dt_util.parse_datetime(updated_at)
    assert parsed is not None
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == dt_util.utcnow().utcoffset()
    assert updated_at.endswith("+00:00")
