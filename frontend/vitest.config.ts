import { defineConfig } from "vitest/config";

/**
 * vitest config for the panel (Phase 7 §6, D10).
 *
 * Two environments by filename, because most specs need no DOM and a jsdom
 * environment costs real time to set up:
 *
 * - `*.spec.ts` run in plain node and cover the framework-agnostic logic —
 *   WS-client encoding, preset expansion, router, styling, layout, neighbour
 *   rules, store reconnect/coalescing.
 * - `*.dom.spec.ts` run in jsdom and render the Lit components. These exist
 *   because the panel's worst bugs were invisible to logic tests: a `<select>`
 *   whose stored value never reached the DOM, a sidebar with no way back, an
 *   editor that could not create the thing it edited.
 */
export default defineConfig({
  test: {
    include: ["src/test/**/*.spec.ts"],
    environment: "node",
    environmentMatchGlobs: [["**/*.dom.spec.ts", "jsdom"]],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/test/**"],
    },
  },
});
