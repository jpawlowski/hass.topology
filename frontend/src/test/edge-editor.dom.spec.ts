import { describe, it, expect } from "vitest";
import { PRESETS, edge, hass, mount, recordingClient, settle, shadow, shadowAll } from "./helpers.dom";
import type { ConnectionOut, EdgeOut } from "../api/types";
import type { TopologyEdgeEditor } from "../editors/edge-editor";

import "../editors/edge-editor";

const HASS = hass({
  areas: {
    hall: { name: "Hall", floor_id: "eg" },
    bedroom: { name: "Bedroom", floor_id: "og" },
  },
  floors: { og: { name: "Upper", level: 1 }, eg: { name: "Ground", level: 0 } },
});

async function editor(target: EdgeOut = edge("hall", "bedroom")) {
  const client = recordingClient();
  const element = await mount<TopologyEdgeEditor>("topology-edge-editor", {
    client: client.client,
    hass: HASS,
    edge: target,
    presets: PRESETS,
  });
  return { element, calls: client.calls };
}

const button = (element: HTMLElement, selector: string): HTMLButtonElement =>
  shadow<HTMLButtonElement>(element, selector)!;

/** The "add another connection" button — the unclassed one in the action row. */
const addButton = (element: HTMLElement): HTMLButtonElement =>
  button(element, ".actions button:not(.primary):not(.danger)");

describe("edge editor: the bundle", () => {
  it("shows one connection block per bundle member", async () => {
    const { element } = await editor(
      edge("hall", "bedroom", {
        connections: [
          { passage: "stairs", barrier: "open" },
          { passage: "elevator", barrier: "door" },
        ],
      }),
    );
    expect(shadowAll(element, ".connection")).toHaveLength(2);
  });

  it("adds a connection seeded from an interior preset, never an exterior one", async () => {
    const { element, calls } = await editor();
    addButton(element).click();
    await settle(element);
    expect(shadowAll(element, ".connection")).toHaveLength(2);

    button(element, "button.primary").click();
    const sent = calls[0].args[2] as ConnectionOut[];
    expect(sent).toHaveLength(2);
    // The seed comes from the shipped table's first *interior* preset — the list
    // used to include every preset, so a window was on offer as a room boundary.
    expect(sent[1].preset_name).toBe("interior_door");
  });

  it("removes a connection without touching the others", async () => {
    const { element, calls } = await editor(
      edge("hall", "bedroom", {
        connections: [
          { passage: "stairs", barrier: "open" },
          { passage: "elevator", barrier: "door" },
        ],
      }),
    );
    shadowAll<HTMLButtonElement>(element, "button.remove")[0].click();
    await settle(element);
    button(element, "button.primary").click();

    expect(calls[0].method).toBe("upsertEdge");
    expect(calls[0].args[2]).toEqual([{ passage: "elevator", barrier: "door" }]);
  });

  it("saves the bundle against the edge's own endpoints", async () => {
    const { element, calls } = await editor();
    button(element, "button.primary").click();

    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe("bedroom");
    expect(calls[0].args[1]).toBe("hall");
  });
});

describe("edge editor: deleting", () => {
  it("deletes on the explicit delete button and clears the selection", async () => {
    const { element, calls } = await editor();
    let cleared = false;
    element.addEventListener("selection-cleared", () => {
      cleared = true;
    });
    button(element, "button.danger").click();
    await settle(element);

    expect(calls[0].method).toBe("deleteEdge");
    expect(calls[0].args[0]).toBe("bedroom::hall");
    expect(cleared).toBe(true);
  });

  it("treats saving an empty bundle as a delete, and warns first", async () => {
    // An interior edge must carry a non-empty bundle, so "save nothing" can only
    // mean delete — the alternative is a store write the backend would reject.
    const { element, calls } = await editor();
    shadowAll<HTMLButtonElement>(element, "button.remove")[0].click();
    await settle(element);
    expect(shadow(element, ".warn")).not.toBeNull();

    button(element, "button.primary").click();
    await settle(element);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("deleteEdge");
  });
});

describe("edge editor: how the two ends sit", () => {
  it("says same floor for a horizontal edge", async () => {
    const { element } = await editor(edge("hall", "bedroom", { axis: "horizontal", level_delta: 0 }));
    expect(shadow(element, ".axis")!.textContent).toContain("Same floor");
  });

  it("names which end is above, using registry names", async () => {
    // level_delta is signed area_a -> area_b, and area_a is the smaller id
    // (bedroom), so +1 means the hall is the upper one.
    const { element } = await editor(edge("hall", "bedroom", { axis: "vertical", level_delta: 1 }));
    const text = shadow(element, ".axis")!.textContent ?? "";
    expect(text).toContain("Hall");
    expect(text).toContain("Bedroom");
    expect(text).toContain("above");
  });

  it("admits it cannot tell when a level is unresolvable", async () => {
    const { element } = await editor(edge("hall", "bedroom", { axis: "unknown", level_delta: null }));
    expect(shadow(element, ".axis")!.textContent).toContain("Floor relationship unknown");
  });
});
