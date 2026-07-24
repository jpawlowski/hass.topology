"""Sensor platform for topology (§3, §6).

Adds the always-on household summary sensor and, per registry area, the three
disabled-by-default diagnostic sensors (type/environment/trust). New areas
created at runtime get their triple via a coordinator listener, so the platform
never reads the area registry directly (AGENTS.md layering, §6).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import PARALLEL_UPDATES as PARALLEL_UPDATES
from homeassistant.core import callback

from .area import AREA_SENSOR_DESCRIPTIONS, TopologyAreaSensor
from .house import TopologyHouseSensor

if TYPE_CHECKING:
    from custom_components.topology.coordinator import TopologyCoordinator
    from custom_components.topology.data import AreaProjection, TopologyConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback


def _area_triple(coordinator: TopologyCoordinator, projection: AreaProjection) -> list[TopologyAreaSensor]:
    """Return the three per-area sensors for one area (slug from the projection, D16)."""
    return [
        TopologyAreaSensor(coordinator, projection.area_id, projection.slug, description)
        for description in AREA_SENSOR_DESCRIPTIONS
    ]


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the household summary sensor and the per-area diagnostic triples (§6.1)."""
    coordinator = entry.runtime_data.coordinator

    known: set[str] = set()
    projections = {projection.area_id: projection for projection in coordinator.derived.areas}
    entities: list[TopologyHouseSensor | TopologyAreaSensor] = [TopologyHouseSensor(coordinator)]
    for area_id in coordinator.derived.live_area_ids:
        entities.extend(_area_triple(coordinator, projections[area_id]))
        known.add(area_id)
    async_add_entities(entities)

    @callback
    def _async_add_new_areas() -> None:
        """Add triples for areas that appeared since the last publish (§6.1)."""
        projections = {projection.area_id: projection for projection in coordinator.derived.areas}
        fresh: list[TopologyAreaSensor] = []
        for area_id in coordinator.derived.live_area_ids:
            if area_id not in known:
                fresh.extend(_area_triple(coordinator, projections[area_id]))
                known.add(area_id)
        if fresh:
            async_add_entities(fresh)

    entry.async_on_unload(coordinator.async_add_listener(_async_add_new_areas))
