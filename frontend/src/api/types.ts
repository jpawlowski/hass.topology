/**
 * TypeScript mirrors of the frozen WebSocket contract v1 (PLAN-topology-phase2.md
 * §4) that the panel consumes. These interfaces are hand-kept in sync with the
 * Python serializers in `custom_components/topology/websocket_api.py`.
 *
 * Card-reuse boundary (Phase 7 §4.2, D15): this module is panel-free — no Lit,
 * no route/panel props, no write-command or editor imports — so a future
 * read-only Lovelace card can import it unchanged.
 */

/** Area spatial environment (`data.Environment`). */
export type Environment = "indoor" | "outdoor" | "semi_outdoor";

/** Area trust level (`data.Trust`). */
export type Trust = "private" | "shared" | "public";

/** Connection passage kind (`data.Passage`). */
export type Passage =
  | "none"
  | "level"
  | "stairs"
  | "ramp"
  | "elevator"
  | "ladder"
  | "hatch";

/** Connection barrier kind (`data.Barrier`). */
export type Barrier = "open" | "door" | "solid";

/** Cardinal side of a wall (`data.CardinalSide`). */
export type CardinalSide = "N" | "E" | "S" | "W";

/** Beyond classification of an outer wall side (`data.BeyondClass`). */
export type BeyondClass = "outdoor" | "neighbor" | "earth";

/** Home occupancy extent (`data.OccupancyExtent`). */
export type OccupancyExtent = "whole_property" | "unit_within_building";

/** Derived edge axis (`_edge_out`). */
export type EdgeAxis = "horizontal" | "vertical" | "unknown";

/** Serialized connection (`connection_to_dict` / `ConnectionDict`). */
export interface ConnectionOut {
  passage: Passage;
  barrier: Barrier;
  side?: CardinalSide;
  sensor_entity_id?: string;
  glazed?: boolean;
  preset_name?: string;
  perimeter_override?: boolean;
  inline_trust?: Trust;
}

/** Serialized area annotation (`_area_out`). Enums are `null` when unknown. */
export interface AreaOut {
  area_id: string;
  type: string | null;
  environment: Environment | null;
  trust: Trust | null;
  beyond: Partial<Record<CardinalSide, BeyondClass>>;
  exterior_connections: ConnectionOut[];
  orphaned_at: string | null;
  updated_at: string;
}

/** Serialized interior edge (`_edge_out`). */
export interface EdgeOut {
  edge_id: string;
  area_a: string;
  area_b: string;
  axis: EdgeAxis;
  /**
   * Signed effective-level difference from `area_a` to `area_b`: positive means
   * `area_b` is the upper area, `null` when either side has no resolvable level.
   * `axis` says only *that* an edge is vertical, never which way is up.
   */
  level_delta: number | null;
  is_perimeter: boolean;
  connections: ConnectionOut[];
  orphaned_at: string | null;
  created_at: string;
}

/** Serialized floor with merged registry level + override (`_serialize_floors`). */
export interface FloorOut {
  floor_id: string;
  registry_level: number | null;
  level_override: number | null;
  effective_level: number | null;
}

/** Where a preset may be used (`data.PresetScope`). */
export type PresetScope = "interior" | "exterior";

/** Serialized preset row from the shipped table (`_serialize_presets`). */
export interface PresetOut {
  preset_name: string;
  passage: Passage;
  barrier: Barrier;
  glazed_default: boolean;
  sensor_allowed: boolean;
  /** Interior (between two areas) vs exterior (window / outside door). */
  scope: PresetScope;
}

/**
 * Shipped area-type catalog + cascade (`_serialize_area_types`). The catalog is
 * open — any string is a legal `type` — these are the suggestions, and the
 * cascade is what each one pre-fills for `environment`/`trust`.
 */
export interface AreaTypesOut {
  catalog: string[];
  cascade: Record<string, { environment: Environment | null; trust: Trust | null }>;
}

/** Serialized home config (`_serialize_home_config`). */
export interface HomeConfigOut {
  occupancy_extent: OccupancyExtent;
  projection_toggles: { environment: boolean; type: boolean; trust: boolean };
  imports_done_at: { aliases: string | null; labels: string | null };
  unannotated_repair_threshold: number;
}

/** Full `topology/list_annotations` result — the panel snapshot (§4.1). */
export interface ListAnnotationsResult {
  home_config: HomeConfigOut;
  areas: AreaOut[];
  edges: EdgeOut[];
  /** Ordered highest `effective_level` first; unlevelled floors last. */
  floors: FloorOut[];
  presets: PresetOut[];
  area_types: AreaTypesOut;
}

/** `topology/health` result (`build_health`). */
export interface HealthResult {
  status: "ok" | "warning";
  area_count: number;
  annotated_count: number;
  unannotated_areas: string[];
  orphaned_edges: string[];
  orphaned_areas: string[];
  orphaned_floors: string[];
  unknown_enum_values: { scope: string; id: string; field: string; value: string }[];
  isolated_areas: string[];
  indoor_areas_without_floor: string[];
  contradictory_bearings: string[];
  exterior_on_non_outdoor_side: string[];
  /** Edge ids, not area ids: an implausible boundary belongs to neither room. */
  edges_spanning_multiple_floors: string[];
  vertical_edges_without_vertical_passage: string[];
}

/** `topology/subscribe_updates` event payload (§4.12). */
export interface UpdateEvent {
  change: string;
  ids: string[];
}

/** Partial annotation accepted by `topology/update_area` (§4.2). */
export interface AreaAnnotationPatch {
  type?: string | null;
  environment?: Environment | null;
  trust?: Trust | null;
}

/** Home-config patch accepted by `topology/update_home_config` (§4.9). */
export interface HomeConfigPatch {
  occupancy_extent?: OccupancyExtent;
  projection_toggles?: { environment?: boolean; type?: boolean; trust?: boolean };
  unannotated_repair_threshold?: number;
}

/** A frozen WS error code surfaced as a typed rejection (§4). */
export type TopologyErrorCode =
  | "not_loaded"
  | "area_not_found"
  | "edge_not_found"
  | "floor_not_found"
  | "invalid_enum"
  | "invalid_connection"
  | "store_error"
  | "unauthorized";
