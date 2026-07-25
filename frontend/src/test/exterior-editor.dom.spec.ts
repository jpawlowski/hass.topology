import { describe, it, expect } from "vitest";
import { PRESETS, area, hass, mount, recordingClient, settle, shadow, shadowAll } from "./helpers.dom";
import type { AreaOut, ConnectionOut } from "../api/types";
import type { TopologyExteriorEditor } from "../editors/exterior-editor";

import "../editors/exterior-editor";

const HASS = hass({
  areas: { hall: { name: "Hall", floor_id: "eg" } },
  floors: { eg: { name: "Ground", level: 0 } },
  binarySensors: { "binary_sensor.front_door": { name: "Front door", deviceClass: "door" } },
});

async function editor(target: AreaOut = area("hall"), flagged = false) {
  const client = recordingClient();
  const element = await mount<TopologyExteriorEditor>("topology-exterior-editor", {
    client: client.client,
    hass: HASS,
    area: target,
    presets: PRESETS,
    flagged,
  });
  return { element, calls: client.calls };
}

const addButton = (element: HTMLElement): HTMLButtonElement =>
  shadow<HTMLButtonElement>(element, ".actions button:not(.primary)")!;
const saveButton = (element: HTMLElement): HTMLButtonElement =>
  shadow<HTMLButtonElement>(element, "button.primary")!;

const window_ = (overrides: Partial<ConnectionOut> = {}): ConnectionOut => ({
  passage: "none",
  barrier: "door",
  glazed: true,
  preset_name: "window",
  ...overrides,
});

describe("exterior editor: the opening list", () => {
  it("says when there is nothing yet", async () => {
    const { element } = await editor();
    expect(shadow(element, ".empty")).not.toBeNull();
    expect(shadowAll(element, ".connection")).toHaveLength(0);
  });

  it("shows one block per stored opening", async () => {
    const { element } = await editor(
      area("hall", { exterior_connections: [window_({ side: "N" }), window_({ side: "S" })] }),
    );
    expect(shadowAll(element, ".connection")).toHaveLength(2);
    expect(shadow(element, ".empty")).toBeNull();
  });

  it("seeds a new opening as a window, not as whatever sorts first", async () => {
    const { element, calls } = await editor();
    addButton(element).click();
    await settle(element);
    saveButton(element).click();

    const sent = calls[0].args[1] as ConnectionOut[];
    expect(sent).toHaveLength(1);
    expect(sent[0].preset_name).toBe("window");
    expect(sent[0].glazed).toBe(true);
  });

  it("removes an opening and saves the list as a whole", async () => {
    // The write is a full-list replace, so a removal that failed to reach the
    // payload would silently keep the opening.
    const { element, calls } = await editor(
      area("hall", { exterior_connections: [window_({ side: "N" }), window_({ side: "S" })] }),
    );
    shadowAll<HTMLButtonElement>(element, "button.remove")[0].click();
    await settle(element);
    saveButton(element).click();

    expect(calls[0].method).toBe("setExteriorConnections");
    expect(calls[0].args[0]).toBe("hall");
    expect((calls[0].args[1] as ConnectionOut[]).map((c) => c.side)).toEqual(["S"]);
  });

  it("can clear every opening — an empty list is a legal write", async () => {
    const { element, calls } = await editor(area("hall", { exterior_connections: [window_({ side: "N" })] }));
    shadow<HTMLButtonElement>(element, "button.remove")!.click();
    await settle(element);
    saveButton(element).click();

    expect(calls[0].args[1]).toEqual([]);
  });

  it("re-reads the stored list when a different area is selected", async () => {
    const { element } = await editor(area("hall", { exterior_connections: [window_()] }));
    expect(shadowAll(element, ".connection")).toHaveLength(1);

    element.area = area("hall", { exterior_connections: [] });
    await settle(element);
    expect(shadowAll(element, ".connection")).toHaveLength(0);
  });
});

describe("exterior editor: guidance", () => {
  it("warns about an opening with no side — stored but inert", async () => {
    // Both derivations that give an exterior opening meaning skip a sideless one,
    // so accepting it quietly would leave the user with a model that does nothing.
    const { element } = await editor(area("hall", { exterior_connections: [window_()] }));
    expect(shadow(element, ".warn")).not.toBeNull();
  });

  it("stops warning once every opening has a side", async () => {
    const { element } = await editor(area("hall", { exterior_connections: [window_({ side: "N" })] }));
    expect(shadow(element, ".warn")).toBeNull();
  });

  it("names the outer walls the user has declared", async () => {
    const { element } = await editor(area("hall", { beyond: { N: "outdoor", W: "neighbor" } }));
    const hints = shadowAll(element, ".hint").map((node) => node.textContent ?? "");
    expect(hints.join(" ")).toContain("North");
    expect(hints.join(" ")).toContain("West");
  });

  it("says nothing about outer walls when none are declared", async () => {
    const { element } = await editor();
    const hints = shadowAll(element, ".hint").map((node) => node.textContent ?? "");
    expect(hints.join(" ")).not.toContain("North");
  });

  it("marks itself flagged when the consistency overlay points here", async () => {
    const { element } = await editor(area("hall"), true);
    expect(shadow(element, ".editor.flagged")).not.toBeNull();
  });
});

describe("exterior editor: only exterior kinds", () => {
  it("offers windows and outside doors, never a room boundary", async () => {
    // The picker used to list every preset, so `interior_door`, `lift` and
    // `shared_wall` were on offer as "windows / outside doors".
    const { element } = await editor(area("hall", { exterior_connections: [window_({ side: "N" })] }));
    const fields = shadow(element, "topology-connection-fields")!;
    const options = [...(fields.shadowRoot?.querySelectorAll("option") ?? [])].map(
      (option) => (option as HTMLOptionElement).value,
    );
    expect(options).toContain("window");
    expect(options).toContain("outside_door");
    expect(options).not.toContain("interior_door");
    expect(options).not.toContain("shared_wall");
  });
});
