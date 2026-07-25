"""Config-flow, reconfigure, and setup/unload tests.

The flow is confirm-only (PLAN-topology-phase2-followup-configflow.md §2/§6);
the check/abort rows are the unchanged Phase-2 §7 rows.
"""

from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

from custom_components.topology.const import (
    CONFIG_ENTRY_MINOR_VERSION,
    CONFIG_ENTRY_VERSION,
    DEFAULT_UNANNOTATED_REPAIR_THRESHOLD,
    DOMAIN,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from custom_components.topology.data import TopologyRuntimeData
from custom_components.topology.store import TopologyStoreError, default_store_data
from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntryState
from homeassistant.data_entry_flow import FlowResultType

if TYPE_CHECKING:
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant


def _storage_path(hass: HomeAssistant) -> Path:
    path = Path(hass.config.path(".storage", STORAGE_KEY))
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


# --- user step -------------------------------------------------------------


async def test_flow_user_form_has_no_fields(hass: HomeAssistant) -> None:
    """The user form offers no fields — none of the seven Phase-2 keys."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "user"
    assert list(result["data_schema"].schema) == []


async def test_flow_user_creates_empty_entry(hass: HomeAssistant) -> None:
    """Submitting the confirm step creates the entry with empty data."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    assert entry.data == {}
    assert entry.unique_id == "topology"
    assert entry.version == CONFIG_ENTRY_VERSION
    assert entry.minor_version == CONFIG_ENTRY_MINOR_VERSION


async def test_flow_defaults_come_from_store(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> None:
    """A fresh entry's home config is the store defaults, not flow input."""
    mock_config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()
    home = mock_config_entry.runtime_data.store.data["home_config"]
    assert home == default_store_data()["home_config"]
    assert home["occupancy_extent"] == "whole_property"
    assert home["projection_toggles"] == {"environment": False, "type": False, "trust": False}
    assert home["unannotated_repair_threshold"] == DEFAULT_UNANNOTATED_REPAIR_THRESHOLD


async def test_flow_single_instance_abort(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> None:
    """A second flow aborts with single_instance_allowed (manifest flag)."""
    mock_config_entry.add_to_hass(hass)
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "single_instance_allowed"


async def test_flow_store_corrupt_shows_error(hass: HomeAssistant) -> None:
    """A corrupt store surfaces a recoverable store_corrupt form error."""
    path = _storage_path(hass)
    path.write_text("{ not json", encoding="utf-8")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "store_corrupt"}

    # Recoverable: remove the corrupt file and resubmit.
    path.unlink()
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY


async def test_flow_store_future_version_abort(hass: HomeAssistant) -> None:
    """A version-2 store aborts with store_future_version."""
    path = _storage_path(hass)
    envelope = {"version": 2, "minor_version": 1, "key": STORAGE_KEY, "data": {"schema_version": 2}}
    path.write_text(json.dumps(envelope), encoding="utf-8")
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "store_future_version"


async def test_flow_area_registry_error(hass: HomeAssistant) -> None:
    """A registry failure surfaces the area_registry_unavailable form error."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    with patch(
        "homeassistant.helpers.area_registry.async_get",
        side_effect=RuntimeError("registry down"),
    ):
        result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "area_registry_unavailable"}


# --- reconfigure step ------------------------------------------------------


async def test_reconfigure_form_has_no_fields(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """The reconfigure form is field-less and prefills nothing."""
    result = await setup_integration.start_reconfigure_flow(hass)
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "reconfigure"
    assert list(result["data_schema"].schema) == []


async def test_reconfigure_reloads_and_aborts(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """Confirming reloads the entry, aborts, and leaves entry.data empty."""
    result = await setup_integration.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()
    assert setup_integration.data == {}
    assert setup_integration.state is ConfigEntryState.LOADED


async def test_reconfigure_leaves_home_config(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    persisted_store: None,
) -> None:
    """Reconfigure writes no settings: home_config is identical afterwards."""
    store = setup_integration.runtime_data.store
    await store.async_update_home_config(
        occupancy_extent="unit_within_building",
        unannotated_repair_threshold=9,
    )
    await store.async_save_now()
    before = deepcopy(store.data["home_config"])

    result = await setup_integration.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()

    assert setup_integration.runtime_data.store.data["home_config"] == before


async def test_reconfigure_store_future_version_abort(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
) -> None:
    """A future store version aborts the reconfigure too (unrecoverable by a retry)."""
    result = await setup_integration.start_reconfigure_flow(hass)
    path = _storage_path(hass)
    envelope = {"version": 2, "minor_version": 1, "key": STORAGE_KEY, "data": {"schema_version": 2}}
    path.write_text(json.dumps(envelope), encoding="utf-8")
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "store_future_version"


async def test_reconfigure_runs_checks(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """A corrupt store during reconfigure surfaces the same store_corrupt error."""
    result = await setup_integration.start_reconfigure_flow(hass)
    path = _storage_path(hass)
    path.write_text("{ not json", encoding="utf-8")
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.FORM
    assert result["errors"] == {"base": "store_corrupt"}


# --- setup / unload --------------------------------------------------------


async def test_setup_entry_populates_runtime_data(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> None:
    """Setup attaches TopologyRuntimeData and forwards the platforms."""
    mock_config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()
    runtime = mock_config_entry.runtime_data
    assert isinstance(runtime, TopologyRuntimeData)
    assert runtime.store is not None
    assert runtime.coordinator is not None
    assert runtime.store.data["schema_version"] == STORAGE_VERSION


async def test_setup_entry_store_ioerror_retries(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> None:
    """A transient I/O failure on load raises ConfigEntryNotReady (retry)."""
    mock_config_entry.add_to_hass(hass)
    with patch(
        "custom_components.topology.store.TopologyStore.async_load",
        side_effect=TopologyStoreError("io"),
    ):
        assert not await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()
    assert mock_config_entry.state is ConfigEntryState.SETUP_RETRY


async def test_unload_entry_clean(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """Unload cleans up and a second setup works without double-subscribing."""
    assert await hass.config_entries.async_unload(setup_integration.entry_id)
    await hass.async_block_till_done()
    assert setup_integration.state is ConfigEntryState.NOT_LOADED

    assert await hass.config_entries.async_setup(setup_integration.entry_id)
    await hass.async_block_till_done()
    assert setup_integration.state is ConfigEntryState.LOADED
