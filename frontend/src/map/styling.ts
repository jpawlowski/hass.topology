/**
 * Pure presentation mappings for the 2D map (Phase 7 §2.5). Kept free of Lit and
 * of any panel-only assumption (§4.2, D15) so the read-only render path — and a
 * future Lovelace card — reuse them unchanged. Every function is a total,
 * side-effect-free mapping from frozen-contract values to style tokens.
 */

import type { Barrier, ConnectionOut, EdgeOut, Environment, Passage, Trust } from "../api/types";

/** Trust → node tint token (mapped to a CSS custom property by the renderer). */
export function trustTint(trust: Trust | null): "private" | "shared" | "public" | "unknown" {
  return trust ?? "unknown";
}

/** Environment → indoor/outdoor styling token. `null` reads as needs-annotation. */
export function environmentClass(
  environment: Environment | null,
): "indoor" | "outdoor" | "semi_outdoor" | "unknown" {
  return environment ?? "unknown";
}

/** True when an area has no annotation dimensions at all (renders muted, §2.5). */
export function needsAnnotation(area: {
  type: string | null;
  environment: Environment | null;
  trust: Trust | null;
}): boolean {
  return area.type === null && area.environment === null && area.trust === null;
}

/**
 * Permeability rank of a barrier — higher is more permeable. Used to pick the
 * connection that dominates an edge's rendering (§2.5 "most-permeable").
 */
const BARRIER_PERMEABILITY: Record<Barrier, number> = {
  open: 2,
  door: 1,
  solid: 0,
};

/** Glyph token per passage kind (vertical movement affordances, §2.5). */
const PASSAGE_GLYPH: Record<Passage, string> = {
  none: "",
  level: "",
  stairs: "stairs",
  ramp: "ramp",
  elevator: "elevator",
  ladder: "ladder",
  hatch: "hatch",
};

export interface EdgeStyle {
  /** The barrier of the most-permeable connection (drives line style). */
  barrier: Barrier;
  /** The passage of the most-permeable connection. */
  passage: Passage;
  /** Optional vertical-movement glyph token (`""` for a plain horizontal edge). */
  glyph: string;
  /** Whether the edge is a derived perimeter edge (highlighted, §2.5). */
  perimeter: boolean;
}

/** Return the most-permeable connection of a bundle (ties: first wins). */
export function mostPermeableConnection(connections: ConnectionOut[]): ConnectionOut | null {
  let best: ConnectionOut | null = null;
  let bestRank = -1;
  for (const connection of connections) {
    const rank = BARRIER_PERMEABILITY[connection.barrier] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = connection;
    }
  }
  return best;
}

/**
 * Compute an edge's line style from its most-permeable connection and the
 * derived `is_perimeter` flag (§2.5). An empty bundle degrades to a solid,
 * glyph-less style so the renderer never crashes on malformed input.
 */
export function edgeStyle(edge: Pick<EdgeOut, "connections" | "is_perimeter">): EdgeStyle {
  const connection = mostPermeableConnection(edge.connections);
  if (connection === null) {
    return { barrier: "solid", passage: "none", glyph: "", perimeter: edge.is_perimeter };
  }
  return {
    barrier: connection.barrier,
    passage: connection.passage,
    glyph: PASSAGE_GLYPH[connection.passage] ?? "",
    perimeter: edge.is_perimeter,
  };
}
