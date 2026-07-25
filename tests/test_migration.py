"""Config-entry migration tests (PLAN-topology-phase2-followup-configflow.md §3/§6).

The 1.1 -> 1.2 migration transfers the legacy flow fields into the store — the
single source of truth — flushes them, and only then empties ``entry.data`` and
bumps the minor version.
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.topology import async_migrate_entry
from custom_components.topology.config_flow_handler.config_flow import TopologyConfigFlowHandler
from custom_components.topology.const import (
    CONFIG_ENTRY_MINOR_VERSION,
    CONFIG_ENTRY_VERSION,
    DOMAIN,
    IMPORT_SOURCE_ALIASES,
    IMPORT_SOURCES,
    LEGACY_CONF_KEYS,
    STORAGE_VERSION,
)
from custom_components.topology.store import TopologyStoreError
from homeassistant.config_entries import ConfigEntryState

if TYPE_CHECKING:
    from typing import Any

    from homeassistant.core import HomeAssistant


async def _setup(hass: HomeAssistant, entry: MockConfigEntry) -> bool:
    """Add and set up an entry, returning whether setup succeeded."""
    entry.add_to_hass(hass)
    result = await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return result


def _legacy_entry(data: dict[str, Any]) -> MockConfigEntry:
    """Build a 1.1 entry with an arbitrary (possibly partial) legacy mapping."""
    return MockConfigEntry(
        domain=DOMAIN,
        unique_id=DOMAIN,
        data=data,
        title="Topology",
        version=1,
        minor_version=1,
    )


# --- transfer --------------------------------------------------------------


async def test_migrate_transfers_legacy_fields(
    hass: HomeAssistant,
    legacy_config_entry: MockConfigEntry,
    persisted_store: None,
) -> None:
    """A 1.1 entry's five settings land in the store and the entry bumps to 1.2."""
    assert await _setup(hass, legacy_config_entry)
    home = legacy_config_entry.runtime_data.store.data["home_config"]
    assert home["occupancy_extent"] == "whole_property"
    assert home["projection_toggles"] == {"environment": False, "type": False, "trust": False}
    assert home["unannotated_repair_threshold"] == 3
    assert legacy_config_entry.version == CONFIG_ENTRY_VERSION
    assert legacy_config_entry.minor_version == CONFIG_ENTRY_MINOR_VERSION


async def test_migrate_no_data_loss_non_default(hass: HomeAssistant, persisted_store: None) -> None:
    """Non-default values survive the transfer exactly (D7: entry.data wins once)."""
    entry = _legacy_entry(
        {
            "occupancy_extent": "unit_within_building",
            "import_aliases": False,
            "import_labels": False,
            "project_environment": True,
            "project_type": True,
            "project_trust": True,
            "unannotated_repair_threshold": 10,
        }
    )
    assert await _setup(hass, entry)
    home = entry.runtime_data.store.data["home_config"]
    assert home["occupancy_extent"] == "unit_within_building"
    assert home["projection_toggles"] == {"environment": True, "type": True, "trust": True}
    assert home["unannotated_repair_threshold"] == 10


async def test_migrate_partial_entry_data(hass: HomeAssistant, persisted_store: None) -> None:
    """Absent legacy keys are skipped — a trimmed entry cannot blank the store."""
    entry = _legacy_entry({"unannotated_repair_threshold": 7})
    assert await _setup(hass, entry)
    home = entry.runtime_data.store.data["home_config"]
    assert home["unannotated_repair_threshold"] == 7
    # Untouched keys keep the store defaults rather than being blanked.
    assert home["occupancy_extent"] == "whole_property"
    assert home["projection_toggles"] == {"environment": False, "type": False, "trust": False}


async def test_migrate_clears_legacy_keys(
    hass: HomeAssistant,
    legacy_config_entry: MockConfigEntry,
    persisted_store: None,
) -> None:
    """The same update that bumps the version empties entry.data (S1+S2 merged)."""
    assert await _setup(hass, legacy_config_entry)
    assert legacy_config_entry.data == {}
    assert legacy_config_entry.minor_version == CONFIG_ENTRY_MINOR_VERSION


async def test_migrate_keeps_unknown_entry_keys(hass: HomeAssistant, persisted_store: None) -> None:
    """Only the known legacy keys are stripped; anything else is preserved."""
    entry = _legacy_entry({"occupancy_extent": "whole_property", "unrelated": "keep me"})
    assert await _setup(hass, entry)
    assert entry.data == {"unrelated": "keep me"}


# --- idempotency + retry safety --------------------------------------------


async def test_migrate_is_idempotent(
    hass: HomeAssistant,
    legacy_config_entry: MockConfigEntry,
    persisted_store: None,
) -> None:
    """A reload after the migration transfers nothing and changes nothing."""
    assert await _setup(hass, legacy_config_entry)
    store = legacy_config_entry.runtime_data.store
    await store.async_update_home_config(unannotated_repair_threshold=42)
    await store.async_save_now()

    with patch("custom_components.topology.store.TopologyStore.async_apply_home_config") as apply:
        await hass.config_entries.async_reload(legacy_config_entry.entry_id)
        await hass.async_block_till_done()
        assert apply.call_count == 0

    assert legacy_config_entry.data == {}
    assert legacy_config_entry.minor_version == CONFIG_ENTRY_MINOR_VERSION
    assert legacy_config_entry.runtime_data.store.data["home_config"]["unannotated_repair_threshold"] == 42


async def test_migrate_store_error_defers_bump(
    hass: HomeAssistant,
    legacy_config_entry: MockConfigEntry,
    persisted_store: None,
) -> None:
    """A store error defers the bump *and* the clearing; a later load migrates."""
    legacy_config_entry.add_to_hass(hass)
    with patch(
        "custom_components.topology.store.TopologyStore.async_load",
        side_effect=TopologyStoreError("io"),
    ):
        assert not await hass.config_entries.async_setup(legacy_config_entry.entry_id)
        await hass.async_block_till_done()

    # Setup surfaces the real cause; the entry stays retryable and unmigrated.
    assert legacy_config_entry.state is ConfigEntryState.SETUP_RETRY
    assert legacy_config_entry.minor_version == 1
    assert legacy_config_entry.data["occupancy_extent"] == "whole_property"

    # The next load migrates for real.
    await hass.config_entries.async_reload(legacy_config_entry.entry_id)
    await hass.async_block_till_done()
    assert legacy_config_entry.state is ConfigEntryState.LOADED
    assert legacy_config_entry.minor_version == CONFIG_ENTRY_MINOR_VERSION
    assert legacy_config_entry.data == {}


async def test_migrate_flush_raising_defers_bump(
    hass: HomeAssistant,
    legacy_config_entry: MockConfigEntry,
    persisted_store: None,
) -> None:
    """A flush that *raises* defers instead of parking the entry unrecoverably.

    ``Store._write_prepared_data`` creates the storage directory outside its
    error handler, so an ``OSError`` there escapes ``async_save_now()``. Letting
    it escape the hook would make core log it and treat the migration as failed
    → the non-recoverable ``MIGRATION_ERROR`` state.
    """
    legacy_config_entry.add_to_hass(hass)
    with patch(
        "custom_components.topology.store.TopologyStore.async_save_now",
        side_effect=OSError("no space left on device"),
    ):
        assert await hass.config_entries.async_setup(legacy_config_entry.entry_id)
        await hass.async_block_till_done()

    # Setup itself is fine — the store is readable, only the flush failed. The
    # entry loads normally, is NOT in MIGRATION_ERROR, and nothing was cleared.
    assert legacy_config_entry.state is ConfigEntryState.LOADED
    assert legacy_config_entry.minor_version == 1
    assert legacy_config_entry.data["occupancy_extent"] == "whole_property"

    # Once the disk recovers, the next load migrates.
    await hass.config_entries.async_reload(legacy_config_entry.entry_id)
    await hass.async_block_till_done()
    assert legacy_config_entry.state is ConfigEntryState.LOADED
    assert legacy_config_entry.minor_version == CONFIG_ENTRY_MINOR_VERSION
    assert legacy_config_entry.data == {}


async def test_migrate_silently_failed_flush_defers_bump(
    hass: HomeAssistant,
    legacy_config_entry: MockConfigEntry,
) -> None:
    """A flush that fails *silently* must not let entry.data be cleared.

    HA's ``Store._async_handle_write_data`` catches ``WriteError`` — what a full
    or read-only disk produces — and only logs it, so ``async_save_now()``
    returns normally although nothing was written. Without the read-back check
    the migration would empty ``entry.data`` on top of an unwritten store and
    lose the user's settings. Here the harness supplies exactly that shape: it
    mocks writes into memory, so nothing reaches the file the store reloads from.
    """
    entry = _legacy_entry({"occupancy_extent": "unit_within_building", "unannotated_repair_threshold": 10})
    assert await _setup(hass, entry)

    # Setup itself succeeds (the store is readable) but the migration deferred.
    assert entry.state is ConfigEntryState.LOADED
    assert entry.minor_version == 1
    assert entry.data == {"occupancy_extent": "unit_within_building", "unannotated_repair_threshold": 10}


async def test_migrate_current_entry_untouched(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """A 1.2 entry performs no store write and no entry update."""
    mock_config_entry.add_to_hass(hass)
    with patch("custom_components.topology.store.TopologyStore.async_apply_home_config") as apply:
        assert await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()
        assert apply.call_count == 0
    assert mock_config_entry.data == {}
    assert mock_config_entry.minor_version == CONFIG_ENTRY_MINOR_VERSION


async def test_migrate_hook_short_circuits_on_current_version(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """Called directly on an up-to-date entry the hook is a total no-op (§3.2 step 2).

    Core short-circuits before invoking the hook on an exact version match, so
    this branch is only reachable by calling it directly — it exists to keep the
    function total (e.g. after a future partial-version bump).
    """
    mock_config_entry.add_to_hass(hass)
    with (
        patch("custom_components.topology.store.TopologyStore.async_load") as load,
        patch.object(hass.config_entries, "async_update_entry") as update,
    ):
        assert await async_migrate_entry(hass, mock_config_entry) is True
        assert load.call_count == 0
        assert update.call_count == 0


# --- downgrade rejection ---------------------------------------------------


async def test_migrate_future_minor_rejected(hass: HomeAssistant) -> None:
    """A higher minor reaches our hook and is refused (D11)."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=DOMAIN,
        data={},
        title="Topology",
        version=CONFIG_ENTRY_VERSION,
        minor_version=CONFIG_ENTRY_MINOR_VERSION + 1,
    )
    entry.add_to_hass(hass)
    assert not await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.MIGRATION_ERROR


async def test_migrate_future_major_rejected(hass: HomeAssistant) -> None:
    """A higher major is refused by core before the hook is ever called."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        unique_id=DOMAIN,
        data={},
        title="Topology",
        version=CONFIG_ENTRY_VERSION + 1,
        minor_version=1,
    )
    entry.add_to_hass(hass)
    with patch("custom_components.topology.async_migrate_entry") as hook:
        assert not await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
        assert hook.call_count == 0
    assert entry.state is ConfigEntryState.MIGRATION_ERROR


# --- pending one-shot imports ----------------------------------------------


async def test_pending_import_not_run_at_setup(
    hass: HomeAssistant,
    area_registry: object,
    import_payload: dict[str, str],
    persisted_store: None,
) -> None:
    """A never-executed opt-in does not import at setup; the stamp stays null.

    The intent is not lost: an unstamped source is exactly what makes the panel's
    first-run card appear (§4.4, covered by ``first-run.spec.ts``).
    """
    _ = area_registry
    entry = _legacy_entry(
        {
            "occupancy_extent": "whole_property",
            "import_aliases": True,
            "import_labels": True,
        }
    )
    assert await _setup(hass, entry)
    store = entry.runtime_data.store
    assert store.data["home_config"]["imports_done_at"] == {"aliases": None, "labels": None}
    # No annotation was written by the migration either.
    assert store.data["areas"] == {}
    assert entry.data == {}


async def test_stamped_import_does_not_rerun(
    hass: HomeAssistant,
    legacy_config_entry: MockConfigEntry,
    persisted_store: None,
) -> None:
    """A stamp present before the migration survives it untouched."""
    assert await _setup(hass, legacy_config_entry)
    store = legacy_config_entry.runtime_data.store
    await store.async_mark_import_done(IMPORT_SOURCE_ALIASES)
    await store.async_save_now()
    stamp = store.data["home_config"]["imports_done_at"]["aliases"]
    assert stamp is not None

    await hass.config_entries.async_reload(legacy_config_entry.entry_id)
    await hass.async_block_till_done()
    assert legacy_config_entry.runtime_data.store.data["home_config"]["imports_done_at"]["aliases"] == stamp


# --- version constants -----------------------------------------------------


def test_config_entry_version_decoupled() -> None:
    """The entry version and the store schema version are independent (D5)."""
    assert TopologyConfigFlowHandler.VERSION == CONFIG_ENTRY_VERSION == 1
    assert TopologyConfigFlowHandler.MINOR_VERSION == CONFIG_ENTRY_MINOR_VERSION == 2
    # The store schema is untouched by this change.
    assert STORAGE_VERSION == 1


@pytest.mark.parametrize("source", ["aliases", "labels"])
def test_import_sources_are_legacy_key_free(source: str) -> None:
    """The import sources stay the store's own keys, not entry.data flags."""
    assert source in IMPORT_SOURCES
    assert f"import_{source}" in LEGACY_CONF_KEYS
