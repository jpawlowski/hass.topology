import { describe, it, expect } from "vitest";
import { area, edge, hass, mount, recordingClient, selectValue, shadow, shadowAll } from "./helpers.dom";
import type { AreaOut, EdgeOut, OccupancyExtent } from "../api/types";
import type { TopologyBeyondEditor } from "../editors/beyond-editor";

import "../editors/beyond-editor";

const HASS = hass({
  areas: {
    hall: { name: "Hall", floor_id: "eg" },
    kitchen: { name: "Kitchen", floor_id: "eg" },
    porch: { name: "Porch", floor_id: "eg" },
  },
  floors: { eg: { name: "Ground", level: 0 } },
});

async function editor(options: { area?: AreaOut; edges?: EdgeOut[]; extent?: OccupancyExtent | null } = {}) {
  const client = recordingClient();
  const element = await mount<TopologyBeyondEditor>("topology-beyond-editor", {
    client: client.client,
    hass: HASS,
    area: options.area ?? area("hall"),
    edges: options.edges ?? [],
    occupancyExtent: options.extent === undefined ? null : options.extent,
  });
  return { element, calls: client.calls };
}

const sideSelect = (element: HTMLElement, index: number): HTMLSelectElement =>
  shadowAll<HTMLSelectElement>(element, "select")[index];

describe("beyond editor: the four sides", () => {
  it("offers every side, unset by default", async () => {
    const { element } = await editor();
    const selects = shadowAll<HTMLSelectElement>(element, "select");
    expect(selects).toHaveLength(4);
    expect(selects.every((select) => select.value === "")).toBe(true);
  });

  it("shows a stored value on first render", async () => {
    // `live()` reads back the committed `.value`, and Lit commits it before the
    // <option> children exist — so a select whose selection is only expressed
    // through `.value` renders empty until something forces a second render. The
    // fix is `.selected` per option; this asserts the *first* render.
    const { element } = await editor({ area: area("hall", { beyond: { N: "neighbor", S: "outdoor" } }) });
    expect(sideSelect(element, 0).value).toBe("neighbor");
    expect(sideSelect(element, 2).value).toBe("outdoor");
    expect(sideSelect(element, 1).value).toBe("");
  });

  it("writes one side at a time", async () => {
    const { element, calls } = await editor();
    selectValue(sideSelect(element, 3), "earth");

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("setBeyond");
    expect(calls[0].args).toEqual(["hall", "W", "earth"]);
  });

  it("clears a side by sending null, not an empty string", async () => {
    const { element, calls } = await editor({ area: area("hall", { beyond: { N: "outdoor" } }) });
    selectValue(sideSelect(element, 0), "");

    expect(calls[0].args).toEqual(["hall", "N", null]);
  });

  it("labels the open-air class as such, not as the environment of the same name", async () => {
    const { element } = await editor();
    const options = [...sideSelect(element, 0).options].map((option) => option.textContent?.trim());
    expect(options).toContain("Open air");
  });
});

describe("beyond editor: sides that already border a room", () => {
  it("names the neighbour occupying a side", async () => {
    const { element } = await editor({
      edges: [edge("hall", "kitchen", { connections: [{ passage: "level", barrier: "door", side: "N" }] })],
    });
    const text = element.shadowRoot!.textContent ?? "";
    expect(text).toContain("Kitchen");
  });

  it("mirrors the bearing when this area is the far end of the edge", async () => {
    // `side` is recorded from area_a's point of view; the far area meets the same
    // wall from the opposite bearing. Without the mirror the neighbour is shown
    // against the wrong wall — silently, and on exactly half the edges.
    const { element } = await editor({
      area: area("porch"),
      // sorted: area_a = hall, area_b = porch. side N is the hall's north wall,
      // so the porch meets it from the south.
      edges: [edge("hall", "porch", { connections: [{ passage: "level", barrier: "door", side: "N" }] })],
    });
    const notes = shadowAll(element, ".interior");
    expect(notes).toHaveLength(1);
    const sides = shadowAll(element, ".side");
    expect(sides[2].textContent).toContain("Hall");
  });

  it("offers no suggestion for a side that is already an interior wall", async () => {
    const { element } = await editor({
      extent: "whole_property",
      edges: [edge("hall", "kitchen", { connections: [{ passage: "level", barrier: "door", side: "N" }] })],
    });
    const sides = shadowAll(element, ".side");
    expect(sides[0].querySelector(".suggestion")).toBeNull();
    expect(sides[1].querySelector(".suggestion")).not.toBeNull();
  });
});

describe("beyond editor: extent-driven suggestions", () => {
  it("suggests open air for a standalone property", async () => {
    const { element } = await editor({ extent: "whole_property" });
    expect(shadowAll(element, ".suggestion")).toHaveLength(4);
    expect(shadow(element, ".suggestion button")!.textContent).toContain("Open air");
  });

  it("suggests a neighbouring unit inside a building", async () => {
    const { element } = await editor({ extent: "unit_within_building" });
    expect(shadow(element, ".suggestion button")!.textContent).toContain("Neighbouring unit");
  });

  it("suggests nothing when the extent is unknown, rather than guessing", async () => {
    const { element } = await editor({ extent: null });
    expect(shadowAll(element, ".suggestion")).toHaveLength(0);
  });

  it("stops suggesting once the side is set", async () => {
    const { element } = await editor({
      extent: "whole_property",
      area: area("hall", { beyond: { N: "outdoor" } }),
    });
    expect(shadowAll(element, ".suggestion")).toHaveLength(3);
  });

  it("accepting a suggestion writes exactly that value", async () => {
    const { element, calls } = await editor({ extent: "whole_property" });
    shadow<HTMLButtonElement>(element, ".suggestion button")!.click();
    expect(calls[0].args).toEqual(["hall", "N", "outdoor"]);
  });
});
