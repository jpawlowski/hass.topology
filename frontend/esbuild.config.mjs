/**
 * Production build for the topology panel (Phase 7 §4.3). esbuild bundles the
 * Lit web-component into ONE self-contained ESM file under
 * `custom_components/topology/panel/` — the only artifact HA serves — then
 * writes `build.json` ({module, hash}) for the cache-busting query string.
 *
 * CSP / no-CDN (hard rule §4.3): `bundle: true` + `external: []` inlines all JS
 * (Lit included); nothing is imported from a remote host. The panel makes zero
 * outbound requests beyond the same-origin HA WebSocket.
 */

import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const outDir = join(repoRoot, "custom_components", "topology", "panel");
const MODULE = "topology-panel.js";
const outFile = join(outDir, MODULE);

await build({
  entryPoints: [join(here, "src", "topology-panel.ts")],
  outfile: outFile,
  bundle: true,
  format: "esm",
  target: "es2021",
  platform: "browser",
  minify: true,
  sourcemap: true,
  // Hard CSP rule: nothing is left external — Lit is bundled in, no CDN import.
  external: [],
  legalComments: "none",
  logLevel: "info",
});

// Content-hash the built bundle (first 12 hex of sha256) for cache-busting.
const bundle = readFileSync(outFile);
const hash = createHash("sha256").update(bundle).digest("hex").slice(0, 12);
writeFileSync(
  join(outDir, "build.json"),
  `${JSON.stringify({ module: MODULE, hash }, null, 2)}\n`,
  "utf-8",
);

console.log(`topology panel built: ${MODULE}?${hash}`);
