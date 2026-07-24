/**
 * Preset → two-axis expansion (Phase 7 §2.6). The client hardcodes NO preset
 * table: it expands a preset by looking it up in the `presets` array that
 * `list_annotations` ships (Phase-2 §3.9/§4.1), so preset → `passage`+`barrier`
 * can never drift from the backend. Pure and testable.
 */

import type { ConnectionOut, PresetOut } from "../api/types";

/**
 * Expand a preset name into a connection using the server-shipped table. Returns
 * `null` for an unknown preset (the caller keeps the manual passage/barrier).
 * `glazed` is seeded from the preset's `glazed_default`; `preset_name` is stamped
 * so the round-trip records which preset produced the connection.
 */
export function expandPreset(presets: PresetOut[], presetName: string): ConnectionOut | null {
  const preset = presets.find((row) => row.preset_name === presetName);
  if (preset === undefined) {
    return null;
  }
  return {
    passage: preset.passage,
    barrier: preset.barrier,
    glazed: preset.glazed_default,
    preset_name: preset.preset_name,
  };
}

/** True when a preset permits attaching an open/close sensor (barrier door). */
export function presetAllowsSensor(presets: PresetOut[], presetName: string): boolean {
  const preset = presets.find((row) => row.preset_name === presetName);
  return preset?.sensor_allowed ?? false;
}
