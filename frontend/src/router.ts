/**
 * Deep-link + in-panel router (Phase 7 §2.2). Frontend-only: no backend command
 * backs a deep-link — the `?focus=<scope>` query is parsed client-side and drives
 * which view opens and which areas/edges are flagged from the live `health`
 * lists. Pure and Lit-free so it is unit-testable and card-reusable.
 */

/** The seven deep-link scopes (§2.2 / §3.1). */
export type FocusScope =
  | "unannotated"
  | "isolated"
  | "floors"
  | "bearings"
  | "exterior"
  | "orphans";

/** The panel views a route resolves to. */
export type PanelView = "map" | "floors" | "exterior" | "orphans";

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
  "orphans",
];

/** Which view each focus scope opens (§2.2). */
const FOCUS_VIEW: Record<FocusScope, PanelView> = {
  unannotated: "map",
  isolated: "map",
  floors: "floors",
  bearings: "map",
  exterior: "exterior",
  orphans: "orphans",
};

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
