"""
Registry-merged derivations shared by the entities and the WebSocket API (§7.2).

These pure, side-effect-free functions turn a ``TopologySnapshot`` plus the HA
area/floor registries into the entity-facing projections (§7.1) and the
perimeter list. They are the single source for both the entity layer and the
WS ``read_hook``/``health`` responses, so the household sensor's counts and the
``health`` signal can never drift (decision D2/D6, realizing the Phase-2 test
``test_health_matches_house_sensor_inputs``).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.data import (
    OPPOSITE_SIDE,
    TRUST_ORDER,
    AreaProjection,
    BeyondClass,
    ConsistencyReport,
    Environment,
    HouseProjection,
    Passage,
    PerimeterConnection,
    TopologyDerived,
    Trust,
)
from homeassistant.util import slugify

# Passages that actually move a person between storeys. A vertical edge whose
# bundle contains none of these climbs nothing.
_VERTICAL_PASSAGES = frozenset({Passage.STAIRS, Passage.RAMP, Passage.ELEVATOR, Passage.LADDER, Passage.HATCH})

if TYPE_CHECKING:
    from collections.abc import Iterator

    from custom_components.topology.data import Connection, Edge, FloorOverride, TopologySnapshot
    from homeassistant.helpers.area_registry import AreaRegistry
    from homeassistant.helpers.floor_registry import FloorRegistry


def effective_level(
    area_id: str,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
    overrides: dict[str, FloorOverride],
) -> int | None:
    """Return the effective floor level of an area (registry wins, else override)."""
    area = area_reg.async_get_area(area_id)
    if area is None or area.floor_id is None:
        return None
    floor = floor_reg.async_get_floor(area.floor_id)
    if floor is not None and floor.level is not None:
        return floor.level
    override = overrides.get(area.floor_id)
    return override.level_override if override is not None else None


def is_perimeter_edge(edge: Edge, area_trust: dict[str, Trust | None]) -> bool:
    """Return whether an interior edge is a perimeter (trust delta or override)."""
    trust_a = area_trust.get(edge.area_a)
    trust_b = area_trust.get(edge.area_b)
    if trust_a is not None and trust_b is not None and TRUST_ORDER[trust_a] != TRUST_ORDER[trust_b]:
        return True
    return any(connection.perimeter_override for connection in edge.connections)


def _perimeter_owner(edge: Edge, area_trust: dict[str, Trust | None]) -> str:
    """Return the area a perimeter edge's connections belong to.

    A perimeter edge guards the *more private* side, so that is the room the
    entry is attributed to — picking ``edge.area_a`` would report whichever
    ``area_id`` happens to sort first, which is arbitrary (the sibling
    ``connections_facing_outdoor`` was fixed for the same class of bug, PR-review
    r3645648771). Ties — equal or unknown trust, i.e. a ``perimeter_override``
    boundary — are genuinely symmetric, so ``area_a`` stays the stable choice.
    """
    trust_a = area_trust.get(edge.area_a)
    trust_b = area_trust.get(edge.area_b)
    if trust_a is None or trust_b is None:
        return edge.area_a
    return edge.area_b if TRUST_ORDER[trust_b] < TRUST_ORDER[trust_a] else edge.area_a


def _iter_perimeter(
    snapshot: TopologySnapshot,
) -> Iterator[tuple[str, str | None, str, int, str | None]]:
    """Yield ``(source, edge_id, area_id, connection_index, sensor_entity_id)`` (§4.10).

    The single perimeter core shared by the dict form (``derive_perimeter``, for
    the frozen ``read_hook`` bytes) and the typed form
    (``derive_perimeter_connections``, for the binary sensor) so they cannot
    diverge (decision D16). Orphaned entries excluded.
    """
    area_trust = {annotation.area_id: annotation.trust for annotation in snapshot.areas}

    # Exterior connections: trust vs inline_trust (absent => public).
    for annotation in snapshot.areas:
        if annotation.orphaned_at is not None:
            continue
        for index, connection in enumerate(annotation.exterior_connections):
            inline = connection.inline_trust or Trust.PUBLIC
            owner_trust = annotation.trust
            if owner_trust is None or TRUST_ORDER[owner_trust] != TRUST_ORDER[inline]:
                yield "exterior", None, annotation.area_id, index, connection.sensor_entity_id

    # Interior edges whose sides differ in trust (or carry perimeter_override).
    for edge in snapshot.edges:
        if edge.orphaned_at is not None or not is_perimeter_edge(edge, area_trust):
            continue
        owner_id = _perimeter_owner(edge, area_trust)
        for index, connection in enumerate(edge.connections):
            yield "edge", edge.edge_id, owner_id, index, connection.sensor_entity_id


def derive_perimeter(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> list[dict[str, Any]]:
    """Derive the perimeter-connection list as dicts (§4.10, frozen read_hook shape)."""
    return [
        {
            "source": source,
            "edge_id": edge_id,
            "area_id": area_id,
            "connection_index": index,
            "sensor_entity_id": sensor_entity_id,
        }
        for source, edge_id, area_id, index, sensor_entity_id in _iter_perimeter(snapshot)
    ]


def derive_perimeter_connections(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
) -> tuple[PerimeterConnection, ...]:
    """Derive the typed perimeter connections for the binary sensor (§2, §5.2)."""
    return tuple(
        PerimeterConnection(
            source=source,
            edge_id=edge_id,
            area_id=area_id,
            connection_index=index,
            sensor_entity_id=sensor_entity_id,
        )
        for source, edge_id, area_id, index, sensor_entity_id in _iter_perimeter(snapshot)
    )


def annotation_counts(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
) -> tuple[set[str], tuple[str, ...], int]:
    """Return ``(registry_ids, unannotated_areas, annotated_count)`` (§7.2, D6).

    The single implementation the household sensor and the ``health`` signal both
    consume, so their counts are identical by construction.
    """
    registry_ids = {area.id for area in area_reg.async_list_areas()}
    annotation_ids = {annotation.area_id for annotation in snapshot.areas}
    unannotated = tuple(sorted(registry_ids - annotation_ids))
    annotated_count = len([a for a in snapshot.areas if a.area_id in registry_ids and a.orphaned_at is None])
    return registry_ids, unannotated, annotated_count


def derive_areas(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> tuple[AreaProjection, ...]:
    """Project every registry area (plus orphaned store annotations) for entities (§7.2).

    Captures each area's registry ``name`` + ``slug`` so entity-id construction
    (§4.3) reads the slug from the derived view and never touches the registry
    from the platform/entity (decision D16).
    """
    registry = {area.id: area for area in area_reg.async_list_areas()}
    annotations = {annotation.area_id: annotation for annotation in snapshot.areas}

    ordered_ids = list(registry) + [area_id for area_id in annotations if area_id not in registry]
    projections: list[AreaProjection] = []
    for area_id in ordered_ids:
        area = registry.get(area_id)
        annotation = annotations.get(area_id)
        name = area.name if area is not None else area_id
        projections.append(
            AreaProjection(
                area_id=area_id,
                name=name,
                slug=slugify(name),
                exists=area is not None,
                orphaned=annotation is not None and annotation.orphaned_at is not None,
                type=annotation.type if annotation is not None else None,
                environment=annotation.environment if annotation is not None else None,
                trust=annotation.trust if annotation is not None else None,
            )
        )
    return tuple(projections)


def derive_house(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> HouseProjection:
    """Compute the household summary sensor's inputs (§7.2)."""
    registry_ids, unannotated, annotated_count = annotation_counts(snapshot, area_reg)
    outdoor_area_count = len(
        [
            a
            for a in snapshot.areas
            if a.area_id in registry_ids and a.orphaned_at is None and a.environment is Environment.OUTDOOR
        ]
    )
    return HouseProjection(
        occupancy_extent=snapshot.home_config.occupancy_extent,
        area_count=len(registry_ids),
        annotated_count=annotated_count,
        unannotated_areas=unannotated,
        perimeter_connection_count=len(derive_perimeter(snapshot, area_reg)),
        outdoor_area_count=outdoor_area_count,
        floor_count=sum(1 for _ in floor_reg.async_list_floors()),
    )


def _live_registry_ids(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> set[str]:
    """Return non-orphaned registry area ids (§3)."""
    annotations = {annotation.area_id: annotation for annotation in snapshot.areas}
    return {
        area.id
        for area in area_reg.async_list_areas()
        if not (area.id in annotations and annotations[area.id].orphaned_at is not None)
    }


def _derive_edge_geometry(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """Return ``(edges_spanning_multiple_floors, vertical_edges_without_vertical_passage)``.

    Both are advisory. An edge is only judged where both levels resolve, so an
    area without a floor is never flagged here — that is the
    ``indoor_areas_without_floor`` check's job.

    A vertical edge that nobody can pass through at all is **not** flagged. The
    check asks "this edge claims a route between storeys — how does anyone climb
    it?", and an edge whose whole bundle is ``passage: none`` makes no such
    claim: it is the slab between a room and the room above it (the ``ceiling``
    preset), which is a legitimate adjacency, not a broken staircase. Flagging
    those made the advisory fire on correct models, which is how an advisory
    stops being read.
    """
    # Local import: graph imports this module, so the dependency only closes here.
    from custom_components.topology.entity_utils.graph import edge_levels  # noqa: PLC0415

    overrides = {override.floor_id: override for override in snapshot.floors}
    spanning: list[str] = []
    flat_vertical: list[str] = []
    for edge in snapshot.edges:
        if edge.orphaned_at is not None:
            continue
        axis, delta = edge_levels(edge, area_reg, floor_reg, overrides)
        if axis != "vertical" or delta is None:
            continue
        if abs(delta) > 1:
            spanning.append(edge.edge_id)
        crossable = any(connection.passage is not Passage.NONE for connection in edge.connections)
        if crossable and not any(connection.passage in _VERTICAL_PASSAGES for connection in edge.connections):
            flat_vertical.append(edge.edge_id)
    return tuple(sorted(spanning)), tuple(sorted(flat_vertical))


def derive_consistency(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry | None = None,
) -> ConsistencyReport:
    """Compute the graph-consistency lists (§3). Non-orphaned registry areas only.

    ``floor_reg`` is optional so a caller that only wants the area-level lists
    need not resolve the floor registry; the two edge-geometry lists come back
    empty without it, since a level cannot be resolved at all.
    """
    registry_areas = {area.id: area for area in area_reg.async_list_areas()}
    annotations = {annotation.area_id: annotation for annotation in snapshot.areas}
    live_ids = _live_registry_ids(snapshot, area_reg)
    # Only nag about a floorless indoor area when the home actually uses floors
    # (some area is assigned one). A single-storey home that models no floors at
    # all is not flagged (§3.2, D9).
    home_uses_floors = any(area.floor_id is not None for area in registry_areas.values())

    # isolated_areas: not an endpoint of any non-orphaned interior edge (§3.1, D8).
    connected: set[str] = set()
    edge_sides: dict[str, set[str]] = {}
    for edge in snapshot.edges:
        if edge.orphaned_at is not None:
            continue
        connected.add(edge.area_a)
        connected.add(edge.area_b)
        for connection in edge.connections:
            if connection.side is not None:
                # ``side`` is recorded from area_a's perspective; area_b meets the
                # same wall from the opposite bearing (master §1), so mirroring is
                # what makes the bearing check compare the right sides.
                edge_sides.setdefault(edge.area_a, set()).add(connection.side.value)
                edge_sides.setdefault(edge.area_b, set()).add(OPPOSITE_SIDE[connection.side].value)
    isolated = tuple(sorted(area_id for area_id in live_ids if area_id not in connected))

    indoor_without_floor: list[str] = []
    contradictory: list[str] = []
    exterior_bad: list[str] = []
    for area_id in live_ids:
        annotation = annotations.get(area_id)
        # indoor_areas_without_floor (§3.2, D9): indoor + no registry floor,
        # only when the home uses floors at all.
        if (
            home_uses_floors
            and annotation is not None
            and annotation.environment is Environment.INDOOR
            and registry_areas[area_id].floor_id is None
        ):
            indoor_without_floor.append(area_id)
        if annotation is None:
            continue
        beyond = {side.value: beyond_class for side, beyond_class in annotation.beyond}
        # contradictory_bearings (§3.3, D10): a side is both interior-edge and beyond.
        if set(beyond) & edge_sides.get(area_id, set()):
            contradictory.append(area_id)
        # exterior_on_non_outdoor_side (§3.4, D11): an exterior opening that cannot
        # physically sit where it is. ``earth`` (buried wall) forbids any opening;
        # a ``neighbor`` (party) wall may carry a door to shared space — the §2.5
        # apartment door — but not a window (glazed). ``outdoor`` and an unset
        # side are never flagged.
        for connection in annotation.exterior_connections:
            if connection.side is None:
                continue
            beyond_class = beyond.get(connection.side.value)
            if beyond_class is BeyondClass.EARTH or (beyond_class is BeyondClass.NEIGHBOR and connection.glazed):
                exterior_bad.append(area_id)
                break

    spanning, flat_vertical = (
        _derive_edge_geometry(snapshot, area_reg, floor_reg) if floor_reg is not None else ((), ())
    )

    return ConsistencyReport(
        isolated_areas=isolated,
        indoor_areas_without_floor=tuple(sorted(indoor_without_floor)),
        contradictory_bearings=tuple(sorted(contradictory)),
        exterior_on_non_outdoor_side=tuple(sorted(exterior_bad)),
        edges_spanning_multiple_floors=spanning,
        vertical_edges_without_vertical_passage=flat_vertical,
    )


def _facing_entry(source: str, edge_id: str | None, area_id: str, index: int, connection: Connection) -> dict[str, Any]:
    """Serialize one outdoor-facing connection (§4.3)."""
    return {
        "source": source,
        "area_id": area_id,
        "edge_id": edge_id,
        "connection_index": index,
        "side": connection.side.value if connection.side is not None else None,
        "passage": connection.passage.value,
        "barrier": connection.barrier.value,
        "glazed": connection.glazed,
        "sensor_entity_id": connection.sensor_entity_id,
    }


def connections_facing_outdoor(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> list[dict[str, Any]]:
    """List proven open-air connections (§4.3, D15). Orphaned entries excluded."""
    result: list[dict[str, Any]] = []
    area_env = {annotation.area_id: annotation.environment for annotation in snapshot.areas}

    # Exterior connections only where side is set and beyond[side] == outdoor.
    for annotation in snapshot.areas:
        if annotation.orphaned_at is not None:
            continue
        beyond = {side.value: beyond_class for side, beyond_class in annotation.beyond}
        for index, connection in enumerate(annotation.exterior_connections):
            if connection.side is not None and beyond.get(connection.side.value) is BeyondClass.OUTDOOR:
                result.append(_facing_entry("exterior", None, annotation.area_id, index, connection))

    # Interior edges with exactly one environment==outdoor endpoint. Attribute
    # the entry to the NON-outdoor endpoint — the room whose opening faces
    # outside — not edge.area_a (which is just the lexicographically smaller id
    # and may be the outdoor area, e.g. balcony::bedroom). PR-review r3645648771.
    for edge in snapshot.edges:
        if edge.orphaned_at is not None:
            continue
        outdoor_a = area_env.get(edge.area_a) is Environment.OUTDOOR
        outdoor_b = area_env.get(edge.area_b) is Environment.OUTDOOR
        if outdoor_a is not outdoor_b:
            room_id = edge.area_b if outdoor_a else edge.area_a
            for index, connection in enumerate(edge.connections):
                result.append(_facing_entry("edge", edge.edge_id, room_id, index, connection))

    return result


def derive(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> TopologyDerived:
    """Build the full registry-merged projection cached on the coordinator (§7.3, §5)."""
    # Local import breaks the derivations <-> graph import cycle (graph needs
    # effective_level/is_perimeter_edge from here).
    from custom_components.topology.entity_utils.graph import build_graph  # noqa: PLC0415

    areas = derive_areas(snapshot, area_reg)
    house = derive_house(snapshot, area_reg, floor_reg)
    live_area_ids = frozenset(
        projection.area_id for projection in areas if projection.exists and not projection.orphaned
    )
    overrides = {override.floor_id: override for override in snapshot.floors}
    return TopologyDerived(
        house=house,
        areas=areas,
        live_area_ids=live_area_ids,
        perimeter=derive_perimeter_connections(snapshot, area_reg),
        graph=build_graph(snapshot, area_reg, floor_reg, overrides),
        consistency=derive_consistency(snapshot, area_reg, floor_reg),
    )


def build_health(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry | None = None,
) -> dict[str, Any]:
    """Compute the consistency/health signal (§4.11); Phase-4 lists filled.

    The single source of the ``health`` payload, shared by the WebSocket
    ``read_hook``/``health`` responses and the diagnostics export. The area counts
    and the four graph-consistency lists come from the shared derivations (§7.2,
    §3) so the household sensor, this signal, and the read hook never drift
    (decisions D6/D7).
    """
    registry_ids, unannotated_tuple, annotated_count = annotation_counts(snapshot, area_reg)
    unannotated = list(unannotated_tuple)

    orphaned_areas = sorted(a.area_id for a in snapshot.areas if a.orphaned_at is not None)
    orphaned_edges = sorted(e.edge_id for e in snapshot.edges if e.orphaned_at is not None)
    orphaned_floors = sorted(f.floor_id for f in snapshot.floors if f.orphaned_at is not None)
    unknown_enum_values = [
        {"scope": u.scope, "id": u.id, "field": u.field_name, "value": u.value} for u in snapshot.unknown_enum_values
    ]

    consistency = derive_consistency(snapshot, area_reg, floor_reg)
    isolated_areas = list(consistency.isolated_areas)
    indoor_areas_without_floor = list(consistency.indoor_areas_without_floor)
    contradictory_bearings = list(consistency.contradictory_bearings)
    exterior_on_non_outdoor_side = list(consistency.exterior_on_non_outdoor_side)
    edges_spanning_multiple_floors = list(consistency.edges_spanning_multiple_floors)
    vertical_edges_without_vertical_passage = list(consistency.vertical_edges_without_vertical_passage)

    lists = [
        unannotated,
        orphaned_edges,
        orphaned_areas,
        orphaned_floors,
        unknown_enum_values,
        isolated_areas,
        indoor_areas_without_floor,
        contradictory_bearings,
        exterior_on_non_outdoor_side,
        edges_spanning_multiple_floors,
        vertical_edges_without_vertical_passage,
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
        # Phase-4 graph-consistency lists (§3).
        "isolated_areas": isolated_areas,
        "indoor_areas_without_floor": indoor_areas_without_floor,
        "contradictory_bearings": contradictory_bearings,
        "exterior_on_non_outdoor_side": exterior_on_non_outdoor_side,
        # Edge-geometry advisories: these hold edge_ids, not area_ids.
        "edges_spanning_multiple_floors": edges_spanning_multiple_floors,
        "vertical_edges_without_vertical_passage": vertical_edges_without_vertical_passage,
    }
