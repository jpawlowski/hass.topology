import { describe, it, expect } from "vitest";
import { PRESETS, hass, mount, selectValue, settle, shadow, shadowAll } from "./helpers.dom";
import type { ConnectionOut } from "../api/types";
import type { TopologyConnectionFields } from "../editors/connection-fields";

import "../editors/connection-fields";

const HASS = hass({
  binarySensors: {
    "binary_sensor.front_door": { name: "Front door", deviceClass: "door" },
    "binary_sensor.kitchen_window": { name: "Kitchen window", deviceClass: "window" },
    "binary_sensor.washer_running": { name: "Washer running", deviceClass: "running" },
  },
});

async function fields(connection: ConnectionOut, over: Partial<TopologyConnectionFields> = {}) {
  const changes: ConnectionOut[] = [];
  const element = await mount<TopologyConnectionFields>("topology-connection-fields", {
    hass: HASS,
    connection,
    presets: PRESETS,
    scope: "interior",
    ...over,
  });
  element.addEventListener("connection-changed", (ev) => {
    changes.push((ev as CustomEvent<{ connection: ConnectionOut }>).detail.connection);
  });
  return { element, changes };
}

const door = (): ConnectionOut => ({
  passage: "level",
  barrier: "door",
  preset_name: "interior_door",
});

const labelled = (element: HTMLElement, label: string): HTMLSelectElement =>
  shadowAll<HTMLLabelElement>(element, "label")
    .filter((row) => (row.textContent ?? "").includes(label))
    .map((row) => row.querySelector("select"))
    .find((select): select is HTMLSelectElement => select !== null)!;

describe("connection fields: presets are filtered by scope", () => {
  // The exterior editor used to offer all presets, so `interior_door` and `lift`
  // appeared as choices for "windows and outside doors".
  it("offers only exterior kinds in exterior scope", async () => {
    const { element } = await fields({ passage: "none", barrier: "door" }, { scope: "exterior" });
    const values = [...labelled(element, "Kind").options].map((option) => option.value);
    expect(values).toContain("window");
    expect(values).toContain("outside_door");
    expect(values).not.toContain("interior_door");
    expect(values).not.toContain("shared_wall");
  });

  it("offers only interior kinds in interior scope", async () => {
    const { element } = await fields(door());
    const values = [...labelled(element, "Kind").options].map((option) => option.value);
    expect(values).toContain("interior_door");
    expect(values).not.toContain("window");
  });

  it("expands a chosen kind through the server table", async () => {
    const { element, changes } = await fields(door());
    selectValue(labelled(element, "Kind"), "shared_wall");

    expect(changes).toHaveLength(1);
    expect(changes[0].passage).toBe("none");
    expect(changes[0].barrier).toBe("solid");
    expect(changes[0].preset_name).toBe("shared_wall");
  });
});

describe("connection fields: the side an opening faces", () => {
  // Without a side, both derivations that consume an exterior opening skip it —
  // the field simply did not exist in the editor before.
  it("can set and clear a side", async () => {
    const { element, changes } = await fields(door());
    selectValue(labelled(element, "Side"), "N");
    expect(changes[0].side).toBe("N");

    element.connection = { ...door(), side: "N" };
    await settle(element);
    selectValue(labelled(element, "Side"), "");
    expect(changes[1].side).toBeUndefined();
  });

  it("shows a stored side on the first render", async () => {
    const { element } = await fields({ ...door(), side: "W" });
    expect(labelled(element, "Side").value).toBe("W");
  });
});

describe("connection fields: binding an open/close sensor", () => {
  it("offers binary sensors, opening-ish device classes first", async () => {
    const { element } = await fields(door());
    const options = [...labelled(element, "Open/close sensor").options].map((option) => option.value);
    expect(options[0]).toBe("");
    // Front door and kitchen window are opening classes; the washer is not.
    expect(options.slice(1, 3)).toEqual(["binary_sensor.front_door", "binary_sensor.kitchen_window"]);
    expect(options[3]).toBe("binary_sensor.washer_running");
  });

  it("binds a sensor so the perimeter sensor has something to observe", async () => {
    const { element, changes } = await fields(door());
    selectValue(labelled(element, "Open/close sensor"), "binary_sensor.front_door");
    expect(changes[0].sensor_entity_id).toBe("binary_sensor.front_door");
  });

  it("refuses a sensor on a kind that cannot carry one", async () => {
    const { element } = await fields({
      passage: "level",
      barrier: "open",
      preset_name: "open_passage",
    });
    expect(labelled(element, "Open/close sensor")).toBeUndefined();
    expect(element.shadowRoot!.textContent).toContain("Only a door-type kind can carry a sensor");
  });

  // The backend rejects the whole save with `invalid_connection` if a non-door
  // keeps a binding, so switching kind has to drop it.
  it("drops a bound sensor when the kind can no longer carry one", async () => {
    const { element, changes } = await fields({
      ...door(),
      sensor_entity_id: "binary_sensor.front_door",
    });
    selectValue(labelled(element, "Kind"), "open_passage");

    expect(changes[0].sensor_entity_id).toBeUndefined();
  });

  it("keeps a bound sensor when the new kind still allows one", async () => {
    const { element, changes } = await fields({
      ...door(),
      sensor_entity_id: "binary_sensor.front_door",
    });
    selectValue(labelled(element, "Kind"), "enclosed_stair");

    expect(changes[0].sensor_entity_id).toBe("binary_sensor.front_door");
  });
});

describe("connection fields: the optional flags", () => {
  it("toggles glazed", async () => {
    const { element, changes } = await fields(door());
    const checkbox = shadow<HTMLInputElement>(element, 'input[type="checkbox"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));

    expect(changes[0].glazed).toBe(true);
  });

  it("hides inline trust on an interior edge and shows it on an exterior opening", async () => {
    const interior = await fields(door());
    expect(labelled(interior.element, "Trust beyond")).toBeUndefined();

    const exterior = await fields(
      { passage: "none", barrier: "door", preset_name: "window" },
      { scope: "exterior", allowInlineTrust: true },
    );
    expect(labelled(exterior.element, "Trust beyond")).not.toBeUndefined();
  });

  it("exposes the perimeter override only where it is offered", async () => {
    const without = await fields(door());
    expect(without.element.shadowRoot!.textContent).not.toContain("Always treat as perimeter");

    const { element, changes } = await fields(door(), { allowOverride: true });
    expect(element.shadowRoot!.textContent).toContain("Always treat as perimeter");

    const boxes = shadowAll<HTMLInputElement>(element, 'input[type="checkbox"]');
    const override = boxes.at(-1)!;
    override.checked = true;
    override.dispatchEvent(new Event("change", { bubbles: true }));
    expect(changes[0].perimeter_override).toBe(true);
  });
});
