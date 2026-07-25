"""
The read contract shared by the WebSocket API and the read service actions.

Everything a consumer may *read* is serialized here exactly once, so the two
transports cannot drift. ``websocket_api.py`` owns the ``topology/*`` command
envelope (auth, error codes, subscriptions) and ``service_actions/read.py`` owns
the ``SupportsResponse.ONLY`` service envelope; both call the pure functions in
this module for the payload itself.

Why this module exists: until the read services landed, these serializers were
private helpers inside ``websocket_api.py``, which made the WebSocket layer the
de-facto owner of the data contract. A second transport reading the same model
had to either import private names or copy them — the second of which is how a
"frozen" contract quietly grows two versions. The shapes below are the frozen
ones from ``PLAN-topology-phase2.md`` §4.10; nothing here has an opinion about
who is asking.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from .data import AREA_TYPE_CATALOG, CONNECTION_PRESETS, TYPE_CASCADE, connection_to_dict
from .entity_utils.derivations import build_health, connections_facing_outdoor, derive_perimeter, is_perimeter_edge
from .entity_utils.graph import edge_levels, neighbors as graph_neighbors, path_distance, shortest_path

if TYPE_CHECKING:
    from homeassistant.helpers.area_registry import AreaRegistry
    from homeassistant.helpers.floor_registry import FloorRegistry

    from .data import (
        AreaAnnotation,
        Connection,
        ConnectionDict,
        Edge,
        FloorOverride,
        GraphView,
        TopologySnapshot,
        Trust,
    )


def connection_out(connection: Connection) -> ConnectionDict:
    """Serialize a domain connection; unknown enums already read as null."""
    return connection_to_dict(connection)


def area_out(annotation: AreaAnnotation) -> dict[str, Any]:
    """Serialize an annotated area (§4 area_out); enums null when unknown."""
    return {
        "area_id": annotation.area_id,
        "type": annotation.type,
        "environment": annotation.environment.value if annotation.environment is not None else None,
        "trust": annotation.trust.value if annotation.trust is not None else None,
        "beyond": {side.value: beyond.value for side, beyond in annotation.beyond},
        "exterior_connections": [connection_out(connection) for connection in annotation.exterior_connections],
        "orphaned_at": annotation.orphaned_at,
        "updated_at": annotation.updated_at,
    }


def unannotated_area_out(area_id: str) -> dict[str, Any]:
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


def edge_out(
    edge: Edge,
    area_trust: dict[str, Trust | None],
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
    overrides: dict[str, FloorOverride],
) -> dict[str, Any]:
    """Serialize an edge with derived axis + level_delta + is_perimeter (§4 edge_out)."""
    axis, level_delta = edge_levels(edge, area_reg, floor_reg, overrides)
    return {
        "edge_id": edge.edge_id,
        "area_a": edge.area_a,
        "area_b": edge.area_b,
        "axis": axis,
        # Signed a -> b: positive means area_b is the upper one. ``axis`` says
        # only *that* the edge is vertical, never which way.
        "level_delta": level_delta,
        "is_perimeter": is_perimeter_edge(edge, area_trust),
        "connections": [connection_out(connection) for connection in edge.connections],
        "orphaned_at": edge.orphaned_at,
        "created_at": edge.created_at,
    }


def annotations_by_id(snapshot: TopologySnapshot) -> dict[str, AreaAnnotation]:
    """Index a snapshot's area annotations by area id."""
    return {annotation.area_id: annotation for annotation in snapshot.areas}


def all_area_ids(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> list[str]:
    """Return every registry area id plus orphaned store annotations."""
    registry_ids = [area.id for area in area_reg.async_list_areas()]
    annotations = annotations_by_id(snapshot)
    extra = [area_id for area_id in annotations if area_id not in registry_ids]
    return registry_ids + extra


def serialize_areas(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> list[dict[str, Any]]:
    """Serialize every registry area, annotated or not (§4.10 areas)."""
    annotations = annotations_by_id(snapshot)
    return [
        area_out(annotations[area_id]) if area_id in annotations else unannotated_area_out(area_id)
        for area_id in all_area_ids(snapshot, area_reg)
    ]


def serialize_edges(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> list[dict[str, Any]]:
    """Serialize every interior edge with its derived geometry (§4.10 edges)."""
    area_trust = {annotation.area_id: annotation.trust for annotation in snapshot.areas}
    overrides = {floor.floor_id: floor for floor in snapshot.floors}
    return [edge_out(edge, area_trust, area_reg, floor_reg, overrides) for edge in snapshot.edges]


def serialize_floors(
    snapshot: TopologySnapshot,
    floor_reg: FloorRegistry,
) -> list[dict[str, Any]]:
    """Merge registry floor levels with store overrides, ordered top-down (§4.10 home.floors).

    Emitted highest ``effective_level`` first, so iterating the list reads like a
    section through the building and a consumer needs no level arithmetic to lay
    floors out vertically. Floors with no resolvable level sort last and keep
    registry order (the sort is stable), because there is nothing to place them by.

    The level itself is the registry's number — HA allows ``0`` and negatives, so
    a ground floor is ``0`` where that is the convention and ``1`` where it is
    not. Only the relative order matters here; the label always comes from the
    floor's name, never from the number.
    """
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
    result.sort(key=lambda floor: (floor["effective_level"] is None, -(floor["effective_level"] or 0)))
    return result


def serialize_area_types() -> dict[str, Any]:
    """Ship the area-type catalog + cascade so the panel never hardcodes them (§4.1).

    The catalog is open — any string stays legal — but the shipped defaults and
    the environment/trust each one suggests are the backend's to define, exactly
    as with the preset table. Without this the panel would carry a second copy
    that silently drifts.
    """
    return {
        "catalog": list(AREA_TYPE_CATALOG),
        "cascade": {
            area_type: {
                "environment": environment.value if environment is not None else None,
                "trust": trust.value if trust is not None else None,
            }
            for area_type, (environment, trust) in TYPE_CASCADE.items()
        },
    }


def serialize_presets() -> list[dict[str, Any]]:
    """Return the §3.9 preset table so the panel never hardcodes it (§4.1)."""
    return [
        {
            "preset_name": preset.value,
            "passage": definition.passage.value,
            "barrier": definition.barrier.value,
            "glazed_default": definition.glazed_default,
            "sensor_allowed": definition.sensor_allowed,
            # Lets a client offer only the presets that fit the boundary it is
            # editing, instead of guessing from passage/barrier (which cannot
            # distinguish an interior door from an outside one).
            "scope": definition.scope.value,
        }
        for preset, definition in CONNECTION_PRESETS.items()
    ]


def serialize_home_config(snapshot: TopologySnapshot) -> dict[str, Any]:
    """Serialize the home-level configuration block (§4.9/§4.10)."""
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


# --- composed payloads -----------------------------------------------------


def list_annotations_payload(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> dict[str, Any]:
    """The panel snapshot: all registry areas, edges, floors, presets (§4.1)."""
    return {
        "home_config": serialize_home_config(snapshot),
        "areas": serialize_areas(snapshot, area_reg),
        "edges": serialize_edges(snapshot, area_reg, floor_reg),
        "floors": serialize_floors(snapshot, floor_reg),
        "presets": serialize_presets(),
        "area_types": serialize_area_types(),
    }


def read_hook_payload(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> dict[str, Any]:
    """The versioned consumer contract (§4.10) — the whole readable model."""
    return {
        "api_version": 1,
        "home": {
            "occupancy_extent": snapshot.home_config.occupancy_extent.value,
            "floors": serialize_floors(snapshot, floor_reg),
        },
        "areas": serialize_areas(snapshot, area_reg),
        "edges": serialize_edges(snapshot, area_reg, floor_reg),
        "perimeter": derive_perimeter(snapshot, area_reg),
        "health": build_health(snapshot, area_reg, floor_reg),
    }


def perimeter_payload(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> dict[str, Any]:
    """The full derived perimeter set, open or not (§4.10 perimeter).

    ``count`` is the whole set and ``monitored_count`` the subset that carries a
    bound sensor — the difference is exactly the part of the envelope nothing can
    observe, which is the number an arming automation has to reason about.
    """
    connections = derive_perimeter(snapshot, area_reg)
    return {
        "connections": connections,
        "count": len(connections),
        "monitored_count": sum(1 for entry in connections if entry["sensor_entity_id"] is not None),
    }


def neighbors_payload(graph: GraphView, area_id: str) -> dict[str, Any]:
    """An area's adjacent areas over non-orphaned interior edges (§4.1)."""
    return {
        "area_id": area_id,
        "neighbors": [
            {
                "area_id": neighbor.area_id,
                "edge_id": neighbor.edge_id,
                "axis": neighbor.axis,
                # Signed from the queried area: positive = the neighbour is above.
                "level_delta": neighbor.level_delta,
                "is_perimeter": neighbor.is_perimeter,
                "traversable": neighbor.traversable,
            }
            for neighbor in graph_neighbors(graph, area_id)
        ],
    }


def path_result(
    graph: GraphView, src: str, dst: str, *, traversable_only: bool
) -> tuple[list[str] | None, int, int | None]:
    """Return ``(path, hops, distance)`` for a shortest-path query (§4.2).

    The two transports wrap this in differently named envelopes (see
    ``path_payload``), so the traversal itself is factored out rather than the
    finished dict.
    """
    path = shortest_path(graph, src, dst, traversable_only=traversable_only)
    return (
        path,
        (len(path) - 1) if path is not None else -1,
        # Weighted: hops plus every storey change along the way. ``null`` when
        # a level on the path is unresolvable, or when there is no path.
        path_distance(graph, path) if path is not None else None,
    )


def path_payload(graph: GraphView, src: str, dst: str, *, traversable_only: bool) -> dict[str, Any]:
    """The shortest hop path between two areas plus its weighted distance (§4.2).

    The two endpoint keys are ``from_area``/``to_area`` rather than the WebSocket
    command's ``from``/``to``: this payload is consumed from Jinja through a
    ``response_variable``, and ``from`` is a Jinja keyword, so ``result.from``
    is a template syntax error. The rest of the shape is the WebSocket one.
    """
    path, hops, distance = path_result(graph, src, dst, traversable_only=traversable_only)
    return {
        "from_area": src,
        "to_area": dst,
        "path": path,
        "hops": hops,
        "distance": distance,
    }


def connections_facing_outdoor_payload(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    *,
    sides: list[str] | None = None,
    glazed_only: bool = False,
) -> dict[str, Any]:
    """Every proven open-air-facing connection, optionally filtered (§4.3).

    The two filters exist for the service transport: "the glazed openings facing
    west" is the question this data is actually asked, and doing it here keeps the
    caller from writing a ``selectattr`` chain to get at it. Both default to
    "no filter", so the unfiltered result is the WebSocket command's.
    """
    connections = connections_facing_outdoor(snapshot, area_reg)
    if sides:
        connections = [entry for entry in connections if entry["side"] in sides]
    if glazed_only:
        connections = [entry for entry in connections if entry["glazed"]]
    return {
        "connections": connections,
        "count": len(connections),
        "area_ids": sorted({entry["area_id"] for entry in connections}),
    }
