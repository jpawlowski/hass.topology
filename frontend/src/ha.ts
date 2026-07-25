/**
 * Minimal structural types for the HA frontend objects the panel consumes. The
 * real `HomeAssistant` type lives in `home-assistant/frontend`, which is not a
 * stable public npm module (§4.1), so the panel depends only on the small,
 * long-stable subset it actually reads — chiefly `hass.areas` / `hass.floors`
 * for names + icons (the join point that means no new WS command, §2.4/D7) and
 * `hass.connection` for the WebSocket.
 */

import type { HassConnection } from "./api/ws-client";

/** A registry area as the frontend exposes it (names + icons live here). */
export interface HassArea {
  area_id: string;
  name: string;
  icon: string | null;
  floor_id: string | null;
}

/** A registry floor as the frontend exposes it. */
export interface HassFloor {
  floor_id: string;
  name: string;
  icon: string | null;
  level: number | null;
}

/** The current frontend user (drives nothing security-critical; §2.7). */
export interface HassUser {
  is_admin: boolean;
}

/** The subset of the HA frontend `hass` object the panel relies on. */
export interface HomeAssistant {
  connection: HassConnection;
  areas: Record<string, HassArea>;
  floors: Record<string, HassFloor>;
  user?: HassUser;
  language?: string;
  localize?: (key: string, ...args: unknown[]) => string;
  /**
   * Core's own service call, used by the panel's first-run card to drive the
   * existing `topology.import_from_core` service — no new topology WS command
   * (§4.2). Declared optional because this is a structural subset of a type the
   * panel does not import; the caller checks before using it.
   */
  callService?: (
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ) => Promise<unknown>;
}

/** HA sets `route` on the panel element (§2.2 / A.5). */
export interface Route {
  prefix: string;
  path: string;
}

/** The `panel` property HA sets on the element (carries the registration config). */
export interface PanelInfo {
  config: { url_path?: string } | null;
}
