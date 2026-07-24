import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TopologyStore } from "../state/store";
import type { TopologyWsClient } from "../api/ws-client";
import type { HealthResult, ListAnnotationsResult } from "../api/types";

const EMPTY_SNAPSHOT: ListAnnotationsResult = {
  home_config: {
    occupancy_extent: "whole_property",
    projection_toggles: { environment: false, type: false, trust: false },
    imports_done_at: { aliases: null, labels: null },
    unannotated_repair_threshold: 3,
  },
  areas: [],
  edges: [],
  floors: [],
  presets: [],
};

const EMPTY_HEALTH = { status: "ok" } as HealthResult;

/** A fake WS client counting seed calls, standing in for {@link TopologyWsClient}. */
function fakeClient(): { client: TopologyWsClient; seeds: () => number } {
  let seeds = 0;
  const client = {
    async listAnnotations(): Promise<ListAnnotationsResult> {
      seeds += 1;
      return EMPTY_SNAPSHOT;
    },
    async health(): Promise<HealthResult> {
      return EMPTY_HEALTH;
    },
    async subscribeUpdates(): Promise<() => Promise<void>> {
      return async () => undefined;
    },
  } as unknown as TopologyWsClient;
  return { client, seeds: () => seeds };
}

describe("store reconnect + coalescing (§2.4)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("re-seeds when the connection returns after a drop", async () => {
    const { client, seeds } = fakeClient();
    const store = new TopologyStore(client);
    await store.reseed();
    expect(seeds()).toBe(1);

    store.handleConnectionState(false); // socket dropped
    store.handleConnectionState(true); // ready again → re-seed
    await vi.runAllTimersAsync();
    expect(seeds()).toBe(2);
    expect(store.state.connected).toBe(true);
  });

  it("coalesces a burst of update events into a single re-fetch", async () => {
    const { client, seeds } = fakeClient();
    const store = new TopologyStore(client, { coalesceMs: 150 });

    for (let i = 0; i < 5; i++) {
      store.handleUpdate({ change: "area", ids: [`a${i}`] });
    }
    // Nothing fetched until the debounce window elapses.
    expect(seeds()).toBe(0);
    await vi.advanceTimersByTimeAsync(150);
    expect(seeds()).toBe(1);
  });
});
