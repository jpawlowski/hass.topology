# Changelog

## [0.2.0](https://github.com/jpawlowski/hass.topology/compare/v0.1.0...v0.2.0) (2026-08-03)


### ⚠ BREAKING CHANGES

* **migration:** existing config entries migrate from 1.1 to 1.2; entry.data is emptied once its five settings have been transferred into the topology store
* **config_flow:** the config flow no longer collects home settings; they are edited in the Topology panel and migrated automatically (config entry 1.1 -> 1.2)

### Features

* **api:** derive floor direction, weighted distance and geometry advisories ([1d1d5fe](https://github.com/jpawlowski/hass.topology/commit/1d1d5fe64c5bb9a28d61ed1cf417aa830682b624))
* **api:** open the read contract to YAML and sharpen the model ([482f8c2](https://github.com/jpawlowski/hass.topology/commit/482f8c2e6c10094373aaa166c463c512a00b94e7))
* **blueprints:** ship four reference automations ([236b0dd](https://github.com/jpawlowski/hass.topology/commit/236b0ddd74c1aa4d214c1e1b34c6357da5a22341))
* **config_flow:** slim the config flow to a confirm-only step ([3d35949](https://github.com/jpawlowski/hass.topology/commit/3d35949932de4e43dbba466da26699e3a09380fa))
* **docs:** add implementation plan for Phase 9 ([5e657b6](https://github.com/jpawlowski/hass.topology/commit/5e657b6602a3594aedea93dd1baa026b96d7a944))
* **frontend:** Lit 2D panel source (map, editors, ws consumer) ([e9d65dd](https://github.com/jpawlowski/hass.topology/commit/e9d65dd9dc51a2bf512693dd3f206abd08f999c2))
* **migration:** transfer entry.data into the store and empty it ([06f2924](https://github.com/jpawlowski/hass.topology/commit/06f2924142e3b39e5e960ccb7b66709fc286a8cc))
* **panel:** add panel constants and repair deep-link map ([84a1a3c](https://github.com/jpawlowski/hass.topology/commit/84a1a3c342af235ec6566e22cd1c7b3e27fad304))
* **panel:** add the first-run import card ([f6d3c78](https://github.com/jpawlowski/hass.topology/commit/f6d3c78d42ccb58a818b29f5558da8a712e32401))
* **panel:** make the panel able to finish the user's job ([8461791](https://github.com/jpawlowski/hass.topology/commit/8461791da2cf00a43a82dcd236366be91b0f358c))
* **panel:** register the admin sidebar panel + static path ([6862fd2](https://github.com/jpawlowski/hass.topology/commit/6862fd2dd7d07ad62a20e17e400304c3c7d1c7dc))
* Phase 7 — v1 custom panel, frontend build pipeline, repair deep-links ([6eb5a05](https://github.com/jpawlowski/hass.topology/commit/6eb5a05a9edf9d22e9db35e35ca9f108618cd32f))
* **repairs:** deep-link the reactive and orphan repair cards into the panel ([cde0467](https://github.com/jpawlowski/hass.topology/commit/cde0467c1c6e9f2ddf7ec44319f538171a7acafb))
* **topology:** add domain model and store converters (data.py) ([c67f80d](https://github.com/jpawlowski/hass.topology/commit/c67f80d057ccb8794af118204ddcd16e91371622))
* **topology:** add Phase 3 sensor entities, translations and icons ([f0931f0](https://github.com/jpawlowski/hass.topology/commit/f0931f0d474671208ed1f2f77595b72b8578cf77))
* **topology:** add Phase 5 repair-issue constants ([42f103a](https://github.com/jpawlowski/hass.topology/commit/42f103a1f76a60ac769daaa6df22329b0d925d5e))
* **topology:** add Phase 5 repair-issue translations ([c67fdbb](https://github.com/jpawlowski/hass.topology/commit/c67fdbbb5b608ae45d6e3455896e5aeefc30fe9a))
* **topology:** add Phase 6 service constants and import stamp ([463aa75](https://github.com/jpawlowski/hass.topology/commit/463aa7524bf37faf387e69b5ba24f6e5cdce6315))
* **topology:** add reactive repair reconciler and orphan purge fix flow ([e5f2a1d](https://github.com/jpawlowski/hass.topology/commit/e5f2a1d956e981f67a649c2593a28c7a25b6e692))
* **topology:** add registry-merged derived view and share derivations ([b9b1222](https://github.com/jpawlowski/hass.topology/commit/b9b122275b2312fccdebc3e0f1d4594301742f98))
* **topology:** add service schemas, validators, projection and import executors ([7e3e9e5](https://github.com/jpawlowski/hass.topology/commit/7e3e9e5ea9111edc7de155ff0a85b2fe0058367a))
* **topology:** add store constants and v1 JSON schema ([498df39](https://github.com/jpawlowski/hass.topology/commit/498df39dc6a09a004ec916540f5c30f55fdb766f))
* **topology:** add store, coordinator snapshot, and registry watcher ([22a128e](https://github.com/jpawlowski/hass.topology/commit/22a128e7e2a2cce46d563481ab3948d346f3fefd))
* **topology:** fill health graph lists + add graph query commands ([aff3b13](https://github.com/jpawlowski/hass.topology/commit/aff3b136b8bc31356387b78c1343eb6cd27f7f3b))
* **topology:** implement config flow (user + reconfigure) ([b272d76](https://github.com/jpawlowski/hass.topology/commit/b272d76ba0464a9338cc9b3ddbef860c99e23d55))
* **topology:** implement diagnostics export, services.yaml and translations ([6ceb311](https://github.com/jpawlowski/hass.topology/commit/6ceb311a888218e7c12cd5605c822b2b4ae0adfa))
* **topology:** implement the perimeter-open binary sensor ([255b7d4](https://github.com/jpawlowski/hass.topology/commit/255b7d4533f5185cc274cf3c33c962da096a1d72))
* **topology:** implement WebSocket API contract v1 ([6fc9b2b](https://github.com/jpawlowski/hass.topology/commit/6fc9b2b2748b56f8eb46abca5beab3863a322531))
* **topology:** Phase 4 aggregates + graph derivations ([6be2e66](https://github.com/jpawlowski/hass.topology/commit/6be2e660030dc3b2fd0056b28c2826216dec688b))
* **topology:** register the seven admin-gated service handlers ([5130f78](https://github.com/jpawlowski/hass.topology/commit/5130f781d99178d67334f18cc18ba4185a7d4a64))
* **topology:** wire projection reconcile and setup-time one-shot imports ([6c88b95](https://github.com/jpawlowski/hass.topology/commit/6c88b9540f2822bd4050526074829efbfe202606))


### Bug Fixes

* **ci:** align HA release train (bump PHCC to 2026.7.0) ([f5ef653](https://github.com/jpawlowski/hass.topology/commit/f5ef653154140d49a3235d29a79d7ed97c50c01e))
* **config-flow:** parenthesize multi-exception except clause ([7f65eff](https://github.com/jpawlowski/hass.topology/commit/7f65effccd486248a62a5221129793836b3d82d7))
* **config-flow:** use single-type except to survive ruff format ([7c14375](https://github.com/jpawlowski/hass.topology/commit/7c1437552189cb5c5859eab11c0d0093ec4ff5c6))
* **migration:** defer instead of clearing when the store flush does not persist ([383ff0a](https://github.com/jpawlowski/hass.topology/commit/383ff0a182131fe2d4d0172e55afdc5d238bb9ad))
* **test:** patch _async_write_data, not _async_handle_write_data ([dac9fc1](https://github.com/jpawlowski/hass.topology/commit/dac9fc116c2e5ccb4a29c69353a26f5a57561ce2))
* **test:** relocate the diagnostics snapshot to syrupy's default dir ([d88bd79](https://github.com/jpawlowski/hass.topology/commit/d88bd7974746a51c93e5daad31f651b58385491b))
* **topology:** address Codex review — home-config persistence, edge bundle, orphan restore ([d0799e2](https://github.com/jpawlowski/hass.topology/commit/d0799e205e819428f323d81e378958d95b753051))
* **topology:** address Copilot review on Phase 5 repairs ([8926446](https://github.com/jpawlowski/hass.topology/commit/892644630a3261883092078b021437a6e5411775))
* **topology:** attribute outdoor-facing edges to the room (PR review) ([90c4ef6](https://github.com/jpawlowski/hass.topology/commit/90c4ef6c4d9b48f9cb23ba7459c9f4fb1a95b22c))
* **topology:** re-create orphaned-area sensors on setup (PR review) ([35bb538](https://github.com/jpawlowski/hass.topology/commit/35bb5380e2cb5277be4067569000353fc63fcee6))
* **topology:** reject unknown import source in async_mark_import_done ([91ecdea](https://github.com/jpawlowski/hass.topology/commit/91ecdeaf467b64476f3144cee1b3ccc4e54888ee))
