/**
 * Tiny `localize(key)` shim over the bundled `en` dict (Phase 7 §5, D11). A
 * missing key returns the key itself so a gap is visible, never a crash. Simple
 * `{placeholder}` substitution supports counts in flagged-area labels.
 *
 * `enumLabel` is the single door every machine token goes through on its way to
 * the screen, so an unlabelled value shows up once, here, instead of leaking a
 * raw token into an option list.
 */

import { EN } from "./en";

const CATALOG: Record<string, Record<string, string>> = { en: EN };

export function localize(
  key: string,
  placeholders: Record<string, string | number> = {},
  locale = "en",
): string {
  const dict = CATALOG[locale] ?? EN;
  let value = dict[key] ?? EN[key] ?? key;
  for (const [name, replacement] of Object.entries(placeholders)) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}

/** The enum axes that carry human labels (`enum.<axis>.<value>` keys). */
export type EnumAxis =
  | "environment"
  | "trust"
  | "beyond"
  | "side"
  | "passage"
  | "barrier"
  | "preset"
  | "occupancy"
  | "type";

/**
 * Resolve one machine enum value to its human label. Falls back to the raw value
 * — `type` is an open catalog, so a user's own `sauna` has no key by design and
 * must still read as `sauna` rather than as a missing-key marker.
 */
export function enumLabel(axis: EnumAxis, value: string, locale = "en"): string {
  const key = `enum.${axis}.${value}`;
  const dict = CATALOG[locale] ?? EN;
  return dict[key] ?? EN[key] ?? value;
}
