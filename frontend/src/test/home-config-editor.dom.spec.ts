import { describe, it, expect } from "vitest";
import { homeConfig, mount, recordingClient, selectValue, settle, shadow, shadowAll } from "./helpers.dom";
import type { HomeConfigOut } from "../api/types";
import type { TopologyHomeConfigEditor } from "../editors/home-config-editor";

import "../editors/home-config-editor";

async function editor(config: HomeConfigOut = homeConfig()) {
  const client = recordingClient();
  const element = await mount<TopologyHomeConfigEditor>("topology-home-config-editor", {
    client: client.client,
    homeConfig: config,
  });
  return { element, calls: client.calls };
}

const extentSelect = (element: HTMLElement): HTMLSelectElement =>
  shadow<HTMLSelectElement>(element, "select")!;
const thresholdInput = (element: HTMLElement): HTMLInputElement =>
  shadow<HTMLInputElement>(element, 'input[type="number"]')!;
const checkboxes = (element: HTMLElement): HTMLInputElement[] =>
  shadowAll<HTMLInputElement>(element, 'input[type="checkbox"]');

function check(box: HTMLInputElement, value: boolean): void {
  box.checked = value;
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

function setNumber(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("home config editor: seeding from the stored config", () => {
  it("shows the stored extent on first render", async () => {
    // The select's selection is expressed per option, not only through `.value`:
    // Lit commits `.value` before the <option> children exist, so a `live()`
    // binding alone renders the first option until something re-renders.
    const { element } = await editor(homeConfig({ occupancy_extent: "unit_within_building" }));
    expect(extentSelect(element).value).toBe("unit_within_building");
  });

  it("shows the stored threshold and toggles on first render", async () => {
    const { element } = await editor(
      homeConfig({
        unannotated_repair_threshold: 7,
        projection_toggles: { environment: true, type: false, trust: true },
      }),
    );
    expect(thresholdInput(element).value).toBe("7");
    expect(checkboxes(element).map((box) => box.checked)).toEqual([true, false, true]);
  });

  it("re-seeds when a different config arrives", async () => {
    const { element } = await editor(homeConfig({ unannotated_repair_threshold: 3 }));
    element.homeConfig = homeConfig({ unannotated_repair_threshold: 12 });
    await settle(element);
    expect(thresholdInput(element).value).toBe("12");
  });
});

describe("home config editor: saving", () => {
  it("sends nothing until the save button is pressed", async () => {
    const { element, calls } = await editor();
    selectValue(extentSelect(element), "unit_within_building");
    check(checkboxes(element)[0], true);
    await settle(element);
    expect(calls).toHaveLength(0);
  });

  it("sends the whole config in one write", async () => {
    const { element, calls } = await editor();
    selectValue(extentSelect(element), "unit_within_building");
    setNumber(thresholdInput(element), "9");
    check(checkboxes(element)[1], true);
    await settle(element);
    shadow<HTMLButtonElement>(element, "button.primary")!.click();

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("updateHomeConfig");
    expect(calls[0].args[0]).toEqual({
      occupancy_extent: "unit_within_building",
      unannotated_repair_threshold: 9,
      projection_toggles: { environment: false, type: true, trust: false },
    });
  });

  it("keeps the threshold at a legal value rather than sending zero", async () => {
    // The backend range is 1..100; a cleared field must not become a 0 that the
    // write then rejects.
    const { element, calls } = await editor();
    setNumber(thresholdInput(element), "");
    await settle(element);
    shadow<HTMLButtonElement>(element, "button.primary")!.click();

    expect((calls[0].args[0] as { unannotated_repair_threshold: number }).unannotated_repair_threshold).toBe(1);
  });

  it("can turn every projection off again", async () => {
    const { element, calls } = await editor(
      homeConfig({ projection_toggles: { environment: true, type: true, trust: true } }),
    );
    for (const box of checkboxes(element)) {
      check(box, false);
    }
    await settle(element);
    shadow<HTMLButtonElement>(element, "button.primary")!.click();

    expect((calls[0].args[0] as { projection_toggles: Record<string, boolean> }).projection_toggles).toEqual({
      environment: false,
      type: false,
      trust: false,
    });
  });
});
