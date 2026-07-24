"""
Household summary sensor for topology (§3.1).

``sensor.topology_house`` reports the share of areas that carry a topology
annotation as a percentage, plus the household-level counts consumers read
from the same registry-merged projection the ``health`` signal uses (§7).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.const import TRANSLATION_KEY_HOUSE
from custom_components.topology.entity import TopologyEntity
from custom_components.topology.entity_utils.entity_ids import house_object_id, house_unique_id
from homeassistant.components.sensor import ENTITY_ID_FORMAT, SensorEntity, SensorStateClass
from homeassistant.const import PERCENTAGE
from homeassistant.helpers.entity import async_generate_entity_id

if TYPE_CHECKING:
    from custom_components.topology.coordinator import TopologyCoordinator


class TopologyHouseSensor(TopologyEntity, SensorEntity):
    """The one always-on household summary sensor (§3.1)."""

    _attr_translation_key = TRANSLATION_KEY_HOUSE
    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: TopologyCoordinator) -> None:
        """Pin the frozen unique_id and entity_id (§4)."""
        super().__init__(coordinator)
        self._attr_unique_id = house_unique_id(coordinator.config_entry.entry_id)
        self.entity_id = async_generate_entity_id(ENTITY_ID_FORMAT, house_object_id(), hass=coordinator.hass)

    @property
    def native_value(self) -> int:
        """Return the annotated-area percentage (0–100), 0 when no areas (D10)."""
        house = self.derived.house
        if house.area_count == 0:
            return 0
        return round(house.annotated_count / house.area_count * 100)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the frozen household attribute contract (§3.1)."""
        house = self.derived.house
        return {
            "occupancy_extent": house.occupancy_extent.value,
            "area_count": house.area_count,
            "annotated_count": house.annotated_count,
            "unannotated_areas": list(house.unannotated_areas),
            "perimeter_connection_count": house.perimeter_connection_count,
            "outdoor_area_count": house.outdoor_area_count,
            "floor_count": house.floor_count,
        }
