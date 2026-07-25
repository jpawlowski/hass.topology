import { describe, it, expect } from "vitest";
import { area, edge, hass, mount, recordingClient, shadow, shadowAll } from "./helpers.dom";
import type { AreaOut, EdgeOut } from "../api/types";
import type { TopologyOrphansView } from "../editors/orphans-view";

import "../editors/orphans-view";

/** Only `hall` and `kitchen` still exist in the registry; `shed` is gone. */
const HASS = hass({
  areas: {
    hall: { name: "Hall", floor_id: "eg" },
    kitchen: { name: "Kitchen", floor_id: "eg" },
  },
  floors: { eg: { name: "Ground", level: 0 } },
});

const ORPHANED = "2026-01-01T00:00:00+00:00";

async function view(options: { areas?: AreaOut[]; edges?: EdgeOut[] } = {}) {
  const client = recordingClient();
  const element = await mount<TopologyOrphansView>("topology-orphans-view", {
    client: client.client,
    hass: HASS,
    areas: options.areas ?? [],
    edges: options.edges ?? [],
  });
  return { element, calls: client.calls };
}

describe("orphans view: what it lists", () => {
  it("says there is nothing to review when nothing is orphaned", async () => {
    const { element } = await view({ areas: [area("hall")], edges: [edge("hall", "kitchen")] });
    expect(shadowAll(element, ".row")).toHaveLength(0);
    expect(element.shadowRoot!.textContent).toContain("No orphaned");
  });

  it("lists only the orphaned entries, never the live ones", async () => {
    const { element } = await view({
      areas: [area("hall"), area("shed", { orphaned_at: ORPHANED })],
      edges: [edge("hall", "kitchen"), edge("hall", "shed", { orphaned_at: ORPHANED })],
    });
    const rows = shadowAll(element, ".row");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("shed");
    expect(rows[1].textContent).toContain("Hall");
  });

  it("names an orphaned area by its id — the registry entry it had is gone", async () => {
    const { element } = await view({ areas: [area("shed", { orphaned_at: ORPHANED })] });
    expect(shadow(element, ".row")!.textContent?.trim()).toBe("shed");
  });

  it("shows both ends of an orphaned edge", async () => {
    const { element } = await view({ edges: [edge("hall", "kitchen", { orphaned_at: ORPHANED })] });
    const text = shadow(element, ".row")!.textContent ?? "";
    expect(text).toContain("Hall");
    expect(text).toContain("Kitchen");
  });
});

describe("orphans view: restoring an edge", () => {
  it("offers restore only when both areas are back in the registry", async () => {
    const { element } = await view({
      edges: [
        edge("hall", "kitchen", { orphaned_at: ORPHANED }),
        edge("hall", "shed", { orphaned_at: ORPHANED }),
      ],
    });
    const buttons = shadowAll<HTMLButtonElement>(element, "button");
    expect(buttons).toHaveLength(2);
    // hall::kitchen — both present.
    expect(buttons[0].disabled).toBe(false);
    // hall::shed — the shed never came back, so re-adopting it would recreate a
    // dangling reference the orphan window exists to clean up.
    expect(buttons[1].disabled).toBe(true);
  });

  it("restores by edge id", async () => {
    const { element, calls } = await view({
      edges: [edge("hall", "kitchen", { orphaned_at: ORPHANED })],
    });
    shadow<HTMLButtonElement>(element, "button")!.click();

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("restoreEdge");
    expect(calls[0].args).toEqual(["hall::kitchen"]);
  });

  it("offers no restore for an orphaned area — purge is the repair flow's job", async () => {
    const { element } = await view({ areas: [area("shed", { orphaned_at: ORPHANED })] });
    expect(shadowAll(element, "button")).toHaveLength(0);
  });
});
