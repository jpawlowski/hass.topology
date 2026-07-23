"""
Custom integration to integrate topology with Home Assistant.

Topology is a thin metadata layer over the HA area / floor registry
that makes the house machine-readable — a floorplan for automations,
not for humans. It never defines areas or floors, only annotates them,
and it never talks to any external API.

The Phase 1 skeleton in this file wires up nothing but the hub config
entry itself; runtime data (registry watcher, graph index, per-area
entities, WS read hook, panel) lands in later phases as described in
`docs/development/PLAN.md`.

For more details about this integration, please refer to:
https://github.com/jpawlowski/hass.topology

For integration development guidelines:
https://developers.home-assistant.io/docs/creating_integration_manifest
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import homeassistant.helpers.config_validation as cv
from homeassistant.loader import async_get_loaded_integration

from .const import DOMAIN
from .data import TopologyData

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import TopologyConfigEntry


# No platforms are set up yet — Phase 4 introduces the per-area sensor
# and the household perimeter binary sensor.
PLATFORMS: list = []

# This integration is configured via config entries only.
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the topology component (no service actions yet)."""
    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Set up the topology hub entry."""
    entry.runtime_data = TopologyData(
        integration=async_get_loaded_integration(hass, entry.domain),
    )

    if PLATFORMS:
        await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Unload the topology hub entry."""
    if not PLATFORMS:
        return True
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
