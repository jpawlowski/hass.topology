"""
Existence + semantic validators for the topology services (PLAN-topology-phase6.md §3).

Each validator raises a **translated** ``ServiceValidationError`` under ``DOMAIN``
(invalid user input, per Silver ``action-exceptions``). Kept self-contained — the
WebSocket layer's ``_validate_connection`` is reproduced here rather than imported
(D5). The connection sensor rule mirrors WS ``_validate_connection`` with
``allow_inline_trust=True``.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

from custom_components.topology.const import DOMAIN
from custom_components.topology.data import Barrier
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import area_registry as ar, floor_registry as fr

if TYPE_CHECKING:
    from collections.abc import Mapping

    from custom_components.topology.data import PresetDefinition
    from homeassistant.core import HomeAssistant

# A bound door sensor must be a plain ``binary_sensor.<slug>`` entity id (§2.2).
_SENSOR_PATTERN = re.compile(r"^binary_sensor\.[a-z0-9_]+$")


def _raise(translation_key: str, **placeholders: str) -> None:
    """Raise a translated ``ServiceValidationError`` under ``DOMAIN`` (§3)."""
    raise ServiceValidationError(
        translation_domain=DOMAIN,
        translation_key=translation_key,
        translation_placeholders=placeholders or None,
    )


def require_area(hass: HomeAssistant, area_id: str) -> None:
    """Raise ``area_not_found`` if the id is absent from the area registry (§3)."""
    if ar.async_get(hass).async_get_area(area_id) is None:
        _raise("area_not_found", area_id=area_id)


def require_floor(hass: HomeAssistant, floor_id: str) -> None:
    """Raise ``floor_not_found`` if the id is absent from the floor registry (§3)."""
    if fr.async_get(hass).async_get_floor(floor_id) is None:
        _raise("floor_not_found", floor_id=floor_id)


def validate_preset_sensor(definition: PresetDefinition, sensor: str) -> None:
    """Validate a ``declare_connection`` sensor against its preset (§2.2, §3).

    A sensor is only allowed when the preset's barrier is a door and the preset
    permits a sensor; otherwise ``sensor_requires_door``. The id must be a
    ``binary_sensor.<slug>``; otherwise ``invalid_sensor``.
    """
    if definition.barrier is not Barrier.DOOR or not definition.sensor_allowed:
        _raise("sensor_requires_door")
    if not _SENSOR_PATTERN.match(sensor):
        _raise("invalid_sensor", sensor=sensor)


def validate_exterior_connection(connection: Mapping[str, Any]) -> None:
    """Validate one exterior connection's sensor rule (§2.4, §3).

    Mirrors WS ``_validate_connection`` (``allow_inline_trust=True``): a
    ``sensor_entity_id`` requires ``barrier == door`` and a ``binary_sensor.<slug>``
    shape. Closed enums are already validated by the call schema.
    """
    sensor = connection.get("sensor_entity_id")
    if sensor is None:
        return
    if connection.get("barrier") != Barrier.DOOR.value:
        _raise("sensor_requires_door")
    if not _SENSOR_PATTERN.match(sensor):
        _raise("invalid_sensor", sensor=sensor)
