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

**Amendment 2026-07-25 — the flow is now confirm-only.** Phase 7 made the panel
reachable from the integration tile (`config_panel_domain=DOMAIN`) and shipped a
home-config editor, which left the flow's setup-level fields duplicating a panel
surface that could edit the same values live. Per
[`PLAN-topology-phase2-followup-configflow.md`](PLAN-topology-phase2-followup-configflow.md)
the split above is sharpened rather than reversed:

- **Config flow (singleton)** now covers **no** settings at all. It confirms,
  runs the three test-before-configure checks, and creates the entry with
  `data == {}`. This is what the original "config flow for setup" line meant once
  the panel existed: the flow is the setup act, not a settings surface.
- **`occupancy_extent`, the three projection toggles, and the unannotated-repair
  threshold** move entirely to the panel, edited through the frozen
  `topology/update_home_config` command. The store is the single source of truth
  for home config; `entry.data` is never read back as configuration.
- **The one-time import opt-ins** are no longer settings at all. They are a
  **panel first-run action** per source, driving the existing
  `topology.import_from_core` service while `imports_done_at.<source>` is `null`
  — a one-shot action never belonged in a setup dialog.
- **The reconfigure flow stays**, also confirm-only: it re-runs the checks and
  reloads the entry. It "mirrors the initial setup step only" as before — the
  initial setup step simply no longer has fields to mirror. The Gold
  `reconfiguration-flow` rule stays satisfied, and the ⋮ menu still exposes it
  (`config_panel_domain` only swaps the row's settings affordance).

**Consequence:** existing entries migrate 1.1 → 1.2, which transfers the five
settings into the store and then empties `entry.data`. Rolling back to a
pre-slim version keeps the store intact, but the old reconfigure form would show
defaults rather than the real values — an accepted pre-1.0.0 cost under ADR
"Release Strategy".

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

### Release Strategy: Internal Version Milestones, Single Initial Public Release

**Date:** 2026-07-23

**Context:** The plan documents structure the scope as v1 (phases 1–8),
v2+ (3D house view, starter templates, Assist intent pack), and v3
(multi-instance, solar/quiet refinements), originally implying a public
v1 release followed by later feature releases. The project owner decided
these version labels are **internal planning milestones only**: the
milestones are implemented consecutively, and git shows a version only
once the full scope is implemented end to end.

**Decision:**

- v1 / v2 / v3 remain the planning and sequencing vocabulary in
  `PLAN-topology.md`, but **no git tag, GitHub release, or HACS listing
  is created per milestone**. Implementation proceeds v1 → v2 → v3
  back to back on the default branch.
- The **single initial public release** (`1.0.0`) happens only when the
  full planned scope is implemented. Mechanics: the release-please PR
  stays unmerged during development; merging it is the release act.
  `manifest.json` stays on a `0.x` version until then.
- Phase 8 (docs, brands, HACS listing, blueprints) is **deferred to the
  end of the full scope**, not executed after the v1 milestone. The
  Phase-8 deliverables themselves are unchanged.
- **Exclusions (necessarily post-release):** the Core-merge path and
  anything gated on a nontrivial user base / HACS install count (ADR
  "Quality Target") cannot precede a public release by definition and
  stay post-1.0.0. "Full scope" therefore means: everything in
  `PLAN-topology.md` §5 v1 scope plus the v2+/v3 items that are
  implementable without a published release; externally gated items are
  out of the gate.
- Interface freezes (PLAN-topology.md §10, PLAN-topology-phase2.md)
  remain binding **internally** during development — Residents develops
  against them — but pre-release changes need no public deprecation
  window; a coordinated update of both repositories suffices.

**Rationale:** The owner wants users to see one complete, coherent
integration rather than an incremental early release; internal
milestones keep the sequencing and freeze-gate discipline without
publishing intermediate states.

**Consequences:**

- Longer time-to-first-feedback: no external users until 1.0.0 —
  accepted trade-off; Residents (sister project) serves as the in-house
  consumer providing integration feedback pre-release.
- Conventional commits continue as-is; release-please accumulates the
  changelog until the gate.
- The "stable for two minor releases" precondition for a Core merge
  starts counting only after 1.0.0.
- Per-phase implementation planning is unchanged (plans are still
  written per phase, right before the phase begins, per §10) — this ADR
  changes only the release gate, not the planning cadence.

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
