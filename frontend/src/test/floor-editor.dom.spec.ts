import { describe, it, expect } from "vitest";
import { floor, hass, mount, recordingClient, shadow, shadowAll } from "./helpers.dom";
import type { FloorOut } from "../api/types";
import type { TopologyFloorEditor } from "../editors/floor-editor";

import "../editors/floor-editor";

const HASS = hass({
  floors: {
    og: { name: "Upper", level: 1 },
    eg: { name: "Ground", level: 0 },
    cellar: { name: "Basement", level: null },
  },
});

async function editor(floors: FloorOut[], flagged: Set<string> = new Set()) {
  const client = recordingClient();
  const element = await mount<TopologyFloorEditor>("topology-floor-editor", {
    client: client.client,
    hass: HASS,
    floors,
    flagged,
  });
  return { element, calls: client.calls };
}

/** A floor the registry has no level for — the only case an override applies to. */
const unlevelled = (floorId: string, override: number | null = null): FloorOut => ({
  floor_id: floorId,
  registry_level: null,
  level_override: override,
  effective_level: override,
});

function setInput(element: HTMLElement, value: string): void {
  const input = shadow<HTMLInputElement>(element, "input")!;
  input.value = value;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("floor editor: the rows", () => {
  it("says so when there are no floors at all", async () => {
    const { element } = await editor([]);
    expect(shadowAll(element, ".row")).toHaveLength(0);
    expect(shadowAll(element, ".hint").length).toBeGreaterThan(1);
  });

  it("keeps the server's top-down order — the list is the section", async () => {
    const { element } = await editor([floor("og", 1), floor("eg", 0), unlevelled("cellar")]);
    const names = shadowAll(element, ".name").map((node) => node.textContent?.trim());
    expect(names).toEqual(["Upper", "Ground", "Basement"]);
  });

  it("falls back to the id when the registry has no name for a floor", async () => {
    const { element } = await editor([floor("attic", 2)]);
    expect(shadow(element, ".name")!.textContent?.trim()).toBe("attic");
  });

  it("highlights a flagged floor", async () => {
    const { element } = await editor([floor("og", 1), floor("eg", 0)], new Set(["eg"]));
    const rows = shadowAll(element, ".row");
    expect(rows[0].classList.contains("flagged")).toBe(false);
    expect(rows[1].classList.contains("flagged")).toBe(true);
  });
});

describe("floor editor: where an override is offered", () => {
  it("offers no input where the registry already has a level", async () => {
    // The registry level always wins, so an editable field there would promise
    // an effect it cannot have.
    const { element } = await editor([floor("og", 1)]);
    expect(shadow(element, "input")).toBeNull();
    expect(shadow(element, ".registry")!.textContent).toContain("1");
  });

  it("offers an input where the registry level is missing", async () => {
    const { element } = await editor([unlevelled("cellar")]);
    expect(shadow(element, "input")).not.toBeNull();
    expect(shadow(element, ".registry")).toBeNull();
  });

  it("always shows which value actually won", async () => {
    const { element } = await editor([floor("og", 1), unlevelled("cellar", -1), unlevelled("attic")]);
    const effective = shadowAll(element, ".effective").map((node) => node.textContent?.trim());
    expect(effective[0]).toContain("1");
    expect(effective[1]).toContain("-1");
    // Neither source has a level, so there is nothing to show — not a zero.
    expect(effective[2]).toContain("—");
  });

  it("renders a stored override in the input on first render", async () => {
    const { element } = await editor([unlevelled("cellar", -1)]);
    expect(shadow<HTMLInputElement>(element, "input")!.value).toBe("-1");
  });
});

describe("floor editor: writing", () => {
  it("stores a level, including a negative one", async () => {
    const { element, calls } = await editor([unlevelled("cellar")]);
    setInput(element, "-1");

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("setFloorLevel");
    expect(calls[0].args).toEqual(["cellar", -1]);
  });

  it("stores zero as a level, not as an absence", async () => {
    // A ground floor is `0` where that is the convention; coercing it to null
    // would drop the floor out of the ordering entirely.
    const { element, calls } = await editor([unlevelled("cellar")]);
    setInput(element, "0");
    expect(calls[0].args).toEqual(["cellar", 0]);
  });

  it("clears the override on an emptied field", async () => {
    const { element, calls } = await editor([unlevelled("cellar", -1)]);
    setInput(element, "  ");
    expect(calls[0].args).toEqual(["cellar", null]);
  });

  it("never writes garbage for text that is not a number", async () => {
    // A `type="number"` field sanitizes non-numeric text to the empty string, so
    // what actually reaches the handler is a clear, not a NaN — the NaN guard is
    // belt-and-braces for a programmatic caller, not a path the UI can take.
    const { element, calls } = await editor([unlevelled("cellar", -1)]);
    setInput(element, "deep");
    expect(calls).toEqual([{ method: "setFloorLevel", args: ["cellar", null] }]);
  });
});
