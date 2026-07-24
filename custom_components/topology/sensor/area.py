"""
Per-area diagnostic sensors for topology (§3.3).

One disabled-by-default sensor per (registry area) × (annotation dimension:
``type`` / ``environment`` / ``trust``). Users opt in per area when they want
dashboard/automation visibility beyond the read hook. State comes purely from
the area's annotation in the snapshot; availability follows the registry via
the coordinator's derived view (never a direct registry read).
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from custom_components.topology.const import DIMENSION_ENVIRONMENT, DIMENSION_TRUST, DIMENSION_TYPE, LOGGER
from custom_components.topology.entity import TopologyEntity
from custom_components.topology.entity_utils.entity_ids import area_object_id, area_unique_id
from homeassistant.components.sensor import ENTITY_ID_FORMAT, SensorDeviceClass, SensorEntity, SensorEntityDescription
from homeassistant.const import EntityCategory
from homeassistant.core import callback
from homeassistant.helpers.entity import async_generate_entity_id

if TYPE_CHECKING:
    from custom_components.topology.coordinator import TopologyCoordinator
    from custom_components.topology.data import AreaAnnotation


def _type_value(annotation: AreaAnnotation | None) -> str | None:
    """Return the open-catalog ``type`` value (verbatim string) or None."""
    return annotation.type if annotation is not None else None


def _environment_value(annotation: AreaAnnotation | None) -> str | None:
    """Return the ``environment`` enum value or None (unknown)."""
    if annotation is None or annotation.environment is None:
        return None
    return annotation.environment.value


def _trust_value(annotation: AreaAnnotation | None) -> str | None:
    """Return the ``trust`` enum value or None (unknown)."""
    if annotation is None or annotation.trust is None:
        return None
    return annotation.trust.value


@dataclass(frozen=True, kw_only=True)
class TopologyAreaSensorDescription(SensorEntityDescription):
    """Static metadata for one per-area annotation dimension (§3.3)."""

    dimension: str
    value_fn: Callable[[AreaAnnotation | None], str | None]


# ``type`` is an open catalog (decision D5): no ENUM device_class, no options.
# ``environment`` / ``trust`` are closed enums with an ENUM device_class.
AREA_SENSOR_DESCRIPTIONS: tuple[TopologyAreaSensorDescription, ...] = (
    TopologyAreaSensorDescription(
        key=DIMENSION_TYPE,
        dimension=DIMENSION_TYPE,
        translation_key="area_type",
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        value_fn=_type_value,
    ),
    TopologyAreaSensorDescription(
        key=DIMENSION_ENVIRONMENT,
        dimension=DIMENSION_ENVIRONMENT,
        translation_key="area_environment",
        device_class=SensorDeviceClass.ENUM,
        options=["indoor", "outdoor", "semi_outdoor"],
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        value_fn=_environment_value,
    ),
    TopologyAreaSensorDescription(
        key=DIMENSION_TRUST,
        dimension=DIMENSION_TRUST,
        translation_key="area_trust",
        device_class=SensorDeviceClass.ENUM,
        options=["private", "shared", "public"],
        entity_category=EntityCategory.DIAGNOSTIC,
        entity_registry_enabled_default=False,
        value_fn=_trust_value,
    ),
)


class TopologyAreaSensor(TopologyEntity, SensorEntity):
    """A per-area diagnostic sensor for one annotation dimension (§3.3)."""

    entity_description: TopologyAreaSensorDescription

    def __init__(
        self,
        coordinator: TopologyCoordinator,
        area_id: str,
        area_slug: str,
        description: TopologyAreaSensorDescription,
    ) -> None:
        """Pin the frozen area-id-based unique_id and slug-based entity_id (§4)."""
        super().__init__(coordinator)
        self.entity_description = description
        self._area_id = area_id
        self._area_available: bool | None = None
        self._attr_unique_id = area_unique_id(coordinator.config_entry.entry_id, area_id, description.dimension)
        self.entity_id = async_generate_entity_id(
            ENTITY_ID_FORMAT,
            area_object_id(area_slug, description.dimension),
            hass=coordinator.hass,
        )

    @property
    def _annotation(self) -> AreaAnnotation | None:
        """Return this area's annotation from the snapshot, or None."""
        for annotation in self.coordinator.data.areas:
            if annotation.area_id == self._area_id:
                return annotation
        return None

    @property
    def native_value(self) -> str | None:
        """Return the dimension's value from the snapshot (None = unknown)."""
        return self.entity_description.value_fn(self._annotation)

    @property
    def available(self) -> bool:
        """Available while the area exists in the registry and is not orphaned (§3.5)."""
        return super().available and self._area_id in self.derived.live_area_ids

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Expose the stable area_id as the machine key (§3.3, D13)."""
        return {"area_id": self._area_id}

    @callback
    def _handle_coordinator_update(self) -> None:
        """Log availability transitions once (Silver log-when-unavailable, §3.5)."""
        available = self._area_id in self.derived.live_area_ids
        if self._area_available is None:
            self._area_available = available
        elif available != self._area_available:
            self._area_available = available
            if available:
                LOGGER.info("Topology area %s is available again (%s)", self._area_id, self.entity_id)
            else:
                LOGGER.info("Topology area %s was removed; %s is unavailable", self._area_id, self.entity_id)
        super()._handle_coordinator_update()
