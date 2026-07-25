import { describe, it, expect } from "vitest";
import {
  PRESETS,
  area,
  edge,
  floor,
  hass,
  mount,
  recordingClient,
  selectValue,
  settle,
  shadow,
  shadowAll,
} from "./helpers.dom";
import type { EdgeOut } from "../api/types";
import type { TopologyNeighborsEditor } from "../editors/neighbors-editor";

import "../editors/neighbors-editor";

/** A two-storey home: hall + kitchen on the ground floor, bedroom above. */
const HASS = hass({
  areas: {
    hall: { name: "Hall", floor_id: "eg" },
    kitchen: { name: "Kitchen", floor_id: "eg" },
    bedroom: { name: "Bedroom", floor_id: "og" },
    attic: { name: "Attic", floor_id: "dg" },
    shed: { name: "Shed", floor_id: null },
  },
  floors: { dg: { name: "Attic floor", level: 2 }, og: { name: "Upper", level: 1 }, eg: { name: "Ground", level: 0 } },
});

const FLOORS = [floor("dg", 2), floor("og", 1), floor("eg", 0)];
const AREAS = [area("hall"), area("kitchen"), area("bedroom"), area("attic"), area("shed")];

async function editor(edges: EdgeOut[] = [], areaId = "hall") {
  const client = recordingClient();
  const element = await mount<TopologyNeighborsEditor>("topology-neighbors-editor", {
    client: client.client,
    hass: HASS,
    area: area(areaId),
    areas: AREAS,
    edges,
    floors: FLOORS,
    presets: PRESETS,
  });
  return { element, calls: client.calls };
}

const areaSelect = (element: HTMLElement): HTMLSelectElement =>
  shadowAll<HTMLSelectElement>(element, "select")[0];
const presetSelect = (element: HTMLElement): HTMLSelectElement =>
  shadowAll<HTMLSelectElement>(element, "select")[1];

describe("neighbours editor: creating the first edge", () => {
  // The headline gap: with no edge on the map there was no way to open an edge
  // editor, so the adjacency graph could only be built from Developer Tools.
  it("can create an edge on an area that has none", async () => {
    const { element, calls } = await editor();
    expect(shadow(element, ".empty")).not.toBeNull();

    selectValue(areaSelect(element), "kitchen");
    await settle(element);
    selectValue(presetSelect(element), "interior_door");
    await settle(element);
    shadow<HTMLButtonElement>(element, "button.primary")!.click();
    await settle(element);

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("upsertEdge");
    expect(calls[0].args[0]).toBe("hall");
    expect(calls[0].args[1]).toBe("kitchen");
    expect(calls[0].args[2]).toEqual([
      { passage: "level", barrier: "door", glazed: false, preset_name: "interior_door" },
    ]);
  });

  it("refuses to send until both an area and a kind are chosen", async () => {
    const { element, calls } = await editor();
    const add = shadow<HTMLButtonElement>(element, "button.primary")!;
    expect(add.disabled).toBe(true);

    selectValue(areaSelect(element), "kitchen");
    await settle(element);
    expect(shadow<HTMLButtonElement>(element, "button.primary")!.disabled).toBe(true);

    selectValue(presetSelect(element), "interior_door");
    await settle(element);
    expect(shadow<HTMLButtonElement>(element, "button.primary")!.disabled).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe("neighbours editor: candidates reflect the building", () => {
  it("groups candidates by how their floors relate", async () => {
    const { element } = await editor();
    const groups = shadowAll<HTMLOptGroupElement>(element, "optgroup");
    const byLabel = new Map(
      groups.map((group) => [
        group.label,
        [...group.querySelectorAll("option")].map((option) => option.value),
      ]),
    );

    expect(byLabel.get("Same floor")).toEqual(["kitchen"]);
    expect(byLabel.get("Floor above")).toEqual(["bedroom"]);
    // The attic is two storeys up — offered, but under the "unusual" heading.
    expect(byLabel.get("Other floors (unusual)")).toEqual(["attic"]);
    expect(byLabel.get("No floor assigned")).toEqual(["shed"]);
  });

  it("never offers the area itself, nor one that is already a neighbour", async () => {
    const { element } = await editor([edge("hall", "kitchen")]);
    const values = [...areaSelect(element).options].map((option) => option.value);
    expect(values).not.toContain("hall");
    expect(values).not.toContain("kitchen");
    expect(values).toContain("bedroom");
  });

  it("warns when the picked area is more than one floor away", async () => {
    const { element } = await editor();
    expect(shadow(element, ".warn")).toBeNull();

    selectValue(areaSelect(element), "attic");
    await settle(element);
    expect(shadow(element, ".warn")).not.toBeNull();
  });
});

describe("neighbours editor: offered kinds match the boundary", () => {
  it("offers step-free kinds for a same-floor neighbour", async () => {
    const { element } = await editor();
    selectValue(areaSelect(element), "kitchen");
    await settle(element);

    const values = [...presetSelect(element).options].map((option) => option.value);
    expect(values).toContain("interior_door");
    expect(values).toContain("open_passage");
    expect(values).not.toContain("enclosed_stair");
  });

  it("offers climbing kinds for a neighbour one floor up", async () => {
    const { element } = await editor();
    selectValue(areaSelect(element), "bedroom");
    await settle(element);

    const values = [...presetSelect(element).options].map((option) => option.value);
    expect(values).toContain("enclosed_stair");
    expect(values).not.toContain("interior_door");
    // A slab declares "these touch" with no way through — valid on any boundary.
    expect(values).toContain("ceiling");
  });

  it("never offers an exterior kind — an edge joins two of your own areas", async () => {
    const { element } = await editor();
    selectValue(areaSelect(element), "kitchen");
    await settle(element);

    const values = [...presetSelect(element).options].map((option) => option.value);
    expect(values).not.toContain("window");
    expect(values).not.toContain("outside_door");
  });

  it("drops a chosen kind when the picked area changes the boundary", async () => {
    const { element } = await editor();
    selectValue(areaSelect(element), "kitchen");
    await settle(element);
    selectValue(presetSelect(element), "interior_door");
    await settle(element);

    // Switching to an upstairs area makes a step-free door wrong for it.
    selectValue(areaSelect(element), "bedroom");
    await settle(element);
    expect(presetSelect(element).value).toBe("");
  });
});

describe("neighbours editor: existing neighbours", () => {
  it("lists a neighbour and says how the two sit relative to each other", async () => {
    const { element } = await editor([
      edge("hall", "kitchen"),
      edge("bedroom", "hall", { axis: "vertical", level_delta: -1 }),
    ]);
    const text = element.shadowRoot!.textContent ?? "";
    expect(text).toContain("Kitchen");
    expect(text).toContain("Same floor");
    // level_delta is signed area_a -> area_b (bedroom -> hall = -1), so from the
    // hall's side the bedroom is one floor *up*.
    expect(text).toContain("Bedroom is 1 floor(s) above Hall");
  });

  it("emits edge-selected so the edge editor can open from here", async () => {
    const { element } = await editor([edge("hall", "kitchen")]);
    let selected: string | null = null;
    element.addEventListener("edge-selected", (ev) => {
      selected = (ev as CustomEvent<{ edge: { edge_id: string } }>).detail.edge.edge_id;
    });
    shadow<HTMLButtonElement>(element, "button.link")!.click();

    expect(selected).toBe("hall::kitchen");
  });
});
