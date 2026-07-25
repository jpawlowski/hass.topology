"""
Adjacency + traversal helpers backing the graph query surface (§4).

Pure functions over a ``TopologySnapshot`` plus the registries. The adjacency is
built once per snapshot (cached on ``coordinator.derived.graph``) and reused by
the ``topology/neighbors`` / ``topology/path`` commands and the
``isolated_areas`` consistency check. Only non-orphaned interior edges
participate.
"""

from __future__ import annotations

from collections import deque
from itertools import pairwise
from typing import TYPE_CHECKING

from custom_components.topology.data import GraphView, Neighbor, Passage
from custom_components.topology.entity_utils.derivations import effective_level, is_perimeter_edge

if TYPE_CHECKING:
    from custom_components.topology.data import Edge, FloorOverride, TopologySnapshot
    from homeassistant.helpers.area_registry import AreaRegistry
    from homeassistant.helpers.floor_registry import FloorRegistry


def edge_levels(
    edge: Edge,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
    overrides: dict[str, FloorOverride],
) -> tuple[str, int | None]:
    """Return ``(axis, level_delta)`` for an edge, delta signed a -> b (§4.1).

    ``axis`` classifies the edge; ``level_delta`` adds the direction the axis
    cannot carry (positive = ``area_b`` sits above ``area_a``). Both are derived,
    never stored: the floor level is the registry's to own.
    """
    level_a = effective_level(edge.area_a, area_reg, floor_reg, overrides)
    level_b = effective_level(edge.area_b, area_reg, floor_reg, overrides)
    if level_a is None or level_b is None:
        return "unknown", None
    delta = level_b - level_a
    return ("horizontal" if delta == 0 else "vertical"), delta


def _traversable(edge: Edge) -> bool:
    """Return whether any connection on the edge is walkable (passage != none, D13)."""
    return any(connection.passage is not Passage.NONE for connection in edge.connections)


def build_graph(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
    overrides: dict[str, FloorOverride],
) -> GraphView:
    """Build the undirected adjacency over non-orphaned interior edges (§4)."""
    area_trust = {annotation.area_id: annotation.trust for annotation in snapshot.areas}
    adjacency: dict[str, list[Neighbor]] = {}
    for edge in snapshot.edges:
        if edge.orphaned_at is not None:
            continue
        axis, delta = edge_levels(edge, area_reg, floor_reg, overrides)
        perimeter = is_perimeter_edge(edge, area_trust)
        traversable = _traversable(edge)
        adjacency.setdefault(edge.area_a, []).append(
            Neighbor(
                area_id=edge.area_b,
                edge_id=edge.edge_id,
                axis=axis,
                is_perimeter=perimeter,
                traversable=traversable,
                level_delta=delta,
            )
        )
        # The delta is relative to the asking area, so it flips for the far side.
        adjacency.setdefault(edge.area_b, []).append(
            Neighbor(
                area_id=edge.area_a,
                edge_id=edge.edge_id,
                axis=axis,
                is_perimeter=perimeter,
                traversable=traversable,
                level_delta=None if delta is None else -delta,
            )
        )
    return GraphView(adjacency={area_id: tuple(items) for area_id, items in adjacency.items()})


def neighbors(graph: GraphView, area_id: str) -> tuple[Neighbor, ...]:
    """Return the neighbours of an area (empty tuple when isolated, §4.1)."""
    return graph.adjacency.get(area_id, ())


def path_distance(graph: GraphView, path: list[str]) -> int | None:
    """Return a path's weighted distance: hops plus every storey it changes (master §73).

    Climbing a floor is a bigger deal than crossing a room, which a plain hop
    count cannot express — a landing two floors up looks as near as the room next
    door. Returns ``None`` when any hop's level difference is unresolvable, so a
    caller sees "cannot say" instead of a total that is silently too small; the
    unweighted ``hops`` is always available beside it.
    """
    total = 0
    for src, dst in pairwise(path):
        hop = next((n for n in graph.adjacency.get(src, ()) if n.area_id == dst), None)
        if hop is None or hop.level_delta is None:
            return None
        total += 1 + abs(hop.level_delta)
    return total


def shortest_path(
    graph: GraphView,
    src: str,
    dst: str,
    *,
    traversable_only: bool,
) -> list[str] | None:
    """Return the shortest hop path by BFS, or None if unreachable (§4.2)."""
    if src == dst:
        return [src]
    visited = {src}
    queue: deque[tuple[str, list[str]]] = deque([(src, [src])])
    while queue:
        node, path = queue.popleft()
        for neighbor in graph.adjacency.get(node, ()):
            if traversable_only and not neighbor.traversable:
                continue
            if neighbor.area_id in visited:
                continue
            next_path = [*path, neighbor.area_id]
            if neighbor.area_id == dst:
                return next_path
            visited.add(neighbor.area_id)
            queue.append((neighbor.area_id, next_path))
    return None
