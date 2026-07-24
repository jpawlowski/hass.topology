/**
 * Error-to-toast helper (Phase 7 §2.6). Maps a frozen WS error code to a
 * translated message and dispatches a `topology-toast` event the panel shows.
 */

import type { LitElement } from "lit";
import { TopologyError } from "../api/ws-client";
import { localize } from "../i18n/localize";

/** Translate a {@link TopologyError} and bubble it as a `topology-toast` event. */
export function toast(host: LitElement, error: TopologyError): void {
  const key = `error.${error.code}`;
  const message = localize(key);
  host.dispatchEvent(
    new CustomEvent("topology-toast", {
      detail: { message: message === key ? error.message : message },
      bubbles: true,
      composed: true,
    }),
  );
}
