import { describe, it, expect } from "vitest";
import { area, edge, floor, hass, mount, settle, shadow, shadowAll } from "./helpers.dom";
import type { AreaOut, EdgeOut, HealthResult } from "../api/types";
import type { TopologyFloorMap } from "../map/floor-map";
import { health } from "./helpers.dom";

import "../map/floor-map";

/** Ground floor: hall + kitchen. Upper: bedroom. Attic: studio. Plus a garden. */
const HASS = hass({
  areas: {
    hall: { name: "Hall", floor_id: "eg" },
    kitchen: { name: "Kitchen", floor_id: "eg" },
    bedroom: { name: "Bedroom", floor_id: "og" },
    studio: { name: "Studio", floor_id: "dg" },
    garden: { name: "Garden", floor_id: null },
  },
  floors: {
    dg: { name: "Attic floor", level: 2 },
    og: { name: "Upper", level: 1 },
    eg: { name: "Ground", level: 0 },
  },
});

const FLOORS = [floor("dg", 2), floor("og", 1), floor("eg", 0)];
const AREAS = [area("hall"), area("kitchen"), area("bedroom"), area("studio"), area("garden")];

async function map(props: {
  areas?: AreaOut[];
  edges?: EdgeOut[];
  activeFloor?: string | null;
  focusScope?: string | null;
  health?: HealthResult | null;
  selectedEdgeId?: string | null;
  selectedAreaId?: string | null;
}) {
  return mount<TopologyFloorMap>("topology-floor-map", {
    hass: HASS,
    areas: props.areas ?? AREAS,
    edges: props.edges ?? [],
    floors: FLOORS,
    health: props.health ?? null,
    activeFloor: props.activeFloor ?? null,
    focusScope: props.focusScope ?? null,
    selectedAreaId: props.selectedAreaId ?? null,
    selectedEdgeId: props.selectedEdgeId ?? null,
  });
}

const texts = (element: HTMLElement, selector: string): string[] =>
  shadowAll(element, selector).map((node) => (node.textContent ?? "").trim());

/** jsdom ships no `PointerEvent`; the handlers only read these four fields. */
function pointer(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { clientX, clientY, bubbles: true });
  Object.defineProperty(event, "pointerId", { value: 1 });
  return event;
}

describe("floor map: what it draws", () => {
  it("says so instead of drawing an empty canvas", async () => {
    const element = await map({ areas: [] });
    expect(shadow(element, ".empty")).not.toBeNull();
    expect(shadow(element, "svg")).toBeNull();
  });

  it("draws one node per area and labels it with the registry name", async () => {
    const element = await map({});
    expect(shadowAll(element, "g.node")).toHaveLength(5);
    expect(texts(element, ".node-label")).toContain("Hall");
  });

  it("bands the areas by floor, top-down, and labels each band", async () => {
    const element = await map({});
    // The server ships floors highest-first, and the unfloored bucket sorts last —
    // that ordering is what makes the picture read as a section through the house.
    expect(texts(element, ".band-label")).toEqual(["Attic floor", "Upper", "Ground", "Outdoor / unfloored"]);
  });

  it("draws no bands at all when everything is on one floor", async () => {
    const element = await map({ activeFloor: "eg" });
    expect(shadowAll(element, ".band")).toHaveLength(0);
    expect(shadowAll(element, "g.node")).toHaveLength(2);
  });

  it("renders the legend, without which the tints and dashes mean nothing", async () => {
    const element = await map({});
    const captions = texts(element, ".legend .caption");
    expect(captions).toEqual(["Trust", "Environment"]);
    expect(shadowAll(element, ".legend .swatch").length).toBeGreaterThan(0);
  });

  it("styles a node by its trust and environment", async () => {
    const element = await map({
      areas: [area("hall", { trust: "public", environment: "outdoor" })],
      activeFloor: "eg",
    });
    const node = shadow(element, "g.node")!;
    expect(node.classList.contains("trust-public")).toBe(true);
    expect(node.classList.contains("env-outdoor")).toBe(true);
  });

  it("marks an unannotated area as needing attention", async () => {
    const element = await map({ activeFloor: "eg" });
    expect(shadow(element, "g.node.muted")).not.toBeNull();
  });

  it("badges an orphaned area", async () => {
    const element = await map({
      areas: [area("hall", { orphaned_at: "2026-01-01T00:00:00+00:00" })],
      activeFloor: "eg",
    });
    expect(shadow(element, "g.node.orphaned")).not.toBeNull();
    expect(shadow(element, ".orphan-badge")).not.toBeNull();
  });
});

describe("floor map: edges", () => {
  it("draws an edge between two visible areas and styles it by barrier", async () => {
    const element = await map({
      edges: [edge("hall", "kitchen")],
      activeFloor: "eg",
    });
    const line = shadow(element, "line.edge")!;
    expect(line.classList.contains("barrier-door")).toBe(true);
  });

  it("never draws an orphaned edge", async () => {
    const element = await map({
      edges: [edge("hall", "kitchen", { orphaned_at: "2026-01-01T00:00:00+00:00" })],
      activeFloor: "eg",
    });
    expect(shadowAll(element, "line.edge")).toHaveLength(0);
  });

  it("emits edge-selected when an edge is clicked", async () => {
    const element = await map({ edges: [edge("hall", "kitchen")], activeFloor: "eg" });
    let selected: string | null = null;
    element.addEventListener("edge-selected", (ev) => {
      selected = (ev as CustomEvent<{ edge: EdgeOut }>).detail.edge.edge_id;
    });
    shadow<SVGLineElement>(element, "line.edge")!.dispatchEvent(new MouseEvent("click"));
    expect(selected).toBe("hall::kitchen");
  });

  it("emits area-selected when a node is clicked", async () => {
    const element = await map({ activeFloor: "eg" });
    let selected: string | null = null;
    element.addEventListener("area-selected", (ev) => {
      selected = (ev as CustomEvent<{ area: AreaOut }>).detail.area.area_id;
    });
    shadow<SVGGElement>(element, "g.node")!.dispatchEvent(new MouseEvent("click"));
    expect(selected).toBe("hall");
  });
});

/** Effective levels of the fixture areas, mirroring the `hass` floors above. */
const LEVELS: Record<string, number | null> = {
  hall: 0,
  kitchen: 0,
  bedroom: 1,
  studio: 2,
  garden: null,
};

/**
 * An edge with `level_delta` derived the way the backend derives it.
 *
 * Writing the delta by hand is a trap: `edge()` sorts the endpoints, so
 * `level_delta` is signed from the lexicographically *smaller* id, not from the
 * one written first — which is exactly the asymmetry the connector direction has
 * to cope with.
 */
function connected(a: string, b: string): EdgeOut {
  const [lo, hi] = [a, b].sort();
  const low = LEVELS[lo];
  const high = LEVELS[hi];
  const delta = low === null || high === null ? null : high - low;
  return edge(a, b, {
    axis: delta === null ? "unknown" : delta === 0 ? "horizontal" : "vertical",
    level_delta: delta,
  });
}

describe("floor map: inter-floor connectors", () => {

  it("draws a stub for an edge that leaves the visible floor", async () => {
    const element = await map({ edges: [connected("hall", "bedroom")], activeFloor: "eg" });
    // No line can be drawn — the far node is not laid out — so the connector is
    // the only thing that says the connection exists at all.
    expect(shadowAll(element, "line.edge")).toHaveLength(0);
    expect(shadowAll(element, "g.connector")).toHaveLength(1);
  });

  it("points up or down according to the level difference, seen from the visible side", async () => {
    // level_delta is signed area_a -> area_b, and area_a is only the smaller id,
    // so it has to be flipped when the visible endpoint is area_b. Getting this
    // wrong points every second connector the wrong way.
    const fromA = await map({ edges: [connected("hall", "bedroom")], activeFloor: "eg" });
    expect(shadow(fromA, "g.connector")!.classList.contains("up")).toBe(true);

    const fromB = await map({ edges: [connected("hall", "bedroom")], activeFloor: "og" });
    expect(shadow(fromB, "g.connector")!.classList.contains("down")).toBe(true);
  });

  it("names the area and floor it leads to", async () => {
    const element = await map({ edges: [connected("hall", "bedroom")], activeFloor: "eg" });
    const label = shadow(element, ".connector-label")!.textContent ?? "";
    expect(label).toContain("Bedroom");
    expect(label).toContain("Upper");
    expect(label).toContain("above");
  });

  it("does not claim a direction it cannot resolve", async () => {
    const element = await map({
      edges: [connected("hall", "garden")],
      activeFloor: "eg",
    });
    const connector = shadow(element, "g.connector")!;
    expect(connector.classList.contains("unknown")).toBe(true);
    expect(shadow(element, ".connector-label")!.textContent).toContain("no floor level");
  });

  it("fans several connectors out instead of stacking them on one point", async () => {
    const element = await map({
      edges: [connected("hall", "bedroom"), connected("hall", "studio")],
      activeFloor: "eg",
    });
    const xs = shadowAll<SVGLineElement>(element, "g.connector line.stem").map((line) =>
      line.getAttribute("x1"),
    );
    expect(xs).toHaveLength(2);
    expect(new Set(xs).size).toBe(2);
  });

  it("selects the edge on click, like any other edge", async () => {
    const element = await map({ edges: [connected("hall", "bedroom")], activeFloor: "eg" });
    let selected: string | null = null;
    element.addEventListener("edge-selected", (ev) => {
      selected = (ev as CustomEvent<{ edge: EdgeOut }>).detail.edge.edge_id;
    });
    shadow<SVGGElement>(element, "g.connector")!.dispatchEvent(new MouseEvent("click"));
    expect(selected).toBe("bedroom::hall");
  });

  it("asks the host to switch floors on double-click, and swallows the reset gesture", async () => {
    const element = await map({ edges: [connected("hall", "bedroom")], activeFloor: "eg" });
    let detail: { floorId: string | null; areaId: string } | null = null;
    element.addEventListener("floor-requested", (ev) => {
      detail = (ev as CustomEvent<{ floorId: string | null; areaId: string }>).detail;
    });
    const event = new MouseEvent("dblclick", { bubbles: true, cancelable: true });
    shadow<SVGGElement>(element, "g.connector")!.dispatchEvent(event);

    expect(detail).toEqual({ floorId: "og", areaId: "bedroom" });
    // The svg's own dblclick resets the view; on a connector that is not the gesture.
    expect(event.defaultPrevented).toBe(true);
  });

  it("draws no connector when both ends are visible", async () => {
    const element = await map({ edges: [connected("hall", "bedroom")], activeFloor: null });
    expect(shadowAll(element, "g.connector")).toHaveLength(0);
    expect(shadowAll(element, "line.edge")).toHaveLength(1);
  });
});

describe("floor map: consistency overlay", () => {
  it("flags the areas the active focus scope names", async () => {
    const element = await map({
      focusScope: "isolated",
      health: health({ isolated_areas: ["kitchen"] }),
      activeFloor: "eg",
    });
    const flagged = shadowAll(element, "g.node.flagged");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].textContent).toContain("Kitchen");
  });

  it("flags edges, not areas, for the geometry scope", async () => {
    // The overlay used to flag areas only, so a scope whose findings are
    // boundaries highlighted nothing at all.
    const element = await map({
      edges: [edge("hall", "kitchen")],
      focusScope: "geometry",
      health: health({ vertical_edges_without_vertical_passage: ["hall::kitchen"] }),
      activeFloor: "eg",
    });
    expect(shadow(element, "line.edge.flagged")).not.toBeNull();
    expect(shadowAll(element, "g.node.flagged")).toHaveLength(0);
  });

  it("flags an off-floor connector too", async () => {
    const element = await map({
      edges: [connected("hall", "bedroom")],
      focusScope: "geometry",
      health: health({ vertical_edges_without_vertical_passage: ["bedroom::hall"] }),
      activeFloor: "eg",
    });
    expect(shadow(element, "g.connector.flagged")).not.toBeNull();
  });

  it("flags nothing without a health payload", async () => {
    const element = await map({ focusScope: "isolated", health: null, activeFloor: "eg" });
    expect(shadowAll(element, ".flagged")).toHaveLength(0);
  });
});

describe("floor map: pan and zoom", () => {
  const viewBox = (element: HTMLElement): number[] =>
    (shadow(element, "svg")!.getAttribute("viewBox") ?? "")
      .split(" ")
      .map((value) => Number.parseFloat(value));

  it("follows the content extent until the user takes over", async () => {
    const element = await map({ activeFloor: "eg" });
    const [x, y, width, height] = viewBox(element);
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    // Nothing to reset yet, so no reset affordance is offered.
    expect(shadow(element, "button.reset")).toBeNull();
  });

  it("zooms around the cursor and offers a way back", async () => {
    const element = await map({ activeFloor: "eg" });
    const before = viewBox(element);
    const svg = shadow<SVGSVGElement>(element, "svg")!;
    svg.dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true }));
    await settle(element);

    const after = viewBox(element);
    expect(after[2]).toBeLessThan(before[2]);
    const reset = shadow<HTMLButtonElement>(element, "button.reset")!;
    expect(reset).not.toBeNull();

    reset.click();
    await settle(element);
    expect(viewBox(element)).toEqual(before);
  });

  it("refuses a zoom that would leave nothing findable", async () => {
    const element = await map({ activeFloor: "eg" });
    const svg = shadow<SVGSVGElement>(element, "svg")!;
    for (let i = 0; i < 40; i++) {
      svg.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, cancelable: true }));
    }
    await settle(element);
    const [, , width] = viewBox(element);
    // Bounded relative to the content: never wider than base / MIN_ZOOM, so no
    // gesture can strand the user at a scale where nothing is findable.
    const [, , baseWidth] = viewBox(await map({ activeFloor: "eg" }));
    expect(width).toBeGreaterThan(baseWidth);
    expect(width).toBeLessThanOrEqual(baseWidth / 0.4 + 1);
  });

  it("pans on a drag over empty canvas", async () => {
    const element = await map({ activeFloor: "eg" });
    const svg = shadow<SVGSVGElement>(element, "svg")!;
    // jsdom has no layout, so give the element a box for the pointer maths.
    svg.getBoundingClientRect = () => ({ width: 800, height: 600, top: 0, left: 0 }) as DOMRect;
    svg.setPointerCapture = () => undefined;
    const before = viewBox(element);

    svg.dispatchEvent(pointer("pointerdown", 100, 100));
    svg.dispatchEvent(pointer("pointermove", 60, 100));
    await settle(element);

    expect(viewBox(element)[0]).toBeGreaterThan(before[0]);
  });

  it("does not start a pan on a node — the node owns its own click", async () => {
    const element = await map({ activeFloor: "eg" });
    const svg = shadow<SVGSVGElement>(element, "svg")!;
    svg.getBoundingClientRect = () => ({ width: 800, height: 600, top: 0, left: 0 }) as DOMRect;
    const before = viewBox(element);

    const node = shadow<SVGGElement>(element, "g.node")!;
    node.dispatchEvent(pointer("pointerdown", 100, 100));
    svg.dispatchEvent(pointer("pointermove", 60, 100));
    await settle(element);

    expect(viewBox(element)).toEqual(before);
  });
});
