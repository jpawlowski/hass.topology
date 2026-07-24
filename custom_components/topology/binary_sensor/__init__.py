"""Binary sensor platform for topology.

Empty platform skeleton: topology adds no binary_sensor entities until Phase 3.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import PARALLEL_UPDATES as PARALLEL_UPDATES

if TYPE_CHECKING:
    from custom_components.topology.data import TopologyConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the binary_sensor platform (no entities until Phase 3)."""
