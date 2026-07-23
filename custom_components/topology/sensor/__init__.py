"""Sensor platform for topology."""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import PARALLEL_UPDATES as PARALLEL_UPDATES
from homeassistant.components.sensor import SensorEntityDescription

from .air_quality import ENTITY_DESCRIPTIONS as AIR_QUALITY_DESCRIPTIONS, TopologyAirQualitySensor
from .diagnostic import ENTITY_DESCRIPTIONS as DIAGNOSTIC_DESCRIPTIONS, TopologyDiagnosticSensor

if TYPE_CHECKING:
    from custom_components.topology.data import TopologyConfigEntry
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.entity_platform import AddEntitiesCallback

# Combine all entity descriptions from different modules
ENTITY_DESCRIPTIONS: tuple[SensorEntityDescription, ...] = (
    *AIR_QUALITY_DESCRIPTIONS,
    *DIAGNOSTIC_DESCRIPTIONS,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the sensor platform."""
    # Add air quality sensors
    async_add_entities(
        TopologyAirQualitySensor(
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in AIR_QUALITY_DESCRIPTIONS
    )
    # Add diagnostic sensors
    async_add_entities(
        TopologyDiagnosticSensor(
            coordinator=entry.runtime_data.coordinator,
            entity_description=entity_description,
        )
        for entity_description in DIAGNOSTIC_DESCRIPTIONS
    )
