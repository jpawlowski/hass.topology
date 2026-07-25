import { describe, it, expect } from "vitest";
import { deltaFrom, presetsForRelation, relationFor } from "../editors/neighbors-logic";
import type { PresetOut } from "../api/types";

const preset = (
  preset_name: string,
  passage: PresetOut["passage"],
  scope: PresetOut["scope"] = "interior",
): PresetOut => ({
  preset_name,
  passage,
  barrier: "door",
  glazed_default: false,
  sensor_allowed: true,
  scope,
});

const PRESETS: PresetOut[] = [
  preset("interior_door", "level"),
  preset("open_passage", "level"),
  preset("shared_wall", "none"),
  preset("enclosed_stair", "stairs"),
  preset("lift", "elevator"),
  preset("loft_ladder", "ladder"),
  preset("hatch", "hatch"),
  preset("window", "none", "exterior"),
  preset("outside_door", "level", "exterior"),
];

describe("relationFor classifies two areas by floor level", () => {
  it("reads equal levels as the same floor", () => {
    expect(relationFor(0, 0)).toBe("same");
    // A negative level is an ordinary basement, not a special case.
    expect(relationFor(-1, -1)).toBe("same");
  });

  it("reads a one-storey difference as directly above or below", () => {
    expect(relationFor(0, 1)).toBe("above");
    expect(relationFor(1, 0)).toBe("below");
    expect(relationFor(-1, 0)).toBe("above");
  });

  // Ground floor 0 (as in Germany) and ground floor 1 must behave identically,
  // because only the difference between two levels is ever used.
  it("is independent of the counting convention", () => {
    expect(relationFor(0, 1)).toBe(relationFor(1, 2));
    expect(relationFor(0, 0)).toBe(relationFor(1, 1));
  });

  it("reads a bigger gap as distant", () => {
    expect(relationFor(0, 2)).toBe("distant");
    expect(relationFor(2, -1)).toBe("distant");
  });

  it("never guesses when a level is missing", () => {
    expect(relationFor(null, 1)).toBe("unknown");
    expect(relationFor(1, null)).toBe("unknown");
    expect(relationFor(null, null)).toBe("unknown");
  });
});

describe("presetsForRelation offers only kinds that can cross the boundary", () => {
  it("excludes every exterior preset — an edge is between two of your areas", () => {
    for (const relation of ["same", "above", "below", "distant", "unknown"] as const) {
      const names = presetsForRelation(PRESETS, relation).map((row) => row.preset_name);
      expect(names).not.toContain("window");
      expect(names).not.toContain("outside_door");
    }
  });

  it("offers step-free kinds on the same floor and no vertical ones", () => {
    const names = presetsForRelation(PRESETS, "same").map((row) => row.preset_name);
    expect(names).toContain("interior_door");
    expect(names).toContain("open_passage");
    expect(names).not.toContain("enclosed_stair");
    expect(names).not.toContain("lift");
  });

  it("offers vertical kinds between storeys and no step-free ones", () => {
    for (const relation of ["above", "below"] as const) {
      const names = presetsForRelation(PRESETS, relation).map((row) => row.preset_name);
      expect(names).toContain("enclosed_stair");
      expect(names).toContain("lift");
      expect(names).toContain("loft_ladder");
      expect(names).toContain("hatch");
      expect(names).not.toContain("interior_door");
    }
  });

  // A party wall or a plain ceiling declares "these two touch" with no way
  // through, which is meaningful on either axis.
  it("always offers a no-passage kind", () => {
    for (const relation of ["same", "above", "below", "distant", "unknown"] as const) {
      expect(presetsForRelation(PRESETS, relation).map((row) => row.preset_name)).toContain(
        "shared_wall",
      );
    }
  });

  it("rules nothing interior out when the relation is unknown", () => {
    const names = presetsForRelation(PRESETS, "unknown").map((row) => row.preset_name);
    expect(names).toContain("interior_door");
    expect(names).toContain("lift");
  });
});

describe("deltaFrom restates an edge's level delta from one endpoint", () => {
  // The wire value is signed area_a -> area_b, and area_a is only the
  // lexicographically smaller id, so it must be flipped for the far side.
  it("keeps the sign for area_a and flips it for area_b", () => {
    const edge = { area_a: "attic", level_delta: -1 };
    expect(deltaFrom(edge, "attic")).toBe(-1);
    expect(deltaFrom(edge, "bedroom")).toBe(1);
  });

  it("passes an unknown delta through", () => {
    expect(deltaFrom({ area_a: "a", level_delta: null }, "a")).toBeNull();
    expect(deltaFrom({ area_a: "a", level_delta: null }, "b")).toBeNull();
  });

  it("leaves a same-floor edge at zero either way", () => {
    const edge = { area_a: "a", level_delta: 0 };
    expect(deltaFrom(edge, "a")).toBe(0);
    expect(deltaFrom(edge, "b")).toBe(-0);
  });
});
