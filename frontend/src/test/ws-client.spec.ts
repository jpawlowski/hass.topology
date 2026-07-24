import { describe, it, expect } from "vitest";
import { TopologyWsClient, type HassConnection } from "../api/ws-client";

/** A fake `hass.connection` that records every message it is asked to send. */
function recordingConnection(): { conn: HassConnection; sent: Record<string, unknown>[] } {
  const sent: Record<string, unknown>[] = [];
  const conn: HassConnection = {
    connected: true,
    async sendMessagePromise<T>(message: Record<string, unknown>): Promise<T> {
      sent.push(message);
      return {} as T;
    },
    async subscribeMessage<T>(
      _callback: (message: T) => void,
      message: Record<string, unknown>,
    ): Promise<() => Promise<void>> {
      sent.push(message);
      return async () => undefined;
    },
  };
  return { conn, sent };
}

describe("ws-client encodes the frozen v1 commands", () => {
  it("sends the exact command name + payload for every read method", async () => {
    const { conn, sent } = recordingConnection();
    const client = new TopologyWsClient(conn);
    await client.listAnnotations();
    await client.health();
    await client.neighbors("area1");
    await client.path("a", "b", true);
    await client.subscribeUpdates(() => undefined);
    expect(sent).toEqual([
      { type: "topology/list_annotations" },
      { type: "topology/health" },
      { type: "topology/neighbors", area_id: "area1" },
      { type: "topology/path", from: "a", to: "b", traversable_only: true },
      { type: "topology/subscribe_updates" },
    ]);
  });

  it("sends the exact command name + payload for every write method", async () => {
    const { conn, sent } = recordingConnection();
    const client = new TopologyWsClient(conn);
    await client.updateArea("a", { type: "kitchen", environment: "indoor", trust: "private" });
    await client.upsertEdge("a", "b", [{ passage: "level", barrier: "door" }]);
    await client.deleteEdge("a::b");
    await client.restoreEdge("a::b");
    await client.setBeyond("a", "N", "outdoor");
    await client.setExteriorConnections("a", [{ passage: "none", barrier: "door" }]);
    await client.setFloorLevel("ground", 0);
    await client.updateHomeConfig({ occupancy_extent: "whole_property" });
    expect(sent).toEqual([
      {
        type: "topology/update_area",
        area_id: "a",
        annotation: { type: "kitchen", environment: "indoor", trust: "private" },
      },
      {
        type: "topology/upsert_edge",
        area_a: "a",
        area_b: "b",
        connections: [{ passage: "level", barrier: "door" }],
      },
      { type: "topology/delete_edge", edge_id: "a::b" },
      { type: "topology/restore_edge", edge_id: "a::b" },
      { type: "topology/set_beyond", area_id: "a", side: "N", beyond: "outdoor" },
      {
        type: "topology/set_exterior_connections",
        area_id: "a",
        connections: [{ passage: "none", barrier: "door" }],
      },
      { type: "topology/set_floor_level", floor_id: "ground", level: 0 },
      { type: "topology/update_home_config", occupancy_extent: "whole_property" },
    ]);
  });

  it("surfaces a frozen error code as a typed TopologyError rejection", async () => {
    const conn: HassConnection = {
      connected: true,
      async sendMessagePromise<T>(): Promise<T> {
        throw { code: "unauthorized", message: "admin required" };
      },
      async subscribeMessage(): Promise<() => Promise<void>> {
        return async () => undefined;
      },
    };
    const client = new TopologyWsClient(conn);
    await expect(client.updateArea("a", {})).rejects.toMatchObject({ code: "unauthorized" });
  });
});
