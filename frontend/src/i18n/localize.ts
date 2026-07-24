/**
 * Tiny `localize(key)` shim over the bundled `en` dict (Phase 7 §5, D11). A
 * missing key returns the key itself so a gap is visible, never a crash. Simple
 * `{placeholder}` substitution supports counts in flagged-area labels.
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
