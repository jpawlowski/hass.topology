"""Connectivity binary sensor for topology."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.entity import TopologyEntity
from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.const import EntityCategory

if TYPE_CHECKING:
    from custom_components.topology.coordinator import TopologyDataUpdateCoordinator

ENTITY_DESCRIPTIONS = (
    BinarySensorEntityDescription(
        key="api_connectivity",
        translation_key="api_connectivity",
        device_class=BinarySensorDeviceClass.CONNECTIVITY,
        entity_category=EntityCategory.DIAGNOSTIC,
        icon="mdi:api",
        has_entity_name=True,
    ),
)


class TopologyConnectivitySensor(BinarySensorEntity, TopologyEntity):
    """Connectivity sensor for topology."""

    def __init__(
        self,
        coordinator: TopologyDataUpdateCoordinator,
        entity_description: BinarySensorEntityDescription,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, entity_description)

    @property
    def is_on(self) -> bool:
        """Return true if the API connection is established."""
        # Connection is considered established if coordinator has valid data
        return self.coordinator.last_update_success

    @property
    def extra_state_attributes(self) -> dict[str, str | None]:
        """Return additional state attributes."""
        return {
            "update_interval": str(self.coordinator.update_interval),
            "api_endpoint": "JSONPlaceholder (Demo)",
        }
