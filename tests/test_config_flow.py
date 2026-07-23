"""Config-flow, reconfigure, and setup/unload tests (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import patch

from custom_components.topology.const import DOMAIN, STORAGE_KEY, STORAGE_VERSION
from custom_components.topology.data import TopologyRuntimeData
from custom_components.topology.store import TopologyStoreError
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


async def test_flow_user_success(hass: HomeAssistant) -> None:
    """Defaults are accepted and create the singleton entry."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    assert entry.unique_id == "topology"
    assert entry.data["occupancy_extent"] == "whole_property"
    assert entry.data["unannotated_repair_threshold"] == 3


async def test_flow_user_full_input(hass: HomeAssistant) -> None:
    """All fields, including the import flags, land in entry.data."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"],
        {
            "occupancy_extent": "unit_within_building",
            "import_aliases": True,
            "import_labels": True,
            "project_environment": True,
            "project_type": True,
            "project_trust": True,
            "unannotated_repair_threshold": 7,
        },
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    data = result["result"].data
    assert data["occupancy_extent"] == "unit_within_building"
    assert data["import_aliases"] is True
    assert data["import_labels"] is True
    assert data["project_environment"] is True
    assert data["unannotated_repair_threshold"] == 7


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


async def test_flow_threshold_default_and_custom(hass: HomeAssistant) -> None:
    """Threshold defaults to 3 and a custom value reaches entry.data + store."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"unannotated_repair_threshold": 10})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]
    assert entry.data["unannotated_repair_threshold"] == 10
    await hass.async_block_till_done()
    assert entry.runtime_data.store.data["home_config"]["unannotated_repair_threshold"] == 10


# --- reconfigure step ------------------------------------------------------


async def test_reconfigure_prefilled(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """The reconfigure form is pre-filled and omits the import flags."""
    result = await setup_integration.start_reconfigure_flow(hass)
    assert result["type"] is FlowResultType.FORM
    assert result["step_id"] == "reconfigure"
    schema_keys = {str(key.schema) for key in result["data_schema"].schema}
    assert "import_aliases" not in schema_keys
    assert "occupancy_extent" in schema_keys


async def test_reconfigure_updates_and_reloads(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """A changed extent updates the entry, reloads, and syncs the store."""
    result = await setup_integration.start_reconfigure_flow(hass)
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"occupancy_extent": "unit_within_building"}
    )
    assert result["type"] is FlowResultType.ABORT
    assert result["reason"] == "reconfigure_successful"
    await hass.async_block_till_done()
    assert setup_integration.data["occupancy_extent"] == "unit_within_building"
    assert setup_integration.runtime_data.store.data["home_config"]["occupancy_extent"] == "unit_within_building"


async def test_reconfigure_runs_checks(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """A corrupt store during reconfigure surfaces the same store_corrupt error."""
    result = await setup_integration.start_reconfigure_flow(hass)
    path = _storage_path(hass)
    path.write_text("{ not json", encoding="utf-8")
    result = await hass.config_entries.flow.async_configure(
        result["flow_id"], {"occupancy_extent": "unit_within_building"}
    )
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
