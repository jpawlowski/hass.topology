/**
 * Typed thin wrapper over the HA frontend's `hass.connection`, exposing exactly
 * the frozen WebSocket contract v1 (PLAN-topology-phase2.md §4) — no more. The
 * panel is a pure consumer; this client adds no command, enum, or derivation
 * (Phase 7 §2.3, D7).
 *
 * Card-reuse boundary (§4.2, D15): this module imports only `./types` — no Lit,
 * no route/panel props, no editor imports. The read methods
 * (`listAnnotations`/`health`/`neighbors`/`path`/`subscribeUpdates`) are the
 * surface a future read-only Lovelace card reuses; the write methods below them
 * are exercised only by the panel's editors.
 */

import type {
  AreaAnnotationPatch,
  AreaOut,
  CardinalSide,
  ConnectionOut,
  EdgeOut,
  FloorOut,
  HealthResult,
  HomeConfigOut,
  HomeConfigPatch,
  ListAnnotationsResult,
  TopologyErrorCode,
  UpdateEvent,
} from "./types";

/** Minimal structural shape of a message sent over the HA WS connection. */
interface WsMessage {
  type: string;
  [key: string]: unknown;
}

/** The subset of `hass.connection` this client relies on (frontend-owned). */
export interface HassConnection {
  /** Whether the socket is currently up (frontend owns the lifecycle, §2.4). */
  readonly connected?: boolean;
  sendMessagePromise<T>(message: WsMessage): Promise<T>;
  subscribeMessage<T>(
    callback: (message: T) => void,
    subscribeMessage: WsMessage,
  ): Promise<() => Promise<void>>;
}

/** A frozen WS error surfaced as a typed rejection (§4). */
export class TopologyError extends Error {
  public readonly code: TopologyErrorCode | string;

  public constructor(code: TopologyErrorCode | string, message: string) {
    super(message);
    this.name = "TopologyError";
    this.code = code;
  }
}

/** Normalize a rejected `sendMessagePromise` into a {@link TopologyError}. */
function toTopologyError(err: unknown): TopologyError {
  if (err && typeof err === "object" && "code" in err) {
    const e = err as { code: string; message?: string };
    return new TopologyError(e.code, e.message ?? e.code);
  }
  return new TopologyError("store_error", err instanceof Error ? err.message : String(err));
}

/**
 * The frozen-v1 WebSocket consumer. Every method maps 1:1 to a Phase-2 §4
 * command; the payload shapes are the {@link file://./types} mirrors.
 */
export class TopologyWsClient {
  private readonly connection: HassConnection;

  public constructor(connection: HassConnection) {
    this.connection = connection;
  }

  private async send<T>(message: WsMessage): Promise<T> {
    try {
      return await this.connection.sendMessagePromise<T>(message);
    } catch (err) {
      throw toTopologyError(err);
    }
  }

  // --- read commands (any authenticated user, §2.7) ------------------------

  public listAnnotations(): Promise<ListAnnotationsResult> {
    return this.send<ListAnnotationsResult>({ type: "topology/list_annotations" });
  }

  public health(): Promise<HealthResult> {
    return this.send<HealthResult>({ type: "topology/health" });
  }

  public neighbors(areaId: string): Promise<unknown> {
    return this.send({ type: "topology/neighbors", area_id: areaId });
  }

  public path(from: string, to: string, traversableOnly = false): Promise<unknown> {
    return this.send({ type: "topology/path", from, to, traversable_only: traversableOnly });
  }

  /** Subscribe to `{change, ids}` change events; returns the unsubscribe fn. */
  public subscribeUpdates(callback: (event: UpdateEvent) => void): Promise<() => Promise<void>> {
    return this.connection.subscribeMessage<UpdateEvent>(callback, {
      type: "topology/subscribe_updates",
    });
  }

  // --- write commands (admin, §2.7) ----------------------------------------

  public updateArea(areaId: string, annotation: AreaAnnotationPatch): Promise<AreaOut> {
    return this.send<AreaOut>({ type: "topology/update_area", area_id: areaId, annotation });
  }

  public upsertEdge(areaA: string, areaB: string, connections: ConnectionOut[]): Promise<EdgeOut> {
    return this.send<EdgeOut>({
      type: "topology/upsert_edge",
      area_a: areaA,
      area_b: areaB,
      connections,
    });
  }

  public deleteEdge(edgeId: string): Promise<{ deleted: boolean }> {
    return this.send<{ deleted: boolean }>({ type: "topology/delete_edge", edge_id: edgeId });
  }

  public restoreEdge(edgeId: string): Promise<EdgeOut> {
    return this.send<EdgeOut>({ type: "topology/restore_edge", edge_id: edgeId });
  }

  public setBeyond(
    areaId: string,
    side: CardinalSide,
    beyond: string | null,
  ): Promise<AreaOut> {
    return this.send<AreaOut>({ type: "topology/set_beyond", area_id: areaId, side, beyond });
  }

  public setExteriorConnections(areaId: string, connections: ConnectionOut[]): Promise<AreaOut> {
    return this.send<AreaOut>({
      type: "topology/set_exterior_connections",
      area_id: areaId,
      connections,
    });
  }

  public setFloorLevel(floorId: string, level: number | null): Promise<FloorOut> {
    return this.send<FloorOut>({ type: "topology/set_floor_level", floor_id: floorId, level });
  }

  public updateHomeConfig(patch: HomeConfigPatch): Promise<HomeConfigOut> {
    return this.send<HomeConfigOut>({ type: "topology/update_home_config", ...patch });
  }
}
