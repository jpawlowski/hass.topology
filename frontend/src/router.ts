/**
 * Deep-link + in-panel router (Phase 7 §2.2). Frontend-only: no backend command
 * backs a deep-link — the `?focus=<scope>` query is parsed client-side and drives
 * which view opens and which areas/edges are flagged from the live `health`
 * lists. Pure and Lit-free so it is unit-testable and card-reusable.
 */

/** The deep-link scopes (§2.2 / §3.1). */
export type FocusScope =
  | "unannotated"
  | "isolated"
  | "floors"
  | "bearings"
  | "exterior"
  /**
   * The two edge-geometry advisories share this scope: it lists the flagged
   * *edges* rather than areas, because an implausible boundary belongs to
   * neither room on its own.
   */
  | "geometry"
  | "orphans";

/**
 * The panel views a route resolves to.
 *
 * There is deliberately no `exterior` view: the exterior scope flags areas on the
 * map and in the sidebar list, exactly like `unannotated` and `bearings` do, and
 * the per-area editor is where an opening is actually edited. A separate view
 * value existed before and resolved to nothing at all.
 */
export type PanelView = "map" | "floors" | "orphans";

export interface RouteState {
  /** The resolved primary view. */
  view: PanelView;
  /** The active focus scope, or `null` for the default map view. */
  focus: FocusScope | null;
}

const FOCUS_SCOPES: readonly FocusScope[] = [
  "unannotated",
  "isolated",
  "floors",
  "bearings",
  "exterior",
  "geometry",
  "orphans",
];

/** Which view each focus scope opens (§2.2). */
const FOCUS_VIEW: Record<FocusScope, PanelView> = {
  unannotated: "map",
  isolated: "map",
  floors: "floors",
  bearings: "map",
  exterior: "map",
  geometry: "map",
  orphans: "orphans",
};

/**
 * Serialize a focus scope back into a query string, so opening a view inside the
 * panel updates the address bar and the resulting URL is a working deep-link.
 * Returns an empty string for the default view.
 */
export function routeQuery(focus: FocusScope | null): string {
  return focus === null ? "" : `?focus=${focus}`;
}

function isFocusScope(value: string | null): value is FocusScope {
  return value !== null && (FOCUS_SCOPES as readonly string[]).includes(value);
}

/**
 * Parse a `?focus=<scope>` query string into a {@link RouteState}. An unknown or
 * absent scope resolves to the default map view (`focus: null`) — the panel must
 * always render something (§2.2). Accepts a full search string (`"?focus=x"`),
 * a bare query (`"focus=x"`), or an empty string.
 */
export function parseRoute(search: string): RouteState {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  const focus = params.get("focus");
  if (isFocusScope(focus)) {
    return { view: FOCUS_VIEW[focus], focus };
  }
  return { view: "map", focus: null };
}
