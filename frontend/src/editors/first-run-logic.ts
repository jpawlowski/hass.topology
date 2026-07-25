/**
 * First-run import logic (PLAN-topology-phase2-followup-configflow.md §4).
 *
 * The framework-agnostic half of the panel's first-run card: which sources are
 * still pending, how a client-local dismissal is read/written, and the exact
 * service call the opt-in performs. Kept Lit-free — like `preset.ts` beside
 * `edge-editor.ts` — so the vitest specs can exercise it in the node
 * environment the repo's frontend tests run in.
 *
 * Panel-only: this is a *write* surface outside the card-reuse boundary (D15).
 * It adds no WebSocket command — the opt-in drives the existing Phase-6
 * `topology.import_from_core` service over HA core's own `call_service`.
 */

import type { HomeConfigOut } from "../api/types";

/** The two one-shot import sources (`const.IMPORT_SOURCES`). */
export type ImportSource = "aliases" | "labels";

/** Both sources, in the order the card renders them. */
export const IMPORT_SOURCES: readonly ImportSource[] = ["aliases", "labels"];

/** Integration domain + service name of the existing one-shot import (§4.2). */
export const IMPORT_DOMAIN = "topology";
export const IMPORT_SERVICE = "import_from_core";

/** `localStorage` key holding the dismissed sources (client-local, §4.1). */
export const DISMISS_STORAGE_KEY = "topology.first-run.dismissed";

/** The tiny `localStorage` subset this module uses (injectable for tests). */
export interface DismissStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The `hass.callService` subset the opt-in needs (§4.2, `ha.ts`). */
export interface ServiceCaller {
  callService?: (
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>,
  ) => Promise<unknown>;
}

/**
 * Read the client-local dismissals. A missing, malformed, or non-array value
 * degrades to "nothing dismissed" — a broken key must never hide the card
 * permanently, and it must never throw during render.
 */
export function readDismissed(storage: DismissStorage | null | undefined): Set<ImportSource> {
  const dismissed = new Set<ImportSource>();
  if (!storage) {
    return dismissed;
  }
  let raw: string | null = null;
  try {
    raw = storage.getItem(DISMISS_STORAGE_KEY);
  } catch {
    return dismissed;
  }
  if (raw === null) {
    return dismissed;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return dismissed;
  }
  if (!Array.isArray(parsed)) {
    return dismissed;
  }
  for (const value of parsed) {
    if (IMPORT_SOURCES.includes(value as ImportSource)) {
      dismissed.add(value as ImportSource);
    }
  }
  return dismissed;
}

/**
 * Add a source to the client-local dismissals and return the new set. Purely a
 * browser-side preference — no backend call, no store field (§4.1).
 */
export function persistDismissal(
  storage: DismissStorage | null | undefined,
  source: ImportSource,
): Set<ImportSource> {
  const dismissed = readDismissed(storage);
  dismissed.add(source);
  if (storage) {
    try {
      storage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...dismissed]));
    } catch {
      // A full or unavailable storage only costs the dismissal, not the card.
    }
  }
  return dismissed;
}

/**
 * The sources whose opt-in the card should still offer: not yet stamped
 * server-side (`imports_done_at.<source> === null`) and not dismissed in this
 * browser. A stamped source never shows again, on any browser (§4.3).
 */
export function pendingImportSources(
  homeConfig: HomeConfigOut | null | undefined,
  dismissed: ReadonlySet<ImportSource> = new Set(),
): ImportSource[] {
  if (!homeConfig) {
    return [];
  }
  return IMPORT_SOURCES.filter(
    (source) => homeConfig.imports_done_at[source] === null && !dismissed.has(source),
  );
}

/**
 * Run the one-shot import for a source. This is core's `call_service`, not a
 * topology WS command: the service already runs the import *and* stamps
 * `imports_done_at`, then publishes the update the panel re-seeds from (§4.2).
 */
export async function runImport(hass: ServiceCaller, source: ImportSource): Promise<void> {
  if (typeof hass.callService !== "function") {
    throw new Error("hass.callService is unavailable");
  }
  await hass.callService(IMPORT_DOMAIN, IMPORT_SERVICE, { source });
}
