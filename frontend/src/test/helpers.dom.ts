/**
 * Shared fixtures for the jsdom component specs.
 *
 * Kept to the smallest shapes the panel actually reads: a structural `hass`
 * subset (`areas`/`floors`/`states`/`connection`) and a recording WS client, so a
 * spec can assert *what the panel would send* without a Home Assistant instance.
 */

import type {
  AreaOut,
  ConnectionOut,
  EdgeOut,
  FloorOut,
  HealthResult,
  HomeConfigOut,
  ListAnnotationsResult,
  PresetOut,
} from "../api/types";
import type { HomeAssistant } from "../ha";
import type { TopologyWsClient } from "../api/ws-client";

/** Let a component's `willUpdate`/render settle before asserting on the DOM. */
export async function settle(element: HTMLElement): Promise<void> {
  await (element as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;
}

/** Query inside a component's shadow root. */
export function shadow<T extends Element = Element>(host: HTMLElement, selector: string): T | null {
  return host.shadowRoot?.querySelector<T>(selector) ?? null;
}

export function shadowAll<T extends Element = Element>(host: HTMLElement, selector: string): T[] {
  return [...(host.shadowRoot?.querySelectorAll<T>(selector) ?? [])];
}

export function area(areaId: string, overrides: Partial<AreaOut> = {}): AreaOut {
  return {
    area_id: areaId,
    type: null,
    environment: null,
    trust: null,
    beyond: {},
    exterior_connections: [],
    orphaned_at: null,
    updated_at: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

export function edge(areaA: string, areaB: string, overrides: Partial<EdgeOut> = {}): EdgeOut {
  const [lo, hi] = [areaA, areaB].sort();
  return {
    edge_id: `${lo}::${hi}`,
    area_a: lo,
    area_b: hi,
    axis: "horizontal",
    level_delta: 0,
    is_perimeter: false,
    connections: [{ passage: "level", barrier: "door", preset_name: "interior_door" }],
    orphaned_at: null,
    created_at: "2026-01-01T00:00:00+00:00",
    ...overrides,
  };
}

export function floor(floorId: string, level: number | null): FloorOut {
  return {
    floor_id: floorId,
    registry_level: level,
    level_override: null,
    effective_level: level,
  };
}

/** A representative slice of the shipped preset table, including both scopes. */
export const PRESETS: PresetOut[] = [
  {
    preset_name: "interior_door",
    passage: "level",
    barrier: "door",
    glazed_default: false,
    sensor_allowed: true,
    scope: "interior",
  },
  {
    preset_name: "open_passage",
    passage: "level",
    barrier: "open",
    glazed_default: false,
    sensor_allowed: false,
    scope: "interior",
  },
  {
    preset_name: "shared_wall",
    passage: "none",
    barrier: "solid",
    glazed_default: false,
    sensor_allowed: false,
    scope: "interior",
  },
  {
    preset_name: "ceiling",
    passage: "none",
    barrier: "solid",
    glazed_default: false,
    sensor_allowed: false,
    scope: "interior",
  },
  {
    preset_name: "enclosed_stair",
    passage: "stairs",
    barrier: "door",
    glazed_default: false,
    sensor_allowed: true,
    scope: "interior",
  },
  {
    preset_name: "window",
    passage: "none",
    barrier: "door",
    glazed_default: true,
    sensor_allowed: true,
    scope: "exterior",
  },
  {
    preset_name: "outside_door",
    passage: "level",
    barrier: "door",
    glazed_default: false,
    sensor_allowed: true,
    scope: "exterior",
  },
];

export const AREA_TYPES = {
  catalog: ["bedroom", "living", "kitchen", "hallway", "terrace"],
  cascade: {
    bedroom: { environment: "indoor" as const, trust: "private" as const },
    living: { environment: "indoor" as const, trust: "private" as const },
    kitchen: { environment: "indoor" as const, trust: "private" as const },
    hallway: { environment: "indoor" as const, trust: "shared" as const },
    terrace: { environment: "outdoor" as const, trust: null },
  },
};

export function homeConfig(overrides: Partial<HomeConfigOut> = {}): HomeConfigOut {
  return {
    occupancy_extent: "whole_property",
    projection_toggles: { environment: false, type: false, trust: false },
    imports_done_at: { aliases: "2026-01-01T00:00:00+00:00", labels: "2026-01-01T00:00:00+00:00" },
    unannotated_repair_threshold: 3,
    ...overrides,
  };
}

export function health(overrides: Partial<HealthResult> = {}): HealthResult {
  return {
    status: "ok",
    area_count: 0,
    annotated_count: 0,
    unannotated_areas: [],
    orphaned_edges: [],
    orphaned_areas: [],
    orphaned_floors: [],
    unknown_enum_values: [],
    isolated_areas: [],
    indoor_areas_without_floor: [],
    contradictory_bearings: [],
    exterior_on_non_outdoor_side: [],
    edges_spanning_multiple_floors: [],
    vertical_edges_without_vertical_passage: [],
    ...overrides,
  };
}

export function snapshot(overrides: Partial<ListAnnotationsResult> = {}): ListAnnotationsResult {
  return {
    home_config: homeConfig(),
    areas: [],
    edges: [],
    floors: [],
    presets: PRESETS,
    area_types: AREA_TYPES,
    ...overrides,
  };
}

/**
 * A `hass` stand-in. Floors are keyed by id with a name and level; areas carry
 * the `floor_id` the panel joins on (the backend deliberately does not ship it).
 *
 * `connection.sendMessagePromise` answers the two read commands the panel's store
 * issues on connect, so a mounted panel seeds itself exactly as it would against
 * a real instance — no poking at the store's internals from a spec.
 */
export function hass(options: {
  areas?: Record<string, { name: string; floor_id: string | null }>;
  floors?: Record<string, { name: string; level: number | null }>;
  binarySensors?: Record<string, { name: string; deviceClass?: string }>;
  /**
   * Live source for the two read commands. Read at call time, so a spec that
   * mutates it and then calls `store.reseed()` reproduces a post-write re-seed
   * through the real code path instead of assigning private state.
   */
  data?: { snapshot: ListAnnotationsResult; health: HealthResult };
} = {}): HomeAssistant {
  return {
    connection: {
      connected: true,
      sendMessagePromise: async <T>(message: { type: string }): Promise<T> => {
        if (message.type === "topology/list_annotations") {
          return (options.data?.snapshot ?? snapshot()) as T;
        }
        if (message.type === "topology/health") {
          return (options.data?.health ?? health()) as T;
        }
        return {} as T;
      },
      subscribeMessage: async () => async () => undefined,
    },
    areas: Object.fromEntries(
      Object.entries(options.areas ?? {}).map(([areaId, row]) => [
        areaId,
        { area_id: areaId, name: row.name, icon: null, floor_id: row.floor_id },
      ]),
    ),
    floors: Object.fromEntries(
      Object.entries(options.floors ?? {}).map(([floorId, row]) => [
        floorId,
        { floor_id: floorId, name: row.name, icon: null, level: row.level },
      ]),
    ),
    states: Object.fromEntries(
      Object.entries(options.binarySensors ?? {}).map(([entityId, row]) => [
        entityId,
        {
          entity_id: entityId,
          state: "off",
          attributes: { friendly_name: row.name, device_class: row.deviceClass },
        },
      ]),
    ),
  };
}

export interface RecordedCall {
  method: string;
  args: unknown[];
}

/** A WS client that records calls instead of sending them. */
export function recordingClient(): { client: TopologyWsClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    async (...args: unknown[]): Promise<unknown> => {
      calls.push({ method, args });
      return {};
    };
  const client = {
    listAnnotations: record("listAnnotations"),
    health: record("health"),
    neighbors: record("neighbors"),
    path: record("path"),
    subscribeUpdates: async () => async () => undefined,
    updateArea: record("updateArea"),
    upsertEdge: record("upsertEdge"),
    deleteEdge: record("deleteEdge"),
    restoreEdge: record("restoreEdge"),
    setBeyond: record("setBeyond"),
    setExteriorConnections: record("setExteriorConnections"),
    setFloorLevel: record("setFloorLevel"),
    updateHomeConfig: record("updateHomeConfig"),
  } as unknown as TopologyWsClient;
  return { client, calls };
}

/** Mount an element with the given properties and let its first render settle. */
export async function mount<T extends HTMLElement>(
  tag: string,
  props: Record<string, unknown>,
): Promise<T> {
  const element = document.createElement(tag) as T;
  Object.assign(element, props);
  document.body.append(element);
  await settle(element);
  return element;
}

/**
 * Let pending microtasks and one macrotask drain, then re-settle. Needed after
 * mounting the panel: its store fetches over the (stubbed) socket, so the seeded
 * render happens a few turns after the element is connected.
 */
export async function flush(element: HTMLElement, turns = 4): Promise<void> {
  for (let i = 0; i < turns; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle(element);
  }
}

/** Set a `<select>` to a value and fire the change event the editors listen for. */
export function selectValue(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

export type { ConnectionOut };
