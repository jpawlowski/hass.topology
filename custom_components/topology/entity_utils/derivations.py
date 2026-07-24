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
    Environment,
    HouseProjection,
    TopologyDerived,
    Trust,
)
from homeassistant.util import slugify

if TYPE_CHECKING:
    from custom_components.topology.data import Edge, FloorOverride, TopologySnapshot
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


def derive_perimeter(snapshot: TopologySnapshot, area_reg: AreaRegistry) -> list[dict[str, Any]]:
    """Derive the perimeter-connection list (§4.10). Orphaned entries excluded."""
    perimeter: list[dict[str, Any]] = []
    area_trust = {annotation.area_id: annotation.trust for annotation in snapshot.areas}

    # Exterior connections: trust vs inline_trust (absent => public).
    for annotation in snapshot.areas:
        if annotation.orphaned_at is not None:
            continue
        for index, connection in enumerate(annotation.exterior_connections):
            inline = connection.inline_trust or Trust.PUBLIC
            owner_trust = annotation.trust
            if owner_trust is None or TRUST_ORDER[owner_trust] != TRUST_ORDER[inline]:
                perimeter.append(
                    {
                        "source": "exterior",
                        "edge_id": None,
                        "area_id": annotation.area_id,
                        "connection_index": index,
                        "sensor_entity_id": connection.sensor_entity_id,
                    }
                )

    # Interior edges whose sides differ in trust (or carry perimeter_override).
    for edge in snapshot.edges:
        if edge.orphaned_at is not None or not is_perimeter_edge(edge, area_trust):
            continue
        for index, connection in enumerate(edge.connections):
            perimeter.append(
                {
                    "source": "edge",
                    "edge_id": edge.edge_id,
                    "area_id": edge.area_a,
                    "connection_index": index,
                    "sensor_entity_id": connection.sensor_entity_id,
                }
            )

    return perimeter


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


def derive(
    snapshot: TopologySnapshot,
    area_reg: AreaRegistry,
    floor_reg: FloorRegistry,
) -> TopologyDerived:
    """Build the full registry-merged projection cached on the coordinator (§7.3)."""
    areas = derive_areas(snapshot, area_reg)
    house = derive_house(snapshot, area_reg, floor_reg)
    live_area_ids = frozenset(
        projection.area_id for projection in areas if projection.exists and not projection.orphaned
    )
    return TopologyDerived(house=house, areas=areas, live_area_ids=live_area_ids)
