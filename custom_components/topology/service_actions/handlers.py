"""
Service handler coroutines for the topology services (PLAN-topology-phase6.md §2).

Each handler resolves the loaded singleton runtime (``not_loaded`` when absent),
validates its input through ``validation.py``, mutates the store through an
existing method (or ``async_mark_import_done``), and — for every service except
``project_labels`` — publishes exactly one ``coordinator.async_publish`` so the
existing fan-out (entities, ``health``, repairs, bus event) runs unchanged (§2).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import DOMAIN
from custom_components.topology.data import CONNECTION_PRESETS, ConnectionPreset
from homeassistant.config_entries import ConfigEntryState
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from .imports import async_run_import
from .label_projection import async_reconcile_labels
from .schemas import (
    FIELD_AREA_A,
    FIELD_AREA_B,
    FIELD_AREA_ID,
    FIELD_BEYOND,
    FIELD_CONNECTIONS,
    FIELD_ENVIRONMENT,
    FIELD_FLOOR_ID,
    FIELD_GLAZED,
    FIELD_LEVEL,
    FIELD_PRESET,
    FIELD_SCOPE,
    FIELD_SENSOR,
    FIELD_SIDE,
    FIELD_SOURCE,
    FIELD_TRUST,
    FIELD_TYPE,
)
from .validation import require_area, require_floor, validate_exterior_connection, validate_preset_sensor

if TYPE_CHECKING:
    from custom_components.topology.data import ConnectionDict, TopologyRuntimeData
    from homeassistant.core import HomeAssistant, ServiceCall


def _runtime(hass: HomeAssistant) -> TopologyRuntimeData | None:
    """Return the loaded singleton runtime data, or None (mirrors the WS resolver, A.6)."""
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data
    return None


def _require_runtime(hass: HomeAssistant) -> TopologyRuntimeData:
    """Return the loaded runtime or raise translated ``not_loaded`` (§3)."""
    runtime = _runtime(hass)
    if runtime is None:
        raise HomeAssistantError(translation_domain=DOMAIN, translation_key="not_loaded")
    return runtime


def _build_preset_connection(
    preset: str,
    *,
    glazed: bool | None,
    side: str | None,
    sensor: str | None,
) -> ConnectionDict:
    """Expand a preset into a single ``ConnectionDict`` (§2.2, D3)."""
    definition = CONNECTION_PRESETS[ConnectionPreset(preset)]
    connection: ConnectionDict = {
        "passage": definition.passage.value,
        "barrier": definition.barrier.value,
        "preset_name": preset,
        "glazed": glazed if glazed is not None else definition.glazed_default,
    }
    if side is not None:
        connection["side"] = side
    if sensor is not None:
        connection["sensor_entity_id"] = sensor
    return connection


async def async_annotate_area(call: ServiceCall) -> None:
    """``topology.annotate_area`` — set area type/environment/trust (§2.1)."""
    runtime = _require_runtime(call.hass)
    area_id = call.data[FIELD_AREA_ID]
    require_area(call.hass, area_id)
    updates = {key: call.data[key] for key in (FIELD_TYPE, FIELD_ENVIRONMENT, FIELD_TRUST) if key in call.data}
    if not updates:
        raise ServiceValidationError(translation_domain=DOMAIN, translation_key="nothing_to_update")
    snapshot = await runtime.store.async_update_area(area_id, updates)
    runtime.coordinator.async_publish(snapshot, "area", [area_id])


async def async_declare_connection(call: ServiceCall) -> None:
    """``topology.declare_connection`` — create/replace an edge from a preset (§2.2)."""
    runtime = _require_runtime(call.hass)
    area_a = call.data[FIELD_AREA_A]
    area_b = call.data[FIELD_AREA_B]
    if area_a == area_b:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="same_area",
            translation_placeholders={"area_id": area_a},
        )
    require_area(call.hass, area_a)
    require_area(call.hass, area_b)

    preset = call.data[FIELD_PRESET]
    sensor = call.data.get(FIELD_SENSOR)
    if sensor is not None:
        validate_preset_sensor(CONNECTION_PRESETS[ConnectionPreset(preset)], sensor)

    connection = _build_preset_connection(
        preset,
        glazed=call.data.get(FIELD_GLAZED),
        side=call.data.get(FIELD_SIDE),
        sensor=sensor,
    )
    snapshot, edge_id = await runtime.store.async_upsert_edge(area_a, area_b, [connection])
    runtime.coordinator.async_publish(snapshot, "edge", [edge_id])


async def async_set_beyond(call: ServiceCall) -> None:
    """``topology.set_beyond`` — set/clear one outer-wall beyond side (§2.3)."""
    runtime = _require_runtime(call.hass)
    area_id = call.data[FIELD_AREA_ID]
    require_area(call.hass, area_id)
    beyond = call.data.get(FIELD_BEYOND)  # omitted or null clears the side
    snapshot = await runtime.store.async_set_beyond(area_id, call.data[FIELD_SIDE], beyond)
    runtime.coordinator.async_publish(snapshot, "beyond", [area_id])


async def async_set_exterior(call: ServiceCall) -> None:
    """``topology.set_exterior`` — replace an area's exterior-connection list (§2.4)."""
    runtime = _require_runtime(call.hass)
    area_id = call.data[FIELD_AREA_ID]
    require_area(call.hass, area_id)
    connections: list[ConnectionDict] = call.data[FIELD_CONNECTIONS]
    for connection in connections:
        validate_exterior_connection(connection)
    snapshot = await runtime.store.async_set_exterior_connections(area_id, connections)
    runtime.coordinator.async_publish(snapshot, "exterior", [area_id])


async def async_set_floor_level(call: ServiceCall) -> None:
    """``topology.set_floor_level`` — store/clear a floor-level override (§2.5)."""
    runtime = _require_runtime(call.hass)
    floor_id = call.data[FIELD_FLOOR_ID]
    require_floor(call.hass, floor_id)
    level = call.data.get(FIELD_LEVEL)  # omitted or null clears the override
    snapshot = await runtime.store.async_set_floor_level(floor_id, level)
    runtime.coordinator.async_publish(snapshot, "floor", [floor_id])


async def async_project_labels(call: ServiceCall) -> None:
    """``topology.project_labels`` — run the opt-in label projection (§2.6)."""
    runtime = _require_runtime(call.hass)
    scope = call.data[FIELD_SCOPE]
    home = runtime.store.snapshot().home_config
    toggles = {
        "environment": home.project_environment,
        "type": home.project_type,
        "trust": home.project_trust,
    }
    if scope != "all" and not toggles[scope]:
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key="projection_disabled",
            translation_placeholders={"dimension": scope},
        )
    await async_reconcile_labels(call.hass, runtime.store.snapshot(), scope=scope)
    # No publish: labels live in the Core registry, not the topology snapshot (§2.6).


async def async_import_from_core(call: ServiceCall) -> None:
    """``topology.import_from_core`` — one-shot alias/label seed (§2.7)."""
    runtime = _require_runtime(call.hass)
    source = call.data[FIELD_SOURCE]
    _snapshot, affected = await async_run_import(call.hass, runtime.store, source)
    # The stamp is itself a mutation; publish the post-stamp snapshot ALWAYS so
    # coordinator.data reflects the fresh imports_done_at, even when affected is
    # empty (§2.7 Publish).
    snapshot = await runtime.store.async_mark_import_done(source)
    runtime.coordinator.async_publish(snapshot, "import", affected)
