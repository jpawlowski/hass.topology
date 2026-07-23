"""
Custom integration to model the topology of a Home Assistant home.

Topology is a registry-driven, calculated helper: it annotates the area and
floor registries with a spatial model (types, environment, trust, adjacency)
and serves that model to consumers over a WebSocket contract. It talks to no
external service.

Phase 2 wires the store, coordinator snapshot, registry watcher, and the
WebSocket API. The entity platforms stay empty until Phase 3.

For more details about this integration, please refer to:
https://github.com/jpawlowski/hass.topology
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.const import Platform
from homeassistant.exceptions import ConfigEntryError, ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv, issue_registry as ir

from .const import (
    CONF_OCCUPANCY_EXTENT,
    CONF_PROJECT_ENVIRONMENT,
    CONF_PROJECT_TRUST,
    CONF_PROJECT_TYPE,
    CONF_UNANNOTATED_REPAIR_THRESHOLD,
    DOMAIN,
)
from .coordinator import TopologyCoordinator, TopologyRegistryWatcher
from .data import TopologyRuntimeData
from .service_actions import async_setup_services
from .store import StoreCorruptError, StoreFutureVersionError, TopologyStore, TopologyStoreError
from .websocket_api import async_register_websocket_api

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import TopologyConfigEntry

PLATFORMS: list[Platform] = [
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
]

# Topology is configured via config entries only (no YAML configuration).
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

_STORE_FUTURE_VERSION_ISSUE = "store_future_version"
_LEARN_MORE_URL = "https://github.com/jpawlowski/hass.topology"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the integration.

    Called once at Home Assistant startup. WebSocket commands (cluster e) and
    (from Phase 6) service actions are registered here — not per config entry —
    so they exist even before an entry is loaded (§4).
    """
    await async_setup_services(hass)
    async_register_websocket_api(hass)
    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Set up topology from a config entry.

    Runs the test-before-setup checks (§5.3): a transient I/O failure raises
    ``ConfigEntryNotReady``; corrupt JSON raises ``ConfigEntryError``; a future
    store version raises ``ConfigEntryError`` and creates a repair issue.
    """
    store = TopologyStore(hass)
    try:
        await store.async_load()
    except StoreFutureVersionError as err:
        ir.async_create_issue(
            hass,
            DOMAIN,
            _STORE_FUTURE_VERSION_ISSUE,
            is_fixable=False,
            severity=ir.IssueSeverity.ERROR,
            translation_key=_STORE_FUTURE_VERSION_ISSUE,
            learn_more_url=_LEARN_MORE_URL,
            translation_placeholders={"version": str(err.version)},
        )
        raise ConfigEntryError("topology store was written by a newer version") from err
    except StoreCorruptError as err:
        raise ConfigEntryError("topology store is corrupt") from err
    except TopologyStoreError as err:  # transient I/O error
        raise ConfigEntryNotReady("topology store could not be read") from err

    # A successful load clears any stale future-version repair.
    ir.async_delete_issue(hass, DOMAIN, _STORE_FUTURE_VERSION_ISSUE)

    coordinator = TopologyCoordinator(hass, entry, store)

    # Sync the config-entry fields into the store's home_config (§5): the store
    # is what the read hook serves; entry data is the flow's own state.
    data = entry.data
    await store.async_apply_home_config(
        occupancy_extent=data.get(CONF_OCCUPANCY_EXTENT),
        project_environment=data.get(CONF_PROJECT_ENVIRONMENT),
        project_type=data.get(CONF_PROJECT_TYPE),
        project_trust=data.get(CONF_PROJECT_TRUST),
        unannotated_repair_threshold=data.get(CONF_UNANNOTATED_REPAIR_THRESHOLD),
    )
    coordinator.async_seed(store.snapshot())

    entry.runtime_data = TopologyRuntimeData(store=store, coordinator=coordinator)

    watcher = TopologyRegistryWatcher(hass, coordinator)
    await watcher.async_startup_purge()
    watcher.async_start()
    entry.async_on_unload(watcher.async_stop)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Unload a config entry and its platforms (registry listeners via on_unload)."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_reload_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> None:
    """Reload the config entry."""
    await hass.config_entries.async_reload(entry.entry_id)
