"""
Typed runtime data and domain model for topology.

This module is the single source of truth for the topology data model
(PLAN-topology-phase2.md §6): the frozen enum catalog (§3), the store-shape
TypedDicts (wire format, §2.2), the frozen in-memory dataclasses, and the
converters between them.

Converter discipline (§2.4):
- ``*_from_dict`` are LENIENT on closed enums: an out-of-catalog value becomes
  ``None`` on the dataclass and is collected into an ``UnknownEnumValue`` list.
- ``*_to_dict`` are STRICT and lossless: a field the dataclass holds as ``None``
  because of an unknown raw value is re-emitted from the raw dict (round-trip
  safety), hence the optional ``raw`` parameter.
- ``type`` is an open catalog (§2.4 rule 5): any string is legal, never
  "unknown"; it is passed through verbatim.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, NotRequired, TypedDict

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry

    from .coordinator import TopologyCoordinator
    from .store import TopologyStore


type TopologyConfigEntry = ConfigEntry[TopologyRuntimeData]


# --- enums (frozen catalog, §3) --------------------------------------------


class Environment(StrEnum):
    """Enclosure class of an area (§3.2)."""

    INDOOR = "indoor"
    OUTDOOR = "outdoor"
    SEMI_OUTDOOR = "semi_outdoor"


class Trust(StrEnum):
    """Access-trust class (§3.3), ordered private < shared < public."""

    PRIVATE = "private"
    SHARED = "shared"
    PUBLIC = "public"


TRUST_ORDER: dict[Trust, int] = {Trust.PRIVATE: 0, Trust.SHARED: 1, Trust.PUBLIC: 2}


class Passage(StrEnum):
    """How a person crosses between two areas (§3.4)."""

    NONE = "none"
    LEVEL = "level"
    STAIRS = "stairs"
    RAMP = "ramp"
    ELEVATOR = "elevator"
    LADDER = "ladder"
    HATCH = "hatch"


class Barrier(StrEnum):
    """What separates two areas at a connection (§3.5)."""

    OPEN = "open"
    DOOR = "door"
    SOLID = "solid"


class CardinalSide(StrEnum):
    """Rough cardinal bearing of a wall/opening (§3.6)."""

    N = "N"
    E = "E"
    S = "S"
    W = "W"


class BeyondClass(StrEnum):
    """What lies beyond an outer wall side (§3.7)."""

    OUTDOOR = "outdoor"
    NEIGHBOR = "neighbor"
    EARTH = "earth"


class OccupancyExtent(StrEnum):
    """Whether the modeled home is standalone or a unit in a building (§3.8)."""

    WHOLE_PROPERTY = "whole_property"
    UNIT_WITHIN_BUILDING = "unit_within_building"


# Ordering used to serialize ``beyond`` deterministically.
_CARDINAL_ORDER: dict[CardinalSide, int] = {
    CardinalSide.N: 0,
    CardinalSide.E: 1,
    CardinalSide.S: 2,
    CardinalSide.W: 3,
}

# Open catalog of area types (§3.1) — shipped defaults, any string is legal.
AREA_TYPE_CATALOG: tuple[str, ...] = (
    "bedroom",
    "living",
    "kitchen",
    "dining",
    "bathroom",
    "hallway",
    "office",
    "utility",
    "storage",
    "garage",
    "balcony",
    "terrace",
    "outdoor",
)

# Type-cascade defaults (§3.1): picking a type pre-fills environment + trust.
# ``None`` for trust means "no default" (trust stays individual, §1).
TYPE_CASCADE: dict[str, tuple[Environment | None, Trust | None]] = {
    "bedroom": (Environment.INDOOR, Trust.PRIVATE),
    "living": (Environment.INDOOR, Trust.PRIVATE),
    "kitchen": (Environment.INDOOR, Trust.PRIVATE),
    "dining": (Environment.INDOOR, Trust.PRIVATE),
    "bathroom": (Environment.INDOOR, Trust.PRIVATE),
    "hallway": (Environment.INDOOR, Trust.SHARED),
    "office": (Environment.INDOOR, Trust.PRIVATE),
    "utility": (Environment.INDOOR, Trust.PRIVATE),
    "storage": (Environment.INDOOR, Trust.PRIVATE),
    "garage": (Environment.INDOOR, Trust.PRIVATE),
    "balcony": (Environment.SEMI_OUTDOOR, None),
    "terrace": (Environment.OUTDOOR, None),
    "outdoor": (Environment.OUTDOOR, None),
}


class ConnectionPreset(StrEnum):
    """Connection presets that expand into the two-axis form (§3.9)."""

    INTERIOR_DOOR = "interior_door"
    OPEN_PASSAGE = "open_passage"
    SHARED_WALL = "shared_wall"
    OPEN_STAIR = "open_stair"
    ENCLOSED_STAIR = "enclosed_stair"
    LIFT = "lift"
    LOFT_LADDER = "loft_ladder"
    RAMP = "ramp"
    WINDOW = "window"
    OUTSIDE_DOOR = "outside_door"


@dataclass(frozen=True, kw_only=True, slots=True)
class PresetDefinition:
    """Frozen expansion of a connection preset (§3.9)."""

    preset: ConnectionPreset
    passage: Passage
    barrier: Barrier
    glazed_default: bool
    sensor_allowed: bool


CONNECTION_PRESETS: dict[ConnectionPreset, PresetDefinition] = {
    ConnectionPreset.INTERIOR_DOOR: PresetDefinition(
        preset=ConnectionPreset.INTERIOR_DOOR,
        passage=Passage.LEVEL,
        barrier=Barrier.DOOR,
        glazed_default=False,
        sensor_allowed=True,
    ),
    ConnectionPreset.OPEN_PASSAGE: PresetDefinition(
        preset=ConnectionPreset.OPEN_PASSAGE,
        passage=Passage.LEVEL,
        barrier=Barrier.OPEN,
        glazed_default=False,
        sensor_allowed=False,
    ),
    ConnectionPreset.SHARED_WALL: PresetDefinition(
        preset=ConnectionPreset.SHARED_WALL,
        passage=Passage.NONE,
        barrier=Barrier.SOLID,
        glazed_default=False,
        sensor_allowed=False,
    ),
    ConnectionPreset.OPEN_STAIR: PresetDefinition(
        preset=ConnectionPreset.OPEN_STAIR,
        passage=Passage.STAIRS,
        barrier=Barrier.OPEN,
        glazed_default=False,
        sensor_allowed=False,
    ),
    ConnectionPreset.ENCLOSED_STAIR: PresetDefinition(
        preset=ConnectionPreset.ENCLOSED_STAIR,
        passage=Passage.STAIRS,
        barrier=Barrier.DOOR,
        glazed_default=False,
        sensor_allowed=True,
    ),
    ConnectionPreset.LIFT: PresetDefinition(
        preset=ConnectionPreset.LIFT,
        passage=Passage.ELEVATOR,
        barrier=Barrier.DOOR,
        glazed_default=False,
        sensor_allowed=True,
    ),
    ConnectionPreset.LOFT_LADDER: PresetDefinition(
        preset=ConnectionPreset.LOFT_LADDER,
        passage=Passage.LADDER,
        barrier=Barrier.DOOR,
        glazed_default=False,
        sensor_allowed=True,
    ),
    ConnectionPreset.RAMP: PresetDefinition(
        preset=ConnectionPreset.RAMP,
        passage=Passage.RAMP,
        barrier=Barrier.OPEN,
        glazed_default=False,
        sensor_allowed=False,
    ),
    ConnectionPreset.WINDOW: PresetDefinition(
        preset=ConnectionPreset.WINDOW,
        passage=Passage.NONE,
        barrier=Barrier.DOOR,
        glazed_default=True,
        sensor_allowed=True,
    ),
    ConnectionPreset.OUTSIDE_DOOR: PresetDefinition(
        preset=ConnectionPreset.OUTSIDE_DOOR,
        passage=Passage.LEVEL,
        barrier=Barrier.DOOR,
        glazed_default=False,
        sensor_allowed=True,
    ),
}


# --- store-shape TypedDicts (wire format, §2.2) ----------------------------


class ConnectionDict(TypedDict):
    """Store shape of a single connection (§2.2 connection)."""

    passage: str
    barrier: str
    side: NotRequired[str]
    sensor_entity_id: NotRequired[str]
    glazed: NotRequired[bool]
    preset_name: NotRequired[str]
    perimeter_override: NotRequired[bool]
    inline_trust: NotRequired[str]


class EdgeDict(TypedDict):
    """Store shape of an interior edge (§2.2 edge)."""

    area_a: str
    area_b: str
    connections: list[ConnectionDict]
    created_at: str
    orphaned_at: NotRequired[str]


class AreaAnnotationDict(TypedDict):
    """Store shape of an area annotation (§2.2 area_annotation)."""

    type: NotRequired[str | None]
    environment: NotRequired[str | None]
    trust: NotRequired[str | None]
    beyond: NotRequired[dict[str, str]]
    exterior_connections: NotRequired[list[ConnectionDict]]
    updated_at: str
    orphaned_at: NotRequired[str]


class FloorOverrideDict(TypedDict):
    """Store shape of a floor-level override (§2.2 floor_override)."""

    level_override: int | None
    updated_at: str
    orphaned_at: NotRequired[str]


class ProjectionTogglesDict(TypedDict):
    """Store shape of the projection toggles (§2.2 home_config)."""

    environment: bool
    type: bool
    trust: bool


class ImportsDoneAtDict(TypedDict):
    """Store shape of the one-shot import timestamps (§2.2 home_config)."""

    aliases: str | None
    labels: str | None


class HomeConfigDict(TypedDict):
    """Store shape of the home-level config (§2.2 home_config)."""

    occupancy_extent: str
    projection_toggles: ProjectionTogglesDict
    imports_done_at: ImportsDoneAtDict
    unannotated_repair_threshold: int


class TopologyStoreData(TypedDict):
    """Top-level store payload (§2.2)."""

    schema_version: int
    home_config: HomeConfigDict
    areas: dict[str, AreaAnnotationDict]
    edges: dict[str, EdgeDict]
    floors: dict[str, FloorOverrideDict]


# --- frozen domain dataclasses (in-memory model) ---------------------------


@dataclass(frozen=True, kw_only=True, slots=True)
class Connection:
    """A single connection (a bundle member of an edge or an exterior list)."""

    passage: Passage
    barrier: Barrier
    side: CardinalSide | None = None
    sensor_entity_id: str | None = None
    glazed: bool = False
    preset_name: str | None = None
    perimeter_override: bool = False
    inline_trust: Trust | None = None  # exterior_connections only


@dataclass(frozen=True, kw_only=True, slots=True)
class Edge:
    """An interior adjacency between two areas (a bundle of connections)."""

    edge_id: str
    area_a: str
    area_b: str
    connections: tuple[Connection, ...]
    created_at: str  # ISO 8601 UTC
    orphaned_at: str | None = None


@dataclass(frozen=True, kw_only=True, slots=True)
class AreaAnnotation:
    """The topology annotation of a single registry area."""

    area_id: str
    type: str | None = None  # open catalog — plain str
    environment: Environment | None = None
    trust: Trust | None = None
    beyond: tuple[tuple[CardinalSide, BeyondClass], ...] = ()
    exterior_connections: tuple[Connection, ...] = ()
    updated_at: str = ""
    orphaned_at: str | None = None


@dataclass(frozen=True, kw_only=True, slots=True)
class FloorOverride:
    """Store-side completion of a registry floor's level."""

    floor_id: str
    level_override: int | None = None  # consulted only while registry level is None
    updated_at: str = ""
    orphaned_at: str | None = None


@dataclass(frozen=True, kw_only=True, slots=True)
class HomeConfig:
    """Home-level configuration mirrored from the config entry into the store."""

    occupancy_extent: OccupancyExtent = OccupancyExtent.WHOLE_PROPERTY
    project_environment: bool = False
    project_type: bool = False
    project_trust: bool = False
    imports_done_at_aliases: str | None = None
    imports_done_at_labels: str | None = None
    unannotated_repair_threshold: int = 3  # DEFAULT_UNANNOTATED_REPAIR_THRESHOLD


@dataclass(frozen=True, kw_only=True, slots=True)
class UnknownEnumValue:
    """A stored closed-enum value outside the v1 catalog (§2.4)."""

    scope: str  # "area" | "edge" | "home_config"
    id: str
    field_name: str
    value: str


@dataclass(frozen=True, kw_only=True, slots=True)
class TopologySnapshot:
    """Immutable view of the store served by coordinator + read hook."""

    home_config: HomeConfig
    areas: tuple[AreaAnnotation, ...]
    edges: tuple[Edge, ...]
    floors: tuple[FloorOverride, ...]
    unknown_enum_values: tuple[UnknownEnumValue, ...]


@dataclass(frozen=True, kw_only=True, slots=True)
class TopologyRuntimeData:
    """Runtime data attached to the config entry (§6)."""

    store: TopologyStore
    coordinator: TopologyCoordinator


# --- registry-merged entity read model (Phase 3, §7.1) ---------------------
# Entities may not read the area/floor registry directly (AGENTS.md layering);
# the coordinator merges the registry into these projections and caches them so
# entities read only from ``coordinator.derived``.


@dataclass(frozen=True, kw_only=True, slots=True)
class AreaProjection:
    """Registry-merged, entity-facing view of one area (§7.1)."""

    area_id: str
    name: str  # registry area name at derive time (display/UI)
    slug: str  # slugify(name) — the entity-id slug (§4.3), so the platform
    # never reads the registry (decision D16)
    exists: bool  # present in the area registry right now
    orphaned: bool  # store annotation flagged orphaned
    type: str | None = None
    environment: Environment | None = None
    trust: Trust | None = None


@dataclass(frozen=True, kw_only=True, slots=True)
class HouseProjection:
    """The house sensor's inputs — identical to the health counts (§7.2, D6)."""

    occupancy_extent: OccupancyExtent
    area_count: int
    annotated_count: int
    unannotated_areas: tuple[str, ...]
    perimeter_connection_count: int
    outdoor_area_count: int
    floor_count: int


# --- Phase 4 aggregates + derivations (PLAN-topology-phase4.md §5) ----------


@dataclass(frozen=True, kw_only=True, slots=True)
class PerimeterConnection:
    """A derived perimeter connection with its bound sensor (§2, §4.10)."""

    source: str  # "edge" | "exterior"
    edge_id: str | None
    area_id: str
    connection_index: int
    sensor_entity_id: str | None


@dataclass(frozen=True, kw_only=True, slots=True)
class Neighbor:
    """An adjacent area reached over one non-orphaned interior edge (§4.1)."""

    area_id: str
    edge_id: str
    axis: str  # "horizontal" | "vertical" | "unknown"
    is_perimeter: bool
    traversable: bool


@dataclass(frozen=True, kw_only=True, slots=True)
class GraphView:
    """Adjacency over non-orphaned interior edges (§4)."""

    adjacency: dict[str, tuple[Neighbor, ...]]  # area_id -> neighbours


@dataclass(frozen=True, kw_only=True, slots=True)
class ConsistencyReport:
    """The four Phase-4 graph-consistency lists (§3), each sorted area_ids."""

    isolated_areas: tuple[str, ...]
    indoor_areas_without_floor: tuple[str, ...]
    contradictory_bearings: tuple[str, ...]
    exterior_on_non_outdoor_side: tuple[str, ...]


@dataclass(frozen=True, kw_only=True, slots=True)
class TopologyDerived:
    """Registry-merged projection cached on the coordinator (§7.3, §5)."""

    house: HouseProjection
    areas: tuple[AreaProjection, ...]
    live_area_ids: frozenset[str]  # registry areas, non-orphaned
    perimeter: tuple[PerimeterConnection, ...]
    graph: GraphView
    consistency: ConsistencyReport


# --- converters store-dict <-> dataclass -----------------------------------


def _coerce_enum[E: StrEnum](enum_cls: type[E], value: object) -> E | None:
    """Return the enum member for ``value`` or ``None`` if outside the catalog."""
    if value is None:
        return None
    try:
        return enum_cls(value)
    except ValueError:
        return None


def edge_id_for(area_a: str, area_b: str) -> str:
    """Return the deterministic edge id for an unordered area pair (§2.2)."""
    lo, hi = sorted((area_a, area_b))
    return f"{lo}::{hi}"


def connection_from_dict(raw: ConnectionDict) -> tuple[Connection, list[UnknownEnumValue]]:
    """Parse a store connection dict into a ``Connection`` (lenient on enums).

    Returned ``UnknownEnumValue`` entries carry an empty scope/id; the calling
    container converter fills those in with the owning area/edge id.
    """
    unknowns: list[UnknownEnumValue] = []

    passage = _coerce_enum(Passage, raw.get("passage"))
    if passage is None:
        unknowns.append(UnknownEnumValue(scope="", id="", field_name="passage", value=str(raw.get("passage"))))
        passage = Passage.NONE  # conservative: not traversable

    barrier = _coerce_enum(Barrier, raw.get("barrier"))
    if barrier is None:
        unknowns.append(UnknownEnumValue(scope="", id="", field_name="barrier", value=str(raw.get("barrier"))))
        barrier = Barrier.SOLID  # conservative: treat as a wall

    side = _coerce_enum(CardinalSide, raw.get("side"))
    if raw.get("side") is not None and side is None:
        unknowns.append(UnknownEnumValue(scope="", id="", field_name="side", value=str(raw.get("side"))))

    inline_trust = _coerce_enum(Trust, raw.get("inline_trust"))
    if raw.get("inline_trust") is not None and inline_trust is None:
        unknowns.append(
            UnknownEnumValue(scope="", id="", field_name="inline_trust", value=str(raw.get("inline_trust")))
        )

    connection = Connection(
        passage=passage,
        barrier=barrier,
        side=side,
        sensor_entity_id=raw.get("sensor_entity_id"),
        glazed=raw.get("glazed", False),
        preset_name=raw.get("preset_name"),
        perimeter_override=raw.get("perimeter_override", False),
        inline_trust=inline_trust,
    )
    return connection, unknowns


def connection_to_dict(connection: Connection, raw: ConnectionDict | None = None) -> ConnectionDict:
    """Serialize a ``Connection`` to its store shape, re-emitting unknown raws."""
    out: ConnectionDict = {
        "passage": connection.passage.value,
        "barrier": connection.barrier.value,
    }
    raw_passage = raw.get("passage") if raw is not None else None
    if raw_passage is not None and _coerce_enum(Passage, raw_passage) is None:
        out["passage"] = raw_passage
    raw_barrier = raw.get("barrier") if raw is not None else None
    if raw_barrier is not None and _coerce_enum(Barrier, raw_barrier) is None:
        out["barrier"] = raw_barrier

    raw_side = raw.get("side") if raw is not None else None
    if connection.side is not None:
        out["side"] = connection.side.value
    elif raw_side is not None:
        out["side"] = raw_side

    if connection.sensor_entity_id is not None:
        out["sensor_entity_id"] = connection.sensor_entity_id
    if connection.glazed:
        out["glazed"] = True
    if connection.preset_name is not None:
        out["preset_name"] = connection.preset_name
    if connection.perimeter_override:
        out["perimeter_override"] = True

    raw_inline = raw.get("inline_trust") if raw is not None else None
    if connection.inline_trust is not None:
        out["inline_trust"] = connection.inline_trust.value
    elif raw_inline is not None:
        out["inline_trust"] = raw_inline

    return out


def _connections_from_list(
    raw_list: list[ConnectionDict],
    scope: str,
    owner_id: str,
    field_prefix: str,
) -> tuple[tuple[Connection, ...], list[UnknownEnumValue]]:
    """Parse a list of connection dicts, rescoping any unknown-enum entries."""
    connections: list[Connection] = []
    unknowns: list[UnknownEnumValue] = []
    for index, raw in enumerate(raw_list):
        connection, conn_unknowns = connection_from_dict(raw)
        connections.append(connection)
        unknowns.extend(
            UnknownEnumValue(
                scope=scope,
                id=owner_id,
                field_name=f"{field_prefix}[{index}].{unknown.field_name}",
                value=unknown.value,
            )
            for unknown in conn_unknowns
        )
    return tuple(connections), unknowns


def edge_from_dict(edge_id: str, raw: EdgeDict) -> tuple[Edge, list[UnknownEnumValue]]:
    """Parse a store edge dict into an ``Edge`` (lenient on connection enums)."""
    connections, unknowns = _connections_from_list(raw["connections"], "edge", edge_id, "connections")
    edge = Edge(
        edge_id=edge_id,
        area_a=raw["area_a"],
        area_b=raw["area_b"],
        connections=connections,
        created_at=raw["created_at"],
        orphaned_at=raw.get("orphaned_at"),
    )
    return edge, unknowns


def edge_to_dict(edge: Edge, raw: EdgeDict | None = None) -> EdgeDict:
    """Serialize an ``Edge`` to its store shape (edge_id is the dict key)."""
    raw_connections = raw["connections"] if raw is not None else None
    out: EdgeDict = {
        "area_a": edge.area_a,
        "area_b": edge.area_b,
        "connections": [
            connection_to_dict(
                connection,
                raw_connections[index] if raw_connections is not None and index < len(raw_connections) else None,
            )
            for index, connection in enumerate(edge.connections)
        ],
        "created_at": edge.created_at,
    }
    if edge.orphaned_at is not None:
        out["orphaned_at"] = edge.orphaned_at
    return out


def _beyond_from_dict(
    raw: dict[str, str],
    owner_id: str,
) -> tuple[tuple[tuple[CardinalSide, BeyondClass], ...], list[UnknownEnumValue]]:
    """Parse the ``beyond`` mapping into ordered (side, class) pairs."""
    pairs: list[tuple[CardinalSide, BeyondClass]] = []
    unknowns: list[UnknownEnumValue] = []
    for raw_side, raw_class in raw.items():
        side = _coerce_enum(CardinalSide, raw_side)
        beyond_class = _coerce_enum(BeyondClass, raw_class)
        if side is None:
            unknowns.append(UnknownEnumValue(scope="area", id=owner_id, field_name="beyond.side", value=str(raw_side)))
            continue
        if beyond_class is None:
            unknowns.append(
                UnknownEnumValue(scope="area", id=owner_id, field_name=f"beyond.{side.value}", value=str(raw_class))
            )
            continue
        pairs.append((side, beyond_class))
    pairs.sort(key=lambda pair: _CARDINAL_ORDER[pair[0]])
    return tuple(pairs), unknowns


def area_annotation_from_dict(area_id: str, raw: AreaAnnotationDict) -> tuple[AreaAnnotation, list[UnknownEnumValue]]:
    """Parse a store area annotation into an ``AreaAnnotation`` (lenient)."""
    unknowns: list[UnknownEnumValue] = []

    environment = _coerce_enum(Environment, raw.get("environment"))
    if raw.get("environment") is not None and environment is None:
        unknowns.append(
            UnknownEnumValue(scope="area", id=area_id, field_name="environment", value=str(raw.get("environment")))
        )

    trust = _coerce_enum(Trust, raw.get("trust"))
    if raw.get("trust") is not None and trust is None:
        unknowns.append(UnknownEnumValue(scope="area", id=area_id, field_name="trust", value=str(raw.get("trust"))))

    beyond, beyond_unknowns = _beyond_from_dict(raw.get("beyond", {}), area_id)
    unknowns.extend(beyond_unknowns)

    exterior, exterior_unknowns = _connections_from_list(
        raw.get("exterior_connections", []), "area", area_id, "exterior_connections"
    )
    unknowns.extend(exterior_unknowns)

    annotation = AreaAnnotation(
        area_id=area_id,
        type=raw.get("type"),
        environment=environment,
        trust=trust,
        beyond=beyond,
        exterior_connections=exterior,
        updated_at=raw.get("updated_at", ""),
        orphaned_at=raw.get("orphaned_at"),
    )
    return annotation, unknowns


def area_annotation_to_dict(annotation: AreaAnnotation, raw: AreaAnnotationDict | None = None) -> AreaAnnotationDict:
    """Serialize an ``AreaAnnotation`` to its store shape, re-emitting unknowns."""
    out: AreaAnnotationDict = {"updated_at": annotation.updated_at}

    if annotation.type is not None:
        out["type"] = annotation.type

    raw_env = raw.get("environment") if raw is not None else None
    if annotation.environment is not None:
        out["environment"] = annotation.environment.value
    elif raw_env is not None:
        out["environment"] = raw_env

    raw_trust = raw.get("trust") if raw is not None else None
    if annotation.trust is not None:
        out["trust"] = annotation.trust.value
    elif raw_trust is not None:
        out["trust"] = raw_trust

    if annotation.beyond:
        out["beyond"] = {side.value: beyond_class.value for side, beyond_class in annotation.beyond}

    if annotation.exterior_connections:
        raw_ext = raw.get("exterior_connections") if raw is not None else None
        out["exterior_connections"] = [
            connection_to_dict(
                connection,
                raw_ext[index] if raw_ext is not None and index < len(raw_ext) else None,
            )
            for index, connection in enumerate(annotation.exterior_connections)
        ]

    if annotation.orphaned_at is not None:
        out["orphaned_at"] = annotation.orphaned_at
    return out


def home_config_from_dict(raw: HomeConfigDict) -> tuple[HomeConfig, list[UnknownEnumValue]]:
    """Parse the store home_config into a ``HomeConfig`` (lenient on extent)."""
    unknowns: list[UnknownEnumValue] = []

    occupancy_extent = _coerce_enum(OccupancyExtent, raw.get("occupancy_extent"))
    if occupancy_extent is None:
        if raw.get("occupancy_extent") is not None:
            unknowns.append(
                UnknownEnumValue(
                    scope="home_config",
                    id="home_config",
                    field_name="occupancy_extent",
                    value=str(raw.get("occupancy_extent")),
                )
            )
        occupancy_extent = OccupancyExtent.WHOLE_PROPERTY

    toggles = raw.get("projection_toggles", {})
    imports = raw.get("imports_done_at", {})

    config = HomeConfig(
        occupancy_extent=occupancy_extent,
        project_environment=toggles.get("environment", False),
        project_type=toggles.get("type", False),
        project_trust=toggles.get("trust", False),
        imports_done_at_aliases=imports.get("aliases"),
        imports_done_at_labels=imports.get("labels"),
        unannotated_repair_threshold=raw.get("unannotated_repair_threshold", 3),
    )
    return config, unknowns


def home_config_to_dict(config: HomeConfig, raw: HomeConfigDict | None = None) -> HomeConfigDict:
    """Serialize a ``HomeConfig`` to its store shape, re-emitting unknown extent."""
    occupancy_extent = config.occupancy_extent.value
    if (
        raw is not None
        and _coerce_enum(OccupancyExtent, raw.get("occupancy_extent")) is None
        and raw.get("occupancy_extent") is not None
    ):
        occupancy_extent = raw["occupancy_extent"]

    return {
        "occupancy_extent": occupancy_extent,
        "projection_toggles": {
            "environment": config.project_environment,
            "type": config.project_type,
            "trust": config.project_trust,
        },
        "imports_done_at": {
            "aliases": config.imports_done_at_aliases,
            "labels": config.imports_done_at_labels,
        },
        "unannotated_repair_threshold": config.unannotated_repair_threshold,
    }


def floor_override_from_dict(floor_id: str, raw: FloorOverrideDict) -> FloorOverride:
    """Parse a store floor override into a ``FloorOverride`` (no enums)."""
    return FloorOverride(
        floor_id=floor_id,
        level_override=raw.get("level_override"),
        updated_at=raw.get("updated_at", ""),
        orphaned_at=raw.get("orphaned_at"),
    )


def floor_override_to_dict(override: FloorOverride) -> FloorOverrideDict:
    """Serialize a ``FloorOverride`` to its store shape (floor_id is the key)."""
    out: FloorOverrideDict = {
        "level_override": override.level_override,
        "updated_at": override.updated_at,
    }
    if override.orphaned_at is not None:
        out["orphaned_at"] = override.orphaned_at
    return out


def snapshot_from_store(data: TopologyStoreData) -> TopologySnapshot:
    """Build the immutable snapshot from a full store payload, collecting unknowns."""
    unknowns: list[UnknownEnumValue] = []

    home_config, home_unknowns = home_config_from_dict(data["home_config"])
    unknowns.extend(home_unknowns)

    areas: list[AreaAnnotation] = []
    for area_id, raw_area in data["areas"].items():
        annotation, area_unknowns = area_annotation_from_dict(area_id, raw_area)
        areas.append(annotation)
        unknowns.extend(area_unknowns)

    edges: list[Edge] = []
    for edge_id, raw_edge in data["edges"].items():
        edge, edge_unknowns = edge_from_dict(edge_id, raw_edge)
        edges.append(edge)
        unknowns.extend(edge_unknowns)

    floors = [floor_override_from_dict(floor_id, raw_floor) for floor_id, raw_floor in data["floors"].items()]

    return TopologySnapshot(
        home_config=home_config,
        areas=tuple(areas),
        edges=tuple(edges),
        floors=tuple(floors),
        unknown_enum_values=tuple(unknowns),
    )
