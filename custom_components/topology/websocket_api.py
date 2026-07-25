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

from .const import DOMAIN, EVENT_TOPOLOGY_UPDATED
from .data import Barrier, BeyondClass, CardinalSide, Environment, OccupancyExtent, Passage, Trust
from .entity_utils.derivations import build_health, connections_facing_outdoor
from .read_contract import (
    annotations_by_id,
    area_out,
    edge_out,
    list_annotations_payload,
    neighbors_payload,
    path_result,
    read_hook_payload,
    serialize_home_config,
    unannotated_area_out,
)
from .service_actions.label_projection import async_reconcile_labels

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.core import HomeAssistant

    from .data import TopologyRuntimeData

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
    async_register_command(hass, ws_neighbors)
    async_register_command(hass, ws_path)
    async_register_command(hass, ws_connections_facing_outdoor)


# --- helpers ---------------------------------------------------------------


def _runtime(hass: HomeAssistant) -> TopologyRuntimeData | None:
    """Return the loaded singleton runtime data, or None (not_loaded)."""
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data
    return None


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


def _dedupe_connections[T: Mapping[str, Any]](connections: list[T]) -> list[T]:
    """Drop byte-identical duplicates from a bundle, keeping the first of each.

    A bundle models distinct ways to cross the same boundary (a stair *and* a
    lift), so two identical entries carry no information — they only inflate the
    ``connection_index`` space that the perimeter list and the binary sensor
    index into. Order is preserved because the index is part of the read contract.
    """
    seen: set[str] = set()
    result: list[T] = []
    for connection in connections:
        fingerprint = repr(sorted(connection.items()))
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        result.append(connection)
    return result


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
    connection.send_result(
        msg["id"],
        list_annotations_payload(runtime.coordinator.data, ar.async_get(hass), fr.async_get(hass)),
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
    connection.send_result(
        msg["id"],
        read_hook_payload(runtime.coordinator.data, ar.async_get(hass), fr.async_get(hass)),
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
    connection.send_result(msg["id"], build_health(runtime.coordinator.data, ar.async_get(hass), fr.async_get(hass)))


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


# --- graph query commands (read, Phase 4 §4) -------------------------------


@websocket_command(
    {
        vol.Required("type"): "topology/neighbors",
        vol.Required("area_id"): str,
    }
)
@async_response
async def ws_neighbors(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return an area's adjacent areas over non-orphaned interior edges (§4.1)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    area_id = msg["area_id"]
    if ar.async_get(hass).async_get_area(area_id) is None:
        connection.send_error(msg["id"], ERR_AREA_NOT_FOUND, f"Unknown area {area_id}")
        return
    connection.send_result(msg["id"], neighbors_payload(runtime.coordinator.derived.graph, area_id))


@websocket_command(
    {
        vol.Required("type"): "topology/path",
        vol.Required("from"): str,
        vol.Required("to"): str,
        vol.Optional("traversable_only", default=False): bool,
    }
)
@async_response
async def ws_path(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return the shortest hop path between two areas (§4.2)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    src, dst = msg["from"], msg["to"]
    area_reg = ar.async_get(hass)
    for area_id in (src, dst):
        if area_reg.async_get_area(area_id) is None:
            connection.send_error(msg["id"], ERR_AREA_NOT_FOUND, f"Unknown area {area_id}")
            return
    # This command's endpoint keys stay ``from``/``to`` — the frozen §4.2 shape.
    # The service transport renames them (``from`` is a Jinja keyword); see
    # ``read_contract.path_payload``.
    path, hops, distance = path_result(
        runtime.coordinator.derived.graph, src, dst, traversable_only=msg["traversable_only"]
    )
    connection.send_result(
        msg["id"],
        {"from": src, "to": dst, "path": path, "hops": hops, "distance": distance},
    )


@websocket_command({vol.Required("type"): "topology/connections_facing_outdoor"})
@async_response
async def ws_connections_facing_outdoor(
    hass: HomeAssistant,
    connection: ActiveConnection,
    msg: dict[str, Any],
) -> None:
    """Return every proven open-air-facing connection (§4.3)."""
    runtime = _runtime(hass)
    if runtime is None:
        connection.send_error(msg["id"], ERR_NOT_LOADED, "No topology entry is loaded")
        return
    connections = connections_facing_outdoor(runtime.coordinator.data, ar.async_get(hass))
    connection.send_result(msg["id"], {"connections": connections})


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
    connections = _dedupe_connections(connections)

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
    connections = _dedupe_connections(connections)
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

    # No mirror back into entry.data: the store is the single source of truth and
    # setup no longer applies entry.data over it, so there is nothing to protect
    # the edit from — a reload simply re-reads the store (§2.5/§2.6).

    # The panel path does not reload, so reconcile labels here to make a toggle
    # flip effective immediately (§2.8 site 3).
    await async_reconcile_labels(hass, runtime.store.snapshot())

    runtime.coordinator.async_publish(runtime.store.snapshot(), "home_config", [])
    connection.send_result(msg["id"], serialize_home_config(runtime.store.snapshot()))


# --- serialization helpers that need a fresh snapshot ----------------------


def _validate_area_annotation(annotation: dict[str, Any]) -> str | None:
    """Validate the enum values in an update_area annotation (§4.2)."""
    environment = annotation.get("environment")
    if "environment" in annotation and environment is not None and environment not in _ENVIRONMENT_VALUES:
        return ERR_INVALID_ENUM
    trust = annotation.get("trust")
    if "trust" in annotation and trust is not None and trust not in _TRUST_VALUES:
        return ERR_INVALID_ENUM
    # ``type`` is an open catalog (§2.4 rule 5): any string is legal, so
    # AREA_TYPE_CATALOG is a suggestion list (shipped by serialize_area_types),
    # never a validation set.
    return None


def _area_out_for(runtime: TopologyRuntimeData, area_id: str) -> dict[str, Any]:
    annotations = annotations_by_id(runtime.store.snapshot())
    annotation = annotations.get(area_id)
    return area_out(annotation) if annotation is not None else unannotated_area_out(area_id)


def _edge_out_for(hass: HomeAssistant, runtime: TopologyRuntimeData, edge_id: str) -> dict[str, Any]:
    snapshot = runtime.store.snapshot()
    area_reg = ar.async_get(hass)
    floor_reg = fr.async_get(hass)
    area_trust = {annotation.area_id: annotation.trust for annotation in snapshot.areas}
    overrides = {floor.floor_id: floor for floor in snapshot.floors}
    edge = next(edge for edge in snapshot.edges if edge.edge_id == edge_id)
    return edge_out(edge, area_trust, area_reg, floor_reg, overrides)
