# Architectural and Design Decisions

This document records significant architectural and design decisions made during the development of this integration.

## Format

Each decision is documented with:

- **Date:** When the decision was made
- **Context:** Why this decision was necessary
- **Decision:** What was decided
- **Rationale:** Why this approach was chosen
- **Consequences:** Expected impacts and trade-offs

---

## Decision Log

### Use DataUpdateCoordinator for All Data Fetching

**Date:** 2025-11-29 (Template initialization)

**Context:** The integration needs to fetch data from an external API and share it with multiple entities. Home Assistant provides several patterns for this.

**Decision:** Use `DataUpdateCoordinator` from `homeassistant.helpers.update_coordinator` as the central data management component.

**Rationale:**

- Provides built-in support for update intervals and error handling
- Automatic retry with exponential backoff
- Shared data access prevents duplicate API calls
- Standard pattern recommended by Home Assistant
- Entities automatically become unavailable when coordinator fails

**Consequences:**

- All entities must inherit from `CoordinatorEntity`
- Single update interval applies to all entities
- Data is fetched even if no entities are enabled
- Coordinator manages entity lifecycle and availability

---

### Separate API Client from Coordinator

**Date:** 2025-11-29 (Template initialization)

**Context:** The coordinator needs to fetch data, but business logic should be separated from data transport.

**Decision:** Implement API communication in separate `api/client.py` module, coordinator only orchestrates updates.

**Rationale:**

- Separation of concerns: transport vs. orchestration
- Easier to test API client in isolation
- Simpler to swap API implementation if needed
- Clearer error handling boundaries

**Consequences:**

- Additional abstraction layer
- Coordinator depends on API client
- API client raises custom exceptions for error translation

---

### Platform-Specific Directories

**Date:** 2025-11-29 (Template initialization)

**Context:** Integration supports multiple platforms (sensor, binary_sensor, switch, etc.).

**Decision:** Each platform gets its own directory with individual entity files.

**Rationale:**

- Clear organization as integration grows
- Easier to find specific entity implementations
- Supports multiple entities per platform cleanly
- Follows Home Assistant Core pattern

**Consequences:**

- More files/directories than single-file approach
- Platform `__init__.py` must import and register entities
- Slightly more initial setup overhead

---

### EntityDescription for Static Metadata

**Date:** 2025-11-29 (Template initialization)

**Context:** Entities have static metadata (name, icon, device class) that doesn't change.

**Decision:** Use `EntityDescription` dataclasses to define static entity metadata.

**Rationale:**

- Declarative and easy to read
- Type-safe with dataclasses
- Recommended Home Assistant pattern
- Separates static configuration from dynamic behavior

**Consequences:**

- Each entity type needs an EntityDescription
- Dynamic entities need custom handling
- Static and dynamic properties clearly separated

---

### Manifest Declaration: `helper` + `calculated` + `single_config_entry`

**Date:** 2026-07-23

**Context:** The blueprint template shipped a manifest declaring
`integration_type: hub` and `iot_class: cloud_polling`. Both are wrong for
topology, which is a metadata overlay on the HA `area_registry` / `floor_registry`
with no external device, no cloud, and no communication channel of its own.
An incorrect `integration_type` blocks hassfest on Platinum review and misleads
users about what the integration does.

**Decision:**

- `integration_type: helper` — the Core definition ("provides functionality
  that augments existing HA entities") fits precisely; precedents are `group`,
  `derivative`, `threshold`, `min_max`.
- `iot_class: calculated` — the Core definition ("integration does not handle
  communication on its own") matches; all data is user-entered or derived
  from HA registries.
- `single_config_entry: true` — the HA area/floor registry is a singleton,
  so multiple topology config entries would be meaningless. Enforce via the
  manifest flag instead of a manual `_async_current_entries()` check.
- `quality_scale: platinum` — declared as a self-documenting goal. The
  official Platinum badge is only awarded to Core integrations (see ADR
  "Quality Target: Platinum-Conformant"). Custom integrations do not show
  the scale in the HA UI.

**Rationale:** Correctness with respect to Core conventions, precedent-backed,
and precondition for any subsequent Platinum work. Getting this right at
Phase 1 avoids a manifest rewrite plus config-flow refactor later.

**Consequences:**

- Config flow becomes a singleton-setup flow (occupancy extent, opt-in
  imports); it is not the primary editing surface for adjacency data — the
  admin panel is (see ADR "Editing Surface: Config Flow vs. Panel").
- Discovery/reauth/reload-per-entry Quality-Scale rules become legitimately
  N/A and must be documented as such in the rule-mapping table
  (see PLAN-topology.md §8).

---

### Coordinator Role: Event Fanout, Not Polling

**Date:** 2026-07-23

**Context:** The blueprint's `coordinator/` package contains a
`DataUpdateCoordinator` with retry logic, exponential backoff, circuit
breakers, and a 5-minute polling interval. topology has **no external data
source**: the entire dataset is user-entered metadata plus HA registry
events. Keeping the polling coordinator as-is would produce dead code that
confuses future maintainers ("why is there retry logic for what?").

**Decision:** Retain the file name `coordinator.py` (Bronze `common-modules`
rule expects it), but the class is a thin **event-fanout coordinator**:

- Owns the loaded `Store` snapshot as `runtime_data`.
- Subscribes to `area_registry_updated` and `floor_registry_updated` events
  (via `homeassistant.helpers.area_registry.async_get_registry` +
  `hass.bus.async_listen`).
- Notifies dependent entities and the read hook via
  `async_update_listeners()` (the standard `CoordinatorEntity` contract).
- **No** `_async_update_data`, no polling interval, no retry logic.
  `PARALLEL_UPDATES = 0` on every platform.

The package `error_handling.py`, `data_processing.py`, and the API client
(`api/`) from the blueprint are **deleted** in Phase 1, not adapted.

**Rationale:** Preserves the Quality-Scale-visible file naming, keeps entity
wiring standard (`CoordinatorEntity`), and removes semantic garbage. The
event-driven pattern is well-established in Core (`group`, `label`).

**Consequences:**

- Custom coordinator base class or a small subclass of
  `DataUpdateCoordinator` with `update_interval=None`.
- Tests focus on registry-event handling, not on API mocking.
- `appropriate-polling` Quality-Scale rule is legitimately N/A.

---

### Entity Model: One Household Sensor + Perimeter Binary + Optional Per-Area Diagnostics

**Date:** 2026-07-23

**Context:** The plan initially left open which entities topology exposes.
Without entities, most Silver/Gold Quality-Scale rules become N/A (which
technically still allows Platinum) and topology is invisible in the
automation UI without going through the read hook. With too many entities
(one per area × dimension), registry churn becomes a problem.

**Decision:** Ship a minimal, meaningful entity set:

1. **`sensor.topology_house`** — one household summary sensor.
   State = `annotated_count / area_count` as a percentage. Attributes:
   `occupancy_extent`, `area_count`, `annotated_count`, `unannotated_areas`,
   `perimeter_connection_count`, `outdoor_area_count`.
2. **`binary_sensor.topology_perimeter_open`** — aggregate, `on` when any
   perimeter connection with a bound `binary_sensor` is `on`. Attributes
   list the open connections. Direct target for alarm/security automations.
3. **`sensor.topology_<area_slug>_type` / `_environment` / `_trust`** — per
   area, `entity_category: diagnostic`, **disabled by default**. Users
   opt-in per area when they want dashboard/automation visibility beyond
   the read hook. Uses `entity-translations` + `icon-translations`.

**Rationale:** Delivers automation-UI visibility with a bounded default
entity count (2 always-on entities regardless of area count), unlocks
`entity-*` Quality-Scale rules, and keeps registry churn proportional to
user opt-in — not to the number of areas.

**Consequences:**

- `platforms = ["sensor", "binary_sensor"]` from Phase 2 onward.
- `has-entity-name`, `entity-unique-id`, `entity-category`,
  `entity-device-class`, `entity-translations`, `icon-translations`,
  `entity-disabled-by-default` all become applicable and must be
  implemented.
- Adjacency graph, connection list, and `beyond` classifications remain
  accessible only via the read hook + panel — deliberately not per-connection
  entities.

---

### Editing Surface: Config Flow for Setup, Panel for Data

**Date:** 2026-07-23

**Context:** HA convention requires a config flow (Bronze). Modeling ~20
areas × ~3 neighbors × connection-lists via `ObjectSelector` subentry forms
is functional but painful past ~15 areas. The plan already envisions an
admin panel, but split of responsibilities was implicit.

**Decision:**

- **Config flow (singleton)** covers only setup-level choices:
  `occupancy_extent`, one-time opt-in imports (Core aliases / user labels),
  label-projection toggle, and future integration-wide settings.
- **Admin panel** is the primary editing surface for area annotations
  (type / environment / trust), the adjacency graph, and all connections
  (via named presets). WebSocket API with `connection.user` for server-side
  authorization; writes gated behind `@require_admin`.
- **Reconfigure flow** on the config entry mirrors the initial setup step
  only; it does not re-enter the graph editor.

**Rationale:** Matches Core conventions (config flow exists, is meaningful,
covers `test-before-configure` / `test-before-setup`) while acknowledging
that a graph editor belongs in a real UI, not in a `SelectSelector` cascade.

**Consequences:**

- Panel becomes a v1 hard requirement, not a v2 nice-to-have — the plan
  must reflect this in phase scoping.
- `reconfiguration-flow` rule is satisfied even though the flow is thin.
- Repair-issue fix-flows may deep-link into panel routes.

---

### Registry-Driven State With Reactive Cleanup

**Date:** 2026-07-23

**Context:** Areas and floors can be renamed, added, or deleted at any time
from HA Core's UI. topology keys on `area_id` / `floor_id` (stable), but
must react to deletions (orphaned edges) and additions (new unannotated
areas) — otherwise the store rots and derivations become wrong (e.g., a
deleted perimeter door still counted).

**Decision:**

- Subscribe to `area_registry_updated` and `floor_registry_updated` events
  in the coordinator.
- On area **delete**: mark all edges referencing the area as _orphaned_ in
  the store (do not immediately purge) and start an **undo window** of
  72 h. A repair issue offers "restore" or "purge now". After the window
  the entries are purged automatically.
- On area **add**: no store change; the household sensor's
  `unannotated_areas` attribute updates naturally, and a repair issue
  triggers once the count crosses a threshold (default 3, configurable).
- On area **update** (rename, floor reassignment, icon change): re-emit
  events, no store change (references stay on `area_id`).

**Rationale:** Prevents silent data corruption on user actions in Core UI;
undo window respects that deletes are often accidental; repair-issue
integration is a natural surface for the health signal.

**Consequences:**

- Store schema needs an `orphaned_at` timestamp per edge.
- Diagnostics export includes orphaned entries for support debuggability.
- A scheduled cleanup job runs on startup and on a daily interval.

---

### Quality Target: Platinum-Conformant, Core Merge as v2+ Path

**Date:** 2026-07-23

**Context:** The declared target is Platinum. The HA Quality Scale is
officially awarded and displayed only for Core integrations; for custom
integrations `quality_scale` in the manifest is self-documentation, and
the Platinum-required `documentation` URL
(`https://www.home-assistant.io/integrations/<domain>`) presupposes a
Core merge.

**Decision:**

- **v1.x (this repository, custom integration):** all Platinum-scale rules
  either fully implemented or legitimately marked N/A in the rule-mapping
  table (PLAN-topology.md §8). `quality_scale: platinum` is declared in
  the manifest as a self-documentation goal.
- **v2+ (aspirational):** propose topology as a Core helper integration
  once (a) the data model has been stable for at least two minor releases,
  (b) user base is nontrivial (measured via HACS install count),
  (c) architecture review with Core team has happened.
- The `documentation` URL stays on the custom GitHub repo until the Core
  merge lands; when it lands, both URLs coexist during a deprecation
  window.

**Rationale:** Setting the expectation up front prevents future confusion
about "why doesn't Platinum show in the UI". The two-stage path is realistic
and non-blocking.

**Consequences:**

- Every phase's DoD includes a Platinum-rule delta review; regressions are
  caught immediately.
- Test-coverage target ≥ 95 % from Phase 3 onward (Silver rule, precondition
  for Platinum).
- Architecture design is Core-review-ready: no HACS-specific tricks, no
  reliance on features only available to custom integrations.

---

## Future Considerations

### Multi-Instance Composition

**Status:** Deferred to v3

For mother/daughter HA installations, how two topology graphs merge is
undefined. Options: (a) each instance stays independent, (b) an explicit
"outer edge" connection points to a foreign instance (`instance_ref`
target). Aligned with Residents' coupling-level-0 stance for v1.

### Core Contribution of `type` to `area_registry`

**Status:** Watching

HA Core has intermittent discussions about adding `type: str | None` to
`AreaEntry`. If that lands, topology's `type` becomes a facade over the
Core field (Core value + topology override, both selectable). The read
hook must be shaped to allow this transition without breaking consumers.

### Assist Intent Integration

**Status:** Planned as F2 in PLAN-topology.md §9

Documented recipes only in v1; a dedicated `intent_script` extension pack
is a v2 candidate.

---

## Decision Review

These decisions should be reviewed periodically (suggested: quarterly or when major features are added) to ensure they still serve the integration's needs.
