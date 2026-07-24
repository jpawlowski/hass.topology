/**
 * Client state + reconnect handling (Phase 7 §2.4). A plain, Lit-free observable
 * so it is unit-testable (fake timers) and shareable with a future read-only
 * card. It holds the full snapshot from `list_annotations`, re-fetches on each
 * coalesced `subscribe_updates` event, and re-seeds after a reconnect — state is
 * always server-authoritative (no optimistic writes in v1).
 */

import type { TopologyWsClient } from "../api/ws-client";
import type { HealthResult, ListAnnotationsResult, UpdateEvent } from "../api/types";

export interface StoreState {
  /** The last full snapshot, or `null` before the first seed. */
  snapshot: ListAnnotationsResult | null;
  /** The last health signal, or `null` before the first seed. */
  health: HealthResult | null;
  /** Whether the socket is currently reported up (drives the banner, §2.4). */
  connected: boolean;
  /** A human-readable seed/refetch error, or `null`. */
  error: string | null;
}

type Listener = () => void;

/** Default burst-coalescing window (§2.4: ≤150 ms). */
const DEFAULT_COALESCE_MS = 150;

export class TopologyStore {
  private readonly client: TopologyWsClient;
  private readonly coalesceMs: number;
  private readonly listeners = new Set<Listener>();

  private _state: StoreState = { snapshot: null, health: null, connected: true, error: null };
  private unsubscribe: (() => Promise<void>) | null = null;
  private coalesceTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  public constructor(client: TopologyWsClient, options: { coalesceMs?: number } = {}) {
    this.client = client;
    this.coalesceMs = options.coalesceMs ?? DEFAULT_COALESCE_MS;
  }

  public get state(): StoreState {
    return this._state;
  }

  /** Register a change listener; returns an unregister fn. */
  public addListener(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private setState(patch: Partial<StoreState>): void {
    this._state = { ...this._state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Seed the snapshot + health and open the update subscription (§2.4). */
  public async connect(): Promise<void> {
    await this.reseed();
    if (this.disposed) {
      return;
    }
    this.unsubscribe = await this.client.subscribeUpdates((event) => this.handleUpdate(event));
  }

  /** Re-fetch the full snapshot + health (seed and post-reconnect re-seed). */
  public async reseed(): Promise<void> {
    try {
      const [snapshot, health] = await Promise.all([
        this.client.listAnnotations(),
        this.client.health(),
      ]);
      this.setState({ snapshot, health, error: null });
    } catch (err) {
      this.setState({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  /**
   * Handle one `{change, ids}` event (§2.4). Events carry ids, never deltas, so
   * the store simply re-fetches — but a burst (e.g. a bulk import) is coalesced
   * into a single re-fetch by debouncing within {@link coalesceMs}.
   */
  public handleUpdate(_event: UpdateEvent): void {
    if (this.coalesceTimer !== null) {
      clearTimeout(this.coalesceTimer);
    }
    this.coalesceTimer = setTimeout(() => {
      this.coalesceTimer = null;
      void this.reseed();
    }, this.coalesceMs);
  }

  /**
   * React to the frontend's connection lifecycle (§2.4). A drop shows the
   * "reconnecting…" banner; a ready signal after a drop re-seeds so a dropped
   * socket can never leave stale state.
   */
  public handleConnectionState(connected: boolean): void {
    const wasConnected = this._state.connected;
    this.setState({ connected });
    if (connected && !wasConnected) {
      void this.reseed();
    }
  }

  /** Tear down the subscription and any pending timer. */
  public async dispose(): Promise<void> {
    this.disposed = true;
    if (this.coalesceTimer !== null) {
      clearTimeout(this.coalesceTimer);
      this.coalesceTimer = null;
    }
    if (this.unsubscribe !== null) {
      const unsub = this.unsubscribe;
      this.unsubscribe = null;
      await unsub();
    }
    this.listeners.clear();
  }
}
