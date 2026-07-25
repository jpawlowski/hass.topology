import { describe, it, expect, beforeEach } from "vitest";
import { area, edge, floor, flush, hass, health, mount, settle, shadow, shadowAll, snapshot } from "./helpers.dom";
import { TopologyStore } from "../state/store";
import type { TopologyPanel } from "../topology-panel";
import type { ListAnnotationsResult, HealthResult } from "../api/types";

import "../topology-panel";

const AREAS = {
  hall: { name: "Hall", floor_id: "eg" },
  kitchen: { name: "Kitchen", floor_id: "eg" },
  bedroom: { name: "Bedroom", floor_id: "og" },
};
const FLOORS = { og: { name: "Upper", level: 1 }, eg: { name: "Ground", level: 0 } };

const SNAPSHOT: ListAnnotationsResult = snapshot({
  areas: [area("hall", { type: "hallway" }), area("kitchen"), area("bedroom")],
  edges: [edge("hall", "kitchen")],
  floors: [floor("og", 1), floor("eg", 0)],
});

/**
 * Mount a panel and let it seed itself over the stubbed socket, the same path it
 * takes against a real instance. The returned `data` holder is what the socket
 * answers from, so mutating it and calling {@link reseed} replays a post-write
 * re-seed without reaching into the store.
 */
async function panel(over: { health?: HealthResult; search?: string; snapshot?: ListAnnotationsResult } = {}) {
  window.history.replaceState(null, "", `/topology${over.search ?? ""}`);
  const data = { snapshot: over.snapshot ?? SNAPSHOT, health: over.health ?? health() };
  const element = await mount<TopologyPanel>("topology-panel", {
    hass: hass({ areas: AREAS, floors: FLOORS, data }),
  });
  await flush(element);
  return { element, data };
}

/** Replay the re-seed a write triggers, through the store's own refresh path. */
async function reseed(element: TopologyPanel): Promise<void> {
  const store = (element as unknown as { store: TopologyStore }).store;
  await store.reseed();
  await flush(element);
}

/** The sidebar's rendered text, which is what the user actually reads. */
const sideText = (element: HTMLElement): string => shadow(element, "aside.side")?.textContent ?? "";

const map = (element: HTMLElement): HTMLElement => shadow<HTMLElement>(element, "topology-floor-map")!;

function selectArea(element: HTMLElement, areaId: string): void {
  map(element).dispatchEvent(
    new CustomEvent("area-selected", {
      detail: { area: SNAPSHOT.areas.find((row) => row.area_id === areaId) },
      bubbles: true,
      composed: true,
    }),
  );
}

beforeEach(() => {
  document.body.replaceChildren();
});

describe("panel navigation: there is always a way back", () => {
  it("starts on the home-configuration sidebar", async () => {
    const { element } = await panel();
    expect(shadow(element, "topology-home-config-editor")).not.toBeNull();
  });

  // The reported dead end: nothing ever cleared the selection, so once a room was
  // clicked the home configuration was unreachable without reloading the page.
  it("returns to home configuration after a room was opened", async () => {
    const { element } = await panel();
    selectArea(element, "hall");
    await settle(element);
    expect(shadow(element, "topology-area-editor")).not.toBeNull();
    expect(shadow(element, "topology-home-config-editor")).toBeNull();

    shadow<HTMLButtonElement>(element, ".close-bar button")!.click();
    await settle(element);
    expect(shadow(element, "topology-area-editor")).toBeNull();
    expect(shadow(element, "topology-home-config-editor")).not.toBeNull();
  });

  it("closes the selection on Escape", async () => {
    const { element } = await panel();
    selectArea(element, "hall");
    await settle(element);

    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle(element);
    expect(shadow(element, "topology-home-config-editor")).not.toBeNull();
  });

  it("reaches the floors and orphans views and back out again", async () => {
    const { element } = await panel();
    const navButton = (label: string): HTMLButtonElement =>
      shadowAll<HTMLButtonElement>(element, "nav.views button").find(
        (button) => (button.textContent ?? "").trim() === label,
      )!;

    navButton("Floor levels").click();
    await settle(element);
    expect(shadow(element, "topology-floor-editor")).not.toBeNull();

    navButton("Orphaned entries").click();
    await settle(element);
    expect(shadow(element, "topology-orphans-view")).not.toBeNull();

    navButton("Home configuration").click();
    await settle(element);
    expect(shadow(element, "topology-home-config-editor")).not.toBeNull();
  });
});

describe("panel navigation: floors", () => {
  it("offers All floors plus every floor top-down and the outdoor bucket", async () => {
    const { element } = await panel();
    const labels = shadowAll(element, "nav.floors button").map((button) =>
      (button.textContent ?? "").trim(),
    );
    expect(labels).toEqual(["All floors", "Upper", "Ground", "Outdoor / unfloored"]);
  });

  // Before, `activeFloor` only ever moved away from "all", so the combined view
  // needed a page reload to get back.
  it("returns to the combined view after a floor was picked", async () => {
    const { element } = await panel();
    const button = (label: string): HTMLButtonElement =>
      shadowAll<HTMLButtonElement>(element, "nav.floors button").find(
        (row) => (row.textContent ?? "").trim() === label,
      )!;

    button("Ground").click();
    await settle(element);
    expect(button("Ground").classList.contains("active")).toBe(true);

    button("All floors").click();
    await settle(element);
    expect(button("All floors").classList.contains("active")).toBe(true);
  });
});

describe("panel navigation: selection follows the live snapshot", () => {
  // The sidebar used to hold the object captured at click time, so it kept
  // showing pre-save values until the room was clicked again.
  it("re-resolves the open area against a re-seeded snapshot", async () => {
    const { element, data } = await panel();
    selectArea(element, "kitchen");
    await settle(element);

    const editor = shadow<HTMLElement & { area: { trust: string | null } }>(
      element,
      "topology-area-editor",
    )!;
    expect(editor.area.trust).toBeNull();

    // Simulate the post-write re-seed: a brand-new snapshot object.
    data.snapshot = { ...SNAPSHOT, areas: [area("kitchen", { trust: "private" })] };
    await reseed(element);

    const after = shadow<HTMLElement & { area: { trust: string | null } }>(
      element,
      "topology-area-editor",
    )!;
    expect(after.area.trust).toBe("private");
  });

  it("drops the selection when the open edge disappears from the snapshot", async () => {
    const { element, data } = await panel();
    map(element).dispatchEvent(
      new CustomEvent("edge-selected", {
        detail: { edge: SNAPSHOT.edges[0] },
        bubbles: true,
        composed: true,
      }),
    );
    await settle(element);
    expect(shadow(element, "topology-edge-editor")).not.toBeNull();

    data.snapshot = { ...SNAPSHOT, edges: [] };
    await reseed(element);
    // No stale editor for an edge that no longer exists.
    expect(shadow(element, "topology-edge-editor")).toBeNull();
  });
});

describe("panel navigation: deep links", () => {
  it("opens the floors view from ?focus=floors", async () => {
    const { element } = await panel({ search: "?focus=floors" });
    expect(shadow(element, "topology-floor-editor")).not.toBeNull();
  });

  // `?focus=exterior` used to resolve to a view that was never rendered, so it
  // silently fell through to the default sidebar with no indication of the scope.
  it("flags the exterior scope instead of resolving to a dead view", async () => {
    const { element } = await panel({
      search: "?focus=exterior",
      health: health({ exterior_on_non_outdoor_side: ["kitchen"] }),
    });
    expect(sideText(element)).toContain("Kitchen");
  });

  it("lists flagged edges by name for the geometry scope", async () => {
    const { element } = await panel({
      search: "?focus=geometry",
      health: health({ edges_spanning_multiple_floors: ["hall::kitchen"] }),
    });
    const text = sideText(element);
    expect(text).toContain("Hall ↔ Kitchen");
    expect(text).not.toContain("hall::kitchen");
  });

  it("clears ?focus= from the address bar on the way home", async () => {
    const { element } = await panel({ search: "?focus=floors" });
    expect(window.location.search).toBe("?focus=floors");

    shadow<HTMLButtonElement>(element, ".close-bar button")!.click();
    await settle(element);
    expect(window.location.search).toBe("");
  });
});
