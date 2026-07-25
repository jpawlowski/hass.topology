import { describe, it, expect } from "vitest";
import { expandPreset, presetAllowsSensor } from "../editors/preset";
import type { PresetOut } from "../api/types";

/** A subset of the server-shipped preset table (`_serialize_presets`). */
const PRESETS: PresetOut[] = [
  {
    preset_name: "interior_door",
    passage: "level",
    barrier: "door",
    glazed_default: false,
    sensor_allowed: true,
    scope: "interior",
  },
  {
    preset_name: "open_passage",
    passage: "level",
    barrier: "open",
    glazed_default: false,
    sensor_allowed: false,
    scope: "interior",
  },
  {
    preset_name: "window",
    passage: "none",
    barrier: "door",
    glazed_default: true,
    sensor_allowed: true,
    scope: "exterior",
  },
];

describe("preset expansion uses the server table (never a hardcoded map)", () => {
  it("expands a preset to the server-defined passage + barrier + glazed", () => {
    expect(expandPreset(PRESETS, "window")).toEqual({
      passage: "none",
      barrier: "door",
      glazed: true,
      preset_name: "window",
    });
  });

  it("expands a different preset from the same table", () => {
    expect(expandPreset(PRESETS, "open_passage")).toEqual({
      passage: "level",
      barrier: "open",
      glazed: false,
      preset_name: "open_passage",
    });
  });

  it("returns null for an unknown preset (caller keeps manual axes)", () => {
    expect(expandPreset(PRESETS, "does_not_exist")).toBeNull();
  });

  it("reads sensor_allowed from the table", () => {
    expect(presetAllowsSensor(PRESETS, "interior_door")).toBe(true);
    expect(presetAllowsSensor(PRESETS, "open_passage")).toBe(false);
    expect(presetAllowsSensor(PRESETS, "unknown")).toBe(false);
  });
});
