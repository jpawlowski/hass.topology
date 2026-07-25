import { describe, it, expect } from "vitest";
import { AREA_TYPES, area, mount, recordingClient, selectValue, settle, shadow, shadowAll } from "./helpers.dom";
import type { TopologyAreaEditor } from "../editors/area-editor";

import "../editors/area-editor";

async function editor(areaOut = area("bedroom"), client = recordingClient()) {
  const element = await mount<TopologyAreaEditor>("topology-area-editor", {
    client: client.client,
    area: areaOut,
    areaTypes: AREA_TYPES,
  });
  return { element, calls: client.calls };
}

const typeSelect = (element: HTMLElement): HTMLSelectElement =>
  shadowAll<HTMLSelectElement>(element, "select")[0];
const envSelect = (element: HTMLElement): HTMLSelectElement =>
  shadowAll<HTMLSelectElement>(element, "select")[1];
const trustSelect = (element: HTMLElement): HTMLSelectElement =>
  shadowAll<HTMLSelectElement>(element, "select")[2];

describe("area editor: type is a select over the shipped catalog", () => {
  it("offers every catalog type plus a custom escape hatch", async () => {
    const { element } = await editor();
    const values = [...typeSelect(element).options].map((option) => option.value);
    for (const type of AREA_TYPES.catalog) {
      expect(values).toContain(type);
    }
    expect(values).toContain("__custom__");
  });

  // The reported bug: a datalist input filters its own suggestions by the text
  // already in it, so after picking one type the others were unreachable.
  it("still offers every other type after one is picked", async () => {
    const { element } = await editor();
    selectValue(typeSelect(element), "kitchen");
    await settle(element);

    const values = [...typeSelect(element).options].map((option) => option.value);
    for (const type of AREA_TYPES.catalog) {
      expect(values).toContain(type);
    }
    expect(typeSelect(element).value).toBe("kitchen");
  });

  it("reveals a free-text field for a type outside the catalog", async () => {
    const { element } = await editor();
    expect(shadow<HTMLInputElement>(element, "input")).toBeNull();

    selectValue(typeSelect(element), "__custom__");
    await settle(element);
    expect(shadow<HTMLInputElement>(element, "input")).not.toBeNull();
  });

  it("opens an off-catalog stored type in the free-text field", async () => {
    const { element } = await editor(area("sauna_room", { type: "sauna" }));
    const input = shadow<HTMLInputElement>(element, "input");
    expect(input).not.toBeNull();
    expect(input!.value).toBe("sauna");
    expect(typeSelect(element).value).toBe("__custom__");
  });
});

describe("area editor: the type cascade only fills gaps", () => {
  it("pre-fills environment and trust when both are empty", async () => {
    const { element } = await editor();
    selectValue(typeSelect(element), "bedroom");
    await settle(element);

    expect(envSelect(element).value).toBe("indoor");
    expect(trustSelect(element).value).toBe("private");
  });

  // Silently replacing a deliberate choice is the behaviour that made the type
  // field feel like it did more than suggest.
  it("leaves a value the user already chose alone", async () => {
    const { element } = await editor(area("bedroom", { trust: "shared" }));
    selectValue(typeSelect(element), "bedroom");
    await settle(element);

    expect(trustSelect(element).value).toBe("shared");
  });

  it("fills nothing for a type whose cascade has no trust", async () => {
    const { element } = await editor();
    selectValue(typeSelect(element), "terrace");
    await settle(element);

    expect(envSelect(element).value).toBe("outdoor");
    expect(trustSelect(element).value).toBe("");
  });
});

describe("area editor: stored values reach the DOM", () => {
  // Lit commits `.value` on a <select> before its <option> children exist, so a
  // plain binding is dropped on first render and the editor showed blank fields
  // for values that were stored. `live()` is what makes this pass.
  it("shows stored environment and trust on the very first render", async () => {
    const { element } = await editor(area("bedroom", { environment: "indoor", trust: "private" }));
    expect(envSelect(element).value).toBe("indoor");
    expect(trustSelect(element).value).toBe("private");
  });

  it("re-syncs when a different area is selected", async () => {
    const { element } = await editor(area("bedroom", { environment: "indoor", trust: "private" }));
    element.area = area("garden", { environment: "outdoor", trust: "public" });
    await settle(element);

    expect(envSelect(element).value).toBe("outdoor");
    expect(trustSelect(element).value).toBe("public");
  });
});

describe("area editor: saving", () => {
  it("sends the edited annotation", async () => {
    const { element, calls } = await editor();
    selectValue(typeSelect(element), "hallway");
    await settle(element);
    shadow<HTMLButtonElement>(element, "button.primary")!.click();

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("updateArea");
    expect(calls[0].args[0]).toBe("bedroom");
    expect(calls[0].args[1]).toEqual({ type: "hallway", environment: "indoor", trust: "shared" });
  });

  it("clears a field back to null rather than sending an empty string", async () => {
    const { element, calls } = await editor(area("bedroom", { type: "bedroom", trust: "private" }));
    selectValue(trustSelect(element), "");
    await settle(element);
    shadow<HTMLButtonElement>(element, "button.primary")!.click();

    expect(calls[0].args[1]).toEqual({ type: "bedroom", environment: null, trust: null });
  });
});
