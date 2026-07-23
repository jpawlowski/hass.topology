# Architecture Overview

> [!IMPORTANT]
> **Planning stage.** This document will be rewritten in full at Phase 9 of
> the roadmap in [`PLAN.md`](./PLAN.md) §6. Until then, it only records the
> shape of the current skeleton so nothing in the repository misleads you.
>
> **The single source of truth for how Topology is designed and built is
> [`PLAN.md`](./PLAN.md).** Read it first.

## Current directory structure (Phase 1 skeleton)

```text
custom_components/topology/
├── __init__.py                        # Hub setup (no platforms yet)
├── config_flow.py                     # Re-exports the flow handler
├── config_flow_handler/               # Single-instance hub flow
│   ├── __init__.py
│   └── config_flow.py                 # No user input, aborts if already configured
├── const.py                           # DOMAIN, LOGGER, PARALLEL_UPDATES
├── data.py                            # TopologyConfigEntry alias + TopologyData
├── diagnostics.py                     # Bare entry / integration info
├── manifest.json                      # iot_class: calculated
├── repairs.py                         # Placeholder flow
├── services.yaml                      # Empty — no service actions yet
└── translations/
    └── en.json                        # single_instance_allowed abort
```

Everything from the original blueprint that was tied to the example
"air purifier" integration — the `api/` client, the DataUpdateCoordinator,
the `sensor` / `binary_sensor` / `switch` / `select` / `number` / `button` /
`fan` platforms, the `entity/`, `entity_utils/`, `utils/`, and
`service_actions/` packages, the credential-based config flow with its
schemas and validators — has been removed. Those pieces do not fit
Topology's shape (no external API, no polling, no per-instance
configuration) and will be reintroduced in the form the roadmap needs them.

## What lands where, by phase

The mapping from roadmap phases to the packages / modules they will
introduce is tracked in [`PLAN.md`](./PLAN.md) §6. In summary:

| Phase | Adds                                                                                     |
| ----- | ---------------------------------------------------------------------------------------- |
| 2     | `store/` (annotations, graph, home), `coordinator/` (registry watcher + graph index)     |
| 3     | Connection presets + `beyond` model (both inside `store/` / `coordinator/`)              |
| 4     | Derived facts (perimeter, adjacency summaries) + per-area `entity/` and `binary_sensor/` |
| 5     | `websocket/` (read hook) + attribute mirror on the entities from Phase 4                 |
| 6     | Label projection (integrates with HA's label registry) + repair issues in `repairs.py`   |
| 7     | `panel/` (sidebar panel with bundled static assets)                                      |
| 8     | Service actions (`service_actions/`) and richer `diagnostics.py`                         |
| 9     | This document, rewritten as the real Architecture Overview                               |
