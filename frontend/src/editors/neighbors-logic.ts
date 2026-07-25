/**
 * Pure decision logic for the neighbours editor (Phase 7 §2.6), split out from
 * the component the way `first-run-logic` is — so the rules that decide *which*
 * areas may border each other and *how* one can be crossed are testable without
 * a DOM.
 *
 * Lit-free and panel-free on purpose: these are model rules, not presentation.
 */

import type { Passage, PresetOut } from "../api/types";

/** How a candidate area sits relative to the one being edited. */
export type Relation = "same" | "above" | "below" | "distant" | "unknown";

/** Passages that move a person between storeys. */
const VERTICAL_PASSAGES = new Set<Passage>(["stairs", "ramp", "elevator", "ladder", "hatch"]);

/**
 * Classify two areas by their effective floor levels.
 *
 * `null` on either side means the level cannot be resolved — an area with no
 * floor, or a floor with no level — which is `unknown`, never a guess. Levels are
 * only ever compared, so the absolute numbers and the local counting convention
 * (ground floor `0` or `1`) do not matter.
 */
export function relationFor(ownLevel: number | null, otherLevel: number | null): Relation {
  if (ownLevel === null || otherLevel === null) {
    return "unknown";
  }
  const delta = otherLevel - ownLevel;
  if (delta === 0) {
    return "same";
  }
  if (delta === 1) {
    return "above";
  }
  if (delta === -1) {
    return "below";
  }
  return "distant";
}

/**
 * The interior presets that can cross a boundary of the given relation.
 *
 * A same-floor boundary is crossed on the level; a boundary between storeys needs
 * stairs, a ramp, a lift, a ladder or a hatch. A `none` passage — a party wall or
 * a plain ceiling — fits either: it declares that two areas touch without any way
 * through. When the relation is `unknown` nothing can be ruled out, so everything
 * interior is offered.
 *
 * The axis comes from each preset's own `passage`, so this cannot drift from the
 * server table the way a hardcoded preset list would.
 */
export function presetsForRelation(presets: readonly PresetOut[], relation: Relation): PresetOut[] {
  const interior = presets.filter((preset) => preset.scope === "interior");
  if (relation === "unknown") {
    return interior;
  }
  const wantVertical = relation !== "same";
  return interior.filter(
    (preset) => preset.passage === "none" || VERTICAL_PASSAGES.has(preset.passage) === wantVertical,
  );
}

/**
 * Restate an edge's `level_delta` from one endpoint's point of view.
 *
 * The wire value is signed `area_a -> area_b`, and `area_a` is merely the
 * lexicographically smaller id, so reading it as "up" from whichever area the
 * user has open would be wrong half the time.
 */
export function deltaFrom(
  edge: { area_a: string; level_delta: number | null },
  areaId: string,
): number | null {
  if (edge.level_delta === null) {
    return null;
  }
  return edge.area_a === areaId ? edge.level_delta : -edge.level_delta;
}
