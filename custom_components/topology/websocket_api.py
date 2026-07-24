"""
WebSocket API for topology (PLAN-topology-phase2.md §4).

The internal contract consumers (Residents, Alarmo templates, the panel) use.
All commands require an authenticated connection; writes additionally require
admin (ADR "Editing Surface"). Commands are registered once in ``async_setup``;
handlers resolve the singleton config entry at call time and fail with
``not_loaded`` when no entry is set up.
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

import voluptuous as vol

from homeassistant.components.websocket_api import async_register_command
from homeassistant.components.websocket_api.connection import ActiveConnection
from homeassistant.components.websocket_api.decorators import async_response, require_admin, websocket_command
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import callback
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import area_registry as ar, floor_registry as fr

from .const import (
    CONF_OCCUPANCY_EXTENT,
    CONF_PROJECT_ENVIRONMENT,
    CONF_PROJECT_TRUST,
    CONF_PROJECT_TYPE,
    CONF_UNANNOTATED_REPAIR_THRESHOLD,
    DOMAIN,
    EVENT_TOPOLOGY_UPDATED,
)
from .data import (
    AREA_TYPE_CATALOG,
    CONNECTION_PRESETS,
    Barrier,
    BeyondClass,
    CardinalSide,
    Environment,
    OccupancyExtent,
    Passage,
    Trust,
    connection_to_dict,
)
from .entity_utils.derivations import annotation_counts, derive_perimeter, effective_level, is_perimeter_edge

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.area_registry import AreaRegistry
    from homeassistant.helpers.floor_registry import FloorRegistry

    from .data import AreaAnnotation, ConnectionDict, Edge, FloorOverride, TopologyRuntimeData, TopologySnapshot

# --- error codes (§4) ------------------------------------------------------
ERR_NOT_LOADED = "not_loaded"
ERR_AREA_NOT_FOUND = "area_not_found"
ERR_EDGE_NOT_FOUND = "edge_not_found"
ERR_FLOOR_NOT_FOUND = "floor_not_found"
ERR_INVALID_ENUM = "invalid_enum"
ERR_INVALID_CONNECTION = "invalid_connection"
ERR_STORE_ERROR = "store_error"

_SENSOR_PATTERN = re.compile(r"^binary_sensor\.[a-z0-9_]+$")

_PASSAGE_VALUES = {member.value for member in Passage}
_BARRIER_VALUES = {member.value for member in Barrier}
_SIDE_VALUES = {member.value for member in CardinalSide}
_TRUST_VALUES = {member.value for member in Trust}
_ENVIRONMENT_VALUES = {member.value for member in Environment}
_BEYOND_VALUES = {member.value for member in BeyondClass}
_OCCUPANCY_VALUES = {member.value for member in OccupancyExtent}

# vol fragment for a connection payload; enum values are validated in the
# handler (so a bad value becomes invalid_enum, not invalid_format, §7).
_CONNECTION_SCHEMA = {
    vol.Required("passage"): str,
    vol.Required("barrier"): str,
    vol.Optional("side"): str,
    vol.Optional("sensor_entity_id"): str,
    vol.Optional("glazed"): bool,
    vol.Optional("preset_name"): str,
    vol.Optional("perimeter_override"): bool,
    vol.Optional("inline_trust"): str,
}


def async_register_websocket_api(hass: HomeAssistant) -> None:
    """Register all topology WebSocket commands (§4)."""
    async_register_command(hass, ws_list_annotations)
    async_register_command(hass, ws_read_hook)
    async_register_command(hass, ws_health)
    async_register_command(hass, ws_subscribe_updates)
    async_register_command(hass, ws_update_area)
    async_register_command(hass, ws_upsert_edge)
    async_register_command(hass, ws_delete_edge)
    async_register_command(hass, ws_restore_edge)
    async_register_command(hass, ws_set_beyond)
    async_register_command(hass, ws_set_exterior_connections)
    async_register_command(hass, ws_set_floor_level)
    async_register_command(hass, ws_update_home_config)


# --- helpers ---------------------------------------------------------------


def _runtime(hass: HomeAssistant) -> TopologyRuntimeData | None:
    """Return the loaded singleton runtime data, or None (not_loaded)."""
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data
    return None


def _connection_out(connection: object) -> ConnectionDict:
    """Serialize a domain Connection; unknown enums already read as null."""
    return connection_to_dict(connection)  # type: ignore[arg-type]


def _area_out(annotation: AreaAnnotation) -> dict[str, Any]:
    """Serialize an annotated area (§4 area_out); enums null when unknown."""
    return {
        "area_id": annotation.area_id,
        "type": annotation.type,
        "environment": annotation.environment.value if annotation.environment is not None else None,
        "trust": annotation.trust.value if annotation.trust is not None else None,
        "beyond": {side.value: beyond.value for side, beyond in annotation.beyond},
        "exterior_connections": [_connection_out(connection) for connection in annotation.exterior_connections],
        "orphaned_at": annotation.orphaned_at,
        "updated_at": annotation.updated_at,
    }


def _unannotated_area_out(area_id: str) -> dict[str, Any]:
    """Serialize a registry area that has no annotation (all-null, §4.10)."""
    return {
        "area_id": area_id,
        "type": None,
        "environment": None,
        "trust": None,
        "beyond": {},
        "exterior_connections": [],
        "orphaned_at": None,
        "updated_at": "",
    }


def _edge_out(
    edge: Edge,
    area_trust: dict[str, Trust | None],
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
    overrides: dict[str, FloorOverride],
) -> dict[str, Any]:
    """Serialize an edge with derived axis + is_perimeter (§4 edge_out)."""
    level_a = effective_level(edge.area_a, area_reg, floor_reg, overrides)
    level_b = effective_level(edge.area_b, area_reg, floor_reg, overrides)
    if level_a is None or level_b is None:
        axis = "unknown"
    elif level_a == level_b:
        axis = "horizontal"
    else:
        axis = "vertical"
    return {
        "edge_id": edge.edge_id,
        "area_a": edge.area_a,
        "area_b": edge.area_b,
        "axis": axis,
        "is_perimeter": is_perimeter_edge(edge, area_trust),
        "connections": [_connection_out(connection) for connection in edge.connections],
        "orphaned_at": edge.orphaned_at,
        "created_at": edge.created_at,
    }


def _annotations_by_id(snapshot: TopologySnapshot) -> dict[str, AreaAnnotation]:
    return {annotation.area_id: annotation for annotation in snapshot.areas}


def _all_area_ids(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> list[str]:
    """Return every registry area id plus orphaned store annotations."""
    registry_ids = [area.id for area in area_reg.async_list_areas()]
    annotations = _annotations_by_id(snapshot)
    extra = [area_id for area_id in annotations if area_id not in registry_ids]
    return registry_ids + extra


def _serialize_areas(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> list[dict[str, Any]]:
    annotations = _annotations_by_id(snapshot)
    return [
        _area_out(annotations[area_id]) if area_id in annotations else _unannotated_area_out(area_id)
        for area_id in _all_area_ids(snapshot, area_reg)
    ]


def _serialize_edges(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> list[dict[str, Any]]:
    area_trust = {annotation.area_id: annotation.trust for annotation in snapshot.areas}
    overrides = {floor.floor_id: floor for floor in snapshot.floors}
    return [_edge_out(edge, area_trust, area_reg, floor_reg, overrides) for edge in snapshot.edges]


def _serialize_floors(
    snapshot: TopologySnapshot,
    floor_reg: FloorRegistry,
) -> list[dict[str, Any]]:
    """Merge registry floor levels with store overrides (§4.10 home.floors)."""
    overrides = {floor.floor_id: floor for floor in snapshot.floors}
    result: list[dict[str, Any]] = []
    registry_ids: list[str] = []
    for floor in floor_reg.async_list_floors():
        registry_ids.append(floor.floor_id)
        override = overrides.get(floor.floor_id)
        level_override = override.level_override if override is not None else None
        effective = floor.level if floor.level is not None else level_override
        result.append(
            {
                "floor_id": floor.floor_id,
                "registry_level": floor.level,
                "level_override": level_override,
                "effective_level": effective,
            }
        )
    for floor_id, override in overrides.items():
        if floor_id not in registry_ids:
            result.append(
                {
                    "floor_id": floor_id,
                    "registry_level": None,
                    "level_override": override.level_override,
                    "effective_level": override.level_override,
                }
            )
    return result


def _serialize_presets() -> list[dict[str, Any]]:
    """Return the §3.9 preset table so the panel never hardcodes it (§4.1)."""
    return [
        {
            "preset_name": preset.value,
            "passage": definition.passage.value,
            "barrier": definition.barrier.value,
            "glazed_default": definition.glazed_default,
            "sensor_allowed": definition.sensor_allowed,
        }
        for preset, definition in CONNECTION_PRESETS.items()
    ]


def _serialize_home_config(snapshot: TopologySnapshot) -> dict[str, Any]:
    home = snapshot.home_config
    return {
        "occupancy_extent": home.occupancy_extent.value,
        "projection_toggles": {
            "environment": home.project_environment,
            "type": home.project_type,
            "trust": home.project_trust,
        },
        "imports_done_at": {
            "aliases": home.imports_done_at_aliases,
            "labels": home.imports_done_at_labels,
        },
        "unannotated_repair_threshold": home.unannotated_repair_threshold,
    }


def _build_health(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> dict[str, Any]:
    """Compute the consistency/health signal (§4.11). Phase-4 lists stay empty.

    The area counts come from the shared ``annotation_counts`` derivation (§7.2)
    so the household sensor and this signal never drift (decision D6).
    """
    registry_ids, unannotated_tuple, annotated_count = annotation_counts(snapshot, area_reg)
    unannotated = list(unannotated_tuple)

    orphaned_areas = sorted(a.area_id for a in snapshot.areas if a.orphaned_at is not None)
    orphaned_edges = sorted(e.edge_id for e in snapshot.edges if e.orphaned_at is not None)
    orphaned_floors = sorted(f.floor_id for f in snapshot.floors if f.orphaned_at is not None)
    unknown_enum_values = [
        {"scope": u.scope, "id": u.id, "field": u.field_name, "value": u.value} for u in snapshot.unknown_enum_values
    ]

    lists = [
        unannotated,
        orphaned_edges,
        orphaned_areas,
        orphaned_floors,
        unknown_enum_values,
    ]
    status = "warning" if any(lists) else "ok"

    return {
        "status": status,
        "area_count": len(registry_ids),
        "annotated_count": annotated_count,
        "unannotated_areas": unannotated,
        "orphaned_edges": orphaned_edges,
        "orphaned_areas": orphaned_areas,
        "orphaned_floors": orphaned_floors,
        "unknown_enum_values": unknown_enum_values,
        # Phase-4 graph-consistency lists: shape frozen now, filled in Phase 4.
        "isolated_areas": [],
        "indoor_areas_without_floor": [],
        "contradictory_bearings": [],
        "exterior_on_non_outdoor_side": [],
    }


def _validate_connection(connection: dict[str, Any], *, allow_inline_trust: bool) -> str | None:
    """Return an error code for an invalid connection payload, or None (§4)."""
    if connection.get("passage") not in _PASSAGE_VALUES:
        return ERR_INVALID_ENUM
    barrier = connection.get("barrier")
    if barrier not in _BARRIER_VALUES:
        return ERR_INVALID_ENUM
    if "side" in connection and connection["side"] not in _SIDE_VALUES:
        return ERR_INVALID_ENUM

    if "inline_trust" in connection:
        if not allow_inline_trust:
            return ERR_INVALID_CONNECTION
        if connection["inline_trust"] not in _TRUST_VALUES:
            return ERR_INVALID_ENUM

    if "sensor_entity_id" in connection:
        if barrier != Barrier.DOOR.value:
            return ERR_INVALID_CONNECTION
        if not _SENSOR_PATTERN.match(connection["sensor_entity_id"]):
            return ERR_INVALID_CONNECTION

    return None


def _validate_connections(connections: list[dict[str, Any]], *, allow_inline_trust: bool) -> str | None:
    for connection in connections:
        error = _validate_connection(connection, allow_inline_trust=allow_inline_trust)
        if error is not None:
            return error
    return None


@callback
def _send_snapshot_result(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg_id: int,
    payload: dict[str, Any],
) -> None:
    connection.send_result(msg_id, payload)


# --- read commands ---------------------------------------------------------


@websocket_command({vol.Required("type"): "topology/list_annotations"})
@async_response
async def ws_list_annotations(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the panel snapshot: all registry areas, edges, presets (§4.1)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    snapshot = runtime.coordinator.data
    area_reg = ar.async_get(hass)
    floor_reg = fr.async_get(hass)
    connection.send_result(
        msg["id"],
        {
            "home_config": _serialize_home_config(snapshot),
            "areas": _serialize_areas(snapshot, area_reg),
            "edges": _serialize_edges(snapshot, area_reg, floor_reg),
            "floors": _serialize_floors(snapshot, floor_reg),
            "presets": _serialize_presets(),
        },
    )


@websocket_command({vol.Required("type"): "topology/read_hook"})
@async_response
async def ws_read_hook(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """The versioned consumer contract (§4.10)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    snapshot = runtime.coordinator.data
    area_reg = ar.async_get(hass)
    floor_reg = fr.async_get(hass)
    connection.send_result(
        msg["id"],
        {
            "api_version": 1,
            "home": {
                "occupancy_extent": snapshot.home_config.occupancy_extent.value,
                "floors": _serialize_floors(snapshot, floor_reg),
            },
            "areas": _serialize_areas(snapshot, area_reg),
            "edges": _serialize_edges(snapshot, area_reg, floor_reg),
            "perimeter": derive_perimeter(snapshot, area_reg),
            "health": _build_health(snapshot, area_reg),
        },
    )


@websocket_command({vol.Required("type"): "topology/health"})
@async_response
async def ws_health(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """The cheap health signal without the full graph (§4.11)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    connection.send_result(msg["id"], _build_health(runtime.coordinator.data, ar.async_get(hass)))


@websocket_command({vol.Required("type"): "topology/subscribe_updates"})
@async_response
async def ws_subscribe_updates(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Subscribe to change events; consumers re-fetch via read_hook (§4.12)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return

    msg_id = msg["id"]

    @callback
    def _forward(event: Any) -> None:
        connection.send_event(msg_id, event.data)

    connection.subscriptions[msg_id] = hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, _forward)
    connection.send_result(msg_id)


# --- write commands (admin) ------------------------------------------------


@websocket_command(
    {
        vol.Required("type"): "topology/update_area",
        vol.Required("area_id"): str,
        vol.Required("annotation"): {
            vol.Optional("type"): vol.Any(str, None),
            vol.Optional("environment"): vol.Any(str, None),
            vol.Optional("trust"): vol.Any(str, None),
        },
    }
)
@require_admin
@async_response
async def ws_update_area(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Partially update an area annotation (§4.2)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    area_id = msg["area_id"]
    if ar.async_get(hass).async_get_area(area_id) is None:
        connection.send_error(msg["id"], ERR_AREA_NOT_FOUND, f"Unknown area {area_id}")
        return

    annotation = msg["annotation"]
    if (error := _validate_area_annotation(annotation)) is not None:
        connection.send_error(msg["id"], error, "Invalid annotation value")
        return

    try:
        await runtime.store.async_update_area(area_id, annotation)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return
    runtime.coordinator.async_publish(runtime.store.snapshot(), "area", [area_id])
    connection.send_result(msg["id"], _area_out_for(runtime, area_id))


@websocket_command(
    {
        vol.Required("type"): "topology/upsert_edge",
        vol.Required("area_a"): str,
        vol.Required("area_b"): str,
        # An interior edge is a non-empty bundle (§2.2/§4.3 minItems: 1).
        vol.Required("connections"): vol.All([vol.Schema(_CONNECTION_SCHEMA)], vol.Length(min=1)),
    }
)
@require_admin
@async_response
async def ws_upsert_edge(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Create or replace an interior edge's connection bundle (§4.3)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    area_a, area_b = msg["area_a"], msg["area_b"]
    if area_a == area_b:
        connection.send_error(msg["id"], ERR_INVALID_CONNECTION, "area_a == area_b")
        return
    area_reg = ar.async_get(hass)
    for area_id in (area_a, area_b):
        if area_reg.async_get_area(area_id) is None:
            connection.send_error(msg["id"], ERR_AREA_NOT_FOUND, f"Unknown area {area_id}")
            return

    connections = msg["connections"]
    if (error := _validate_connections(connections, allow_inline_trust=False)) is not None:
        connection.send_error(msg["id"], error, "Invalid connection")
        return

    try:
        _snapshot, edge_id = await runtime.store.async_upsert_edge(area_a, area_b, connections)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return
    runtime.coordinator.async_publish(runtime.store.snapshot(), "edge", [edge_id])
    connection.send_result(msg["id"], _edge_out_for(hass, runtime, edge_id))


@websocket_command(
    {
        vol.Required("type"): "topology/delete_edge",
        vol.Required("edge_id"): str,
    }
)
@require_admin
@async_response
async def ws_delete_edge(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Delete an edge immediately (§4.4)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    edge_id = msg["edge_id"]
    if not runtime.store.edge_exists(edge_id):
        connection.send_error(msg["id"], ERR_EDGE_NOT_FOUND, f"Unknown edge {edge_id}")
        return
    try:
        await runtime.store.async_delete_edge(edge_id)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return
    runtime.coordinator.async_publish(runtime.store.snapshot(), "edge", [edge_id])
    connection.send_result(msg["id"], {"deleted": True})


@websocket_command(
    {
        vol.Required("type"): "topology/restore_edge",
        vol.Required("edge_id"): str,
    }
)
@require_admin
@async_response
async def ws_restore_edge(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Clear an edge's orphan flag, if both its areas are present (§4.5)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    edge_id = msg["edge_id"]
    edge = runtime.store.edge(edge_id)
    if edge is None:
        connection.send_error(msg["id"], ERR_EDGE_NOT_FOUND, f"Unknown edge {edge_id}")
        return
    area_reg = ar.async_get(hass)
    for area_id in (edge["area_a"], edge["area_b"]):
        if area_reg.async_get_area(area_id) is None:
            connection.send_error(msg["id"], ERR_AREA_NOT_FOUND, f"Area {area_id} still missing")
            return
    try:
        await runtime.store.async_restore_edge(edge_id)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return
    runtime.coordinator.async_publish(runtime.store.snapshot(), "edge", [edge_id])
    connection.send_result(msg["id"], _edge_out_for(hass, runtime, edge_id))


@websocket_command(
    {
        vol.Required("type"): "topology/set_beyond",
        vol.Required("area_id"): str,
        vol.Required("side"): vol.In(sorted(_SIDE_VALUES)),
        vol.Required("beyond"): vol.Any(str, None),
    }
)
@require_admin
@async_response
async def ws_set_beyond(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Set or clear one beyond side of an area (§4.6)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    area_id = msg["area_id"]
    if ar.async_get(hass).async_get_area(area_id) is None:
        connection.send_error(msg["id"], ERR_AREA_NOT_FOUND, f"Unknown area {area_id}")
        return
    beyond = msg["beyond"]
    if beyond is not None and beyond not in _BEYOND_VALUES:
        connection.send_error(msg["id"], ERR_INVALID_ENUM, f"Invalid beyond {beyond}")
        return
    try:
        await runtime.store.async_set_beyond(area_id, msg["side"], beyond)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return
    runtime.coordinator.async_publish(runtime.store.snapshot(), "beyond", [area_id])
    connection.send_result(msg["id"], _area_out_for(runtime, area_id))


@websocket_command(
    {
        vol.Required("type"): "topology/set_exterior_connections",
        vol.Required("area_id"): str,
        vol.Required("connections"): [vol.Schema(_CONNECTION_SCHEMA)],
    }
)
@require_admin
@async_response
async def ws_set_exterior_connections(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Replace an area's exterior-connection list atomically (§4.7)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    area_id = msg["area_id"]
    if ar.async_get(hass).async_get_area(area_id) is None:
        connection.send_error(msg["id"], ERR_AREA_NOT_FOUND, f"Unknown area {area_id}")
        return
    connections = msg["connections"]
    if (error := _validate_connections(connections, allow_inline_trust=True)) is not None:
        connection.send_error(msg["id"], error, "Invalid connection")
        return
    try:
        await runtime.store.async_set_exterior_connections(area_id, connections)
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return
    runtime.coordinator.async_publish(runtime.store.snapshot(), "exterior", [area_id])
    connection.send_result(msg["id"], _area_out_for(runtime, area_id))


@websocket_command(
    {
        vol.Required("type"): "topology/set_floor_level",
        vol.Required("floor_id"): str,
        vol.Required("level"): vol.Any(int, None),
    }
)
@require_admin
@async_response
async def ws_set_floor_level(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Store or clear a floor-level override (§4.8)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    floor_id = msg["floor_id"]
    floor_reg = fr.async_get(hass)
    floor = floor_reg.async_get_floor(floor_id)
    if floor is None:
        connection.send_error(msg["id"], ERR_FLOOR_NOT_FOUND, f"Unknown floor {floor_id}")
        return
    try:
        await runtime.store.async_set_floor_level(floor_id, msg["level"])
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return
    runtime.coordinator.async_publish(runtime.store.snapshot(), "floor", [floor_id])
    overrides = {f.floor_id: f for f in runtime.store.snapshot().floors}
    override = overrides.get(floor_id)
    level_override = override.level_override if override is not None else None
    effective = floor.level if floor.level is not None else level_override
    connection.send_result(
        msg["id"],
        {
            "floor_id": floor_id,
            "registry_level": floor.level,
            "level_override": level_override,
            "effective_level": effective,
        },
    )


@websocket_command(
    {
        vol.Required("type"): "topology/update_home_config",
        vol.Optional("occupancy_extent"): str,
        vol.Optional("projection_toggles"): {
            vol.Optional("environment"): bool,
            vol.Optional("type"): bool,
            vol.Optional("trust"): bool,
        },
        vol.Optional("unannotated_repair_threshold"): vol.All(int, vol.Range(min=1, max=100)),
    }
)
@require_admin
@async_response
async def ws_update_home_config(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Update home-level config from the panel (§4.9)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    occupancy_extent = msg.get("occupancy_extent")
    if occupancy_extent is not None and occupancy_extent not in _OCCUPANCY_VALUES:
        connection.send_error(msg["id"], ERR_INVALID_ENUM, f"Invalid occupancy_extent {occupancy_extent}")
        return
    toggles = msg.get("projection_toggles")
    threshold = msg.get("unannotated_repair_threshold")
    try:
        await runtime.store.async_update_home_config(
            occupancy_extent=occupancy_extent,
            projection_toggles=toggles,
            unannotated_repair_threshold=threshold,
        )
    except HomeAssistantError as err:
        connection.send_error(msg["id"], ERR_STORE_ERROR, str(err))
        return

    # Mirror the change into entry.data so the next reload's home_config sync
    # (async_setup_entry) does not overwrite the panel edit with stale flow
    # state (D5: this command mirrors the reconfigure flow).
    _sync_home_config_to_entry(hass, runtime, occupancy_extent, toggles, threshold)

    runtime.coordinator.async_publish(runtime.store.snapshot(), "home_config", [])
    connection.send_result(msg["id"], _serialize_home_config(runtime.store.snapshot()))


@callback
def _sync_home_config_to_entry(
    hass: HomeAssistant,
    runtime: TopologyRuntimeData,
    occupancy_extent: str | None,
    toggles: dict[str, bool] | None,
    threshold: int | None,
) -> None:
    """Persist changed home-config fields into the config entry's data (§4.9)."""
    updates: dict[str, Any] = {}
    if occupancy_extent is not None:
        updates[CONF_OCCUPANCY_EXTENT] = occupancy_extent
    if toggles is not None:
        if "environment" in toggles:
            updates[CONF_PROJECT_ENVIRONMENT] = toggles["environment"]
        if "type" in toggles:
            updates[CONF_PROJECT_TYPE] = toggles["type"]
        if "trust" in toggles:
            updates[CONF_PROJECT_TRUST] = toggles["trust"]
    if threshold is not None:
        updates[CONF_UNANNOTATED_REPAIR_THRESHOLD] = threshold
    if not updates:
        return
    entry = runtime.coordinator.config_entry
    hass.config_entries.async_update_entry(entry, data={**entry.data, **updates})


# --- serialization helpers that need a fresh snapshot ----------------------


def _validate_area_annotation(annotation: dict[str, Any]) -> str | None:
    """Validate the enum values in an update_area annotation (§4.2)."""
    environment = annotation.get("environment")
    if "environment" in annotation and environment is not None and environment not in _ENVIRONMENT_VALUES:
        return ERR_INVALID_ENUM
    trust = annotation.get("trust")
    if "trust" in annotation and trust is not None and trust not in _TRUST_VALUES:
        return ERR_INVALID_ENUM
    # ``type`` is an open catalog (§2.4 rule 5): any string is legal.
    _ = AREA_TYPE_CATALOG
    return None


def _area_out_for(runtime: TopologyRuntimeData, area_id: str) -> dict[str, Any]:
    annotations = _annotations_by_id(runtime.store.snapshot())
    annotation = annotations.get(area_id)
    return _area_out(annotation) if annotation is not None else _unannotated_area_out(area_id)


def _edge_out_for(hass: HomeAssistant, runtime: TopologyRuntimeData, edge_id: str) -> dict[str, Any]:
    snapshot = runtime.store.snapshot()
    area_reg = ar.async_get(hass)
    floor_reg = fr.async_get(hass)
    area_trust = {annotation.area_id: annotation.trust for annotation in snapshot.areas}
    overrides = {floor.floor_id: floor for floor in snapshot.floors}
    edge = next(edge for edge in snapshot.edges if edge.edge_id == edge_id)
    return _edge_out(edge, area_trust, area_reg, floor_reg, overrides)
