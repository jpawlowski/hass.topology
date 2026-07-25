import { describe, it, expect } from "vitest";
import type { HomeConfigOut } from "../api/types";
import {
  DISMISS_STORAGE_KEY,
  type DismissStorage,
  type ImportSource,
  pendingImportSources,
  persistDismissal,
  readDismissed,
  runImport,
} from "../editors/first-run-logic";

/** A `home_config` payload with the given import stamps (`_serialize_home_config`). */
function homeConfig(aliases: string | null, labels: string | null): HomeConfigOut {
  return {
    occupancy_extent: "whole_property",
    projection_toggles: { environment: false, type: false, trust: false },
    imports_done_at: { aliases, labels },
    unannotated_repair_threshold: 3,
  };
}

/** An in-memory stand-in for `localStorage`. */
function fakeStorage(initial: Record<string, string> = {}): DismissStorage {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

/** A `hass` stand-in recording every service call it is asked to make. */
function recordingHass(): {
  hass: { callService: (d: string, s: string, data?: Record<string, unknown>) => Promise<unknown> };
  calls: [string, string, Record<string, unknown> | undefined][];
} {
  const calls: [string, string, Record<string, unknown> | undefined][] = [];
  return {
    hass: {
      async callService(domain, service, serviceData) {
        calls.push([domain, service, serviceData]);
        return undefined;
      },
    },
    calls,
  };
}

describe("first-run card visibility per source (§4.1/§4.3)", () => {
  it("offers both sources while neither is stamped", () => {
    expect(pendingImportSources(homeConfig(null, null))).toEqual(["aliases", "labels"]);
  });

  it("hides only the stamped source", () => {
    expect(pendingImportSources(homeConfig("2026-07-25T10:00:00+00:00", null))).toEqual(["labels"]);
    expect(pendingImportSources(homeConfig(null, "2026-07-25T10:00:00+00:00"))).toEqual(["aliases"]);
  });

  it("hides the card entirely once both sources are stamped", () => {
    const stamped = homeConfig("2026-07-25T10:00:00+00:00", "2026-07-25T10:01:00+00:00");
    expect(pendingImportSources(stamped)).toEqual([]);
  });

  it("offers nothing before the snapshot arrives", () => {
    expect(pendingImportSources(null)).toEqual([]);
  });
});

describe("first-run triggers the service (§4.2)", () => {
  it("calls the existing import service, never a WS write command", async () => {
    const { hass, calls } = recordingHass();
    await runImport(hass, "aliases");
    await runImport(hass, "labels");
    expect(calls).toEqual([
      ["topology", "import_from_core", { source: "aliases" }],
      ["topology", "import_from_core", { source: "labels" }],
    ]);
  });

  it("rejects when the hass object exposes no callService", async () => {
    await expect(runImport({}, "aliases")).rejects.toThrow("hass.callService is unavailable");
  });
});

describe("first-run dismissal is client-local (§4.1)", () => {
  it("suppresses the dismissed source without any backend call", () => {
    const storage = fakeStorage();
    const dismissed = persistDismissal(storage, "aliases");
    expect([...dismissed]).toEqual(["aliases"]);
    expect(storage.getItem(DISMISS_STORAGE_KEY)).toBe('["aliases"]');
    expect(pendingImportSources(homeConfig(null, null), dismissed)).toEqual(["labels"]);
  });

  it("does not affect the other source and survives a reload of the key", () => {
    const storage = fakeStorage();
    persistDismissal(storage, "labels");
    const reread = readDismissed(storage);
    expect([...reread]).toEqual(["labels"]);
    expect(pendingImportSources(homeConfig(null, null), reread)).toEqual(["aliases"]);
  });

  it("degrades to 'nothing dismissed' on a missing or malformed key", () => {
    expect([...readDismissed(undefined)]).toEqual([]);
    expect([...readDismissed(fakeStorage())]).toEqual([]);
    expect([...readDismissed(fakeStorage({ [DISMISS_STORAGE_KEY]: "{ not json" }))]).toEqual([]);
    expect([...readDismissed(fakeStorage({ [DISMISS_STORAGE_KEY]: '"aliases"' }))]).toEqual([]);
  });

  it("ignores unknown source names stored by an older or tampered client", () => {
    const storage = fakeStorage({ [DISMISS_STORAGE_KEY]: '["aliases","bogus"]' });
    const dismissed: Set<ImportSource> = readDismissed(storage);
    expect([...dismissed]).toEqual(["aliases"]);
  });
});
