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
    TRUST_ORDER,
    AreaProjection,
    BeyondClass,
    ConsistencyReport,
    Environment,
    HouseProjection,
    PerimeterConnection,
    TopologyDerived,
    Trust,
)
from homeassistant.util import slugify

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
        for index, connection in enumerate(edge.connections):
            yield "edge", edge.edge_id, edge.area_a, index, connection.sensor_entity_id


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


def derive_consistency(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> ConsistencyReport:
    """Compute the four graph-consistency lists (§3). Non-orphaned registry areas only."""
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
                edge_sides.setdefault(edge.area_a, set()).add(connection.side.value)
                edge_sides.setdefault(edge.area_b, set()).add(connection.side.value)
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

    return ConsistencyReport(
        isolated_areas=isolated,
        indoor_areas_without_floor=tuple(sorted(indoor_without_floor)),
        contradictory_bearings=tuple(sorted(contradictory)),
        exterior_on_non_outdoor_side=tuple(sorted(exterior_bad)),
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
        consistency=derive_consistency(snapshot, area_reg),
    )
