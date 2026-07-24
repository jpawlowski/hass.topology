import { defineConfig } from "vitest/config";

/**
 * vitest config for the panel logic modules (Phase 7 §6, D10). The specs cover
 * the framework-agnostic logic — WS-client encoding, preset expansion, router,
 * styling, store reconnect/coalescing — not the Lit DOM render (E2E deferred),
 * so a plain node environment suffices.
 */
export default defineConfig({
  test: {
    include: ["src/test/**/*.spec.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/test/**"],
    },
  },
});
