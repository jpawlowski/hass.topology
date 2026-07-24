"""Binary sensor platform for topology (§2, §6).

Adds the single always-on perimeter-open aggregate. The bound-sensor tracking
lives in the entity; the platform only instantiates it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import PARALLEL_UPDATES as PARALLEL_UPDATES

from .perimeter import TopologyPerimeterBinarySensor

if TYPE_CHECKING:
    from custom_components.topology.data import TopologyConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the perimeter-open binary sensor (§6.2)."""
    async_add_entities([TopologyPerimeterBinarySensor(entry.runtime_data.coordinator)])
