"""
Custom integration to model the topology of a Home Assistant home.

Topology is a registry-driven, calculated helper: it annotates the area and
floor registries with a spatial model (types, environment, trust, adjacency)
and serves that model to consumers over a WebSocket contract. It talks to no
external service.

Phase 1 wires only the config entry and the (empty) entity platforms. Phase 2
adds the store, coordinator snapshot, registry watcher, and WebSocket API.

For more details about this integration, please refer to:
https://github.com/jpawlowski/hass.topology
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.const import Platform
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN
from .coordinator import TopologyCoordinator
from .data import TopologyRuntimeData
from .service_actions import async_setup_services

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import TopologyConfigEntry

PLATFORMS: list[Platform] = [
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
]

# Topology is configured via config entries only (no YAML configuration).
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the integration.

    Called once at Home Assistant startup. Service actions and WebSocket
    commands are registered here (not per config entry) so they exist even
    before an entry is loaded. Phase 6 fills the service registration.
    """
    await async_setup_services(hass)
    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Set up topology from a config entry.

    Phase 1 creates the coordinator and forwards the empty platforms. Phase 2
    loads the store, seeds the snapshot, and starts the registry watcher.
    """
    coordinator = TopologyCoordinator(hass, entry)

    entry.runtime_data = TopologyRuntimeData(coordinator=coordinator)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Unload a config entry and its platforms."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_reload_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> None:
    """Reload the config entry."""
    await hass.config_entries.async_reload(entry.entry_id)
