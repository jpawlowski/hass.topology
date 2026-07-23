# Topology — Interface Plan

**Status:** Interface contract · Last updated 2026-07-23

**Quality target:** Platinum-conformant from v1; official Platinum badge
is only awarded to Core integrations and is targeted as a v2+ path via
a Core merge (see `DECISIONS.md` — "Quality Target: Platinum-Conformant,
Core Merge as v2+ Path", and §8 below for the full rule mapping).

**topology will be implemented in a separate repository.** This document
exists here only to pin the interface contract, so both integrations stay
aligned while Residents is built first. The coupling direction is the
opposite of courier: **Residents consumes topology**, optionally and with
graceful degradation, the same way it consumes Proximity.

## 1. Vision (one page)

Home Assistant knows _which_ areas and floors exist, but nothing _about_
them: an area has no type, no indoor/outdoor flag, and no notion of which
areas border each other. topology is a thin metadata layer over the HA
area/floor registry that makes the house **machine-readable** — a
floorplan for automations, not for humans.

topology **consumes, never rebuilds** the area/floor registry: it never
defines areas, only annotates them. Three concepts (fixed at planning
level):

- **Area type** — an open catalog with defaults (`bedroom`, `living`,
  `kitchen`, `dining`, `bathroom`, `hallway`, `office`, `utility`,
  `storage`, `garage`, `balcony`, `terrace`, `outdoor`; the latter two
  added with the Phase-2 plan, decision D9 in
  `PLAN-topology-phase2.md` §9). Type is a _descriptive hint_, never
  authoritative: it may seed defaults (e.g., suggest a `sleeping_place`
  when type = `bedroom`) but Residents' sleeping-area derivation stays the
  source of truth. Within topology, picking a type also **cascades
  editable defaults** onto the other two area fields — `bedroom` ⇒ indoor
  - `private`, `hallway` ⇒ indoor + `shared`, `outdoor` ⇒ outdoor — so an
    area is one choice plus corrections, not three separate decisions. These
    are only starting points; `trust` in particular stays individual (a
    front garden is `outdoor` but `public`).

- **Environment** — `indoor` · `outdoor` · `semi_outdoor` (covered
  balcony, porch). A balcony, terrace, or garden is a real area but a
  fundamentally different kind of space than an interior room. When
  topology is installed but an area has been left unannotated, the read
  hook returns `null` rather than a silent `indoor` default — the
  conservative `indoor` fallback (§4) applies only when **topology itself
  is absent**. Silently assuming `indoor` inside topology would let an
  unannotated garden slip into perimeter-trust-delta reasoning as an
  interior room and invert the perimeter set. Consumers treating `null`
  as "unknown" is the correct discipline; the consistency signal (§3.6)
  surfaces how many areas are still `null`.

- **Trust / exposure class** — a per-area, user-set rating of how exposed
  a space is, **orthogonal to environment**: `private` (exclusively
  yours — rooms, a fenced back garden) · `shared` (limited / communal
  access — an apartment building's hallway, a shared garden) · `public`
  (exposed to strangers — the street, an open front yard). The scale is
  **ordered** (`private` < `shared` < `public`), which makes the perimeter
  derivation (under Openings) machine-evaluable. It is deliberately
  individual: the same terrace door faces a private back garden in one
  home and a public street in another. Trust is independent of
  environment — back garden = outdoor + `private`, hallway = indoor +
  `shared`, front yard = outdoor + `public`, bedroom = indoor + `private`.

- **Adjacency graph** — undirected area↔area edges. The horizontal /
  vertical **axis** is _derived_ from the two areas' floors (same `level`
  = horizontal, differing = vertical) and never stored. An edge is backed
  by **one or more connections** (next concept) — two floor landings
  routinely hold both a stair and a lift at once, so a single edge is a
  _bundle_, not one link. "Connected vs. only next to each other" is
  whether any connection is traversable; graph "distance" is the hop count
  plus the floor-level difference. Observer-relative directions
  (left/right/front/back) are deliberately **not** modeled — they are
  ambiguous without a fixed viewpoint — and there are no metric (x/y/z)
  coordinates.

- **Connections (doors, windows, stairs, lifts …)** — one physical way
  the two sides of an edge meet; an edge carries a **list** of them, so a
  stairwell with both a stair and a lift is two connections, not a
  compromise into one. Each connection has:
  - **`passage`** — how a person crosses: `none` (adjacent, not
    traversable) · `level` (walk, same floor) · `stairs` · `ramp` (vehicle
    or wheelchair) · `elevator` · `ladder` · `hatch`. Distinguishing
    `stairs` / `ramp` / `elevator` also enables step-free routing later.
  - **`barrier`** — permeability to sound / air / light: `open` (no
    barrier — open doorway, or an open stairwell / atrium _void_) · `door`
    (closable, state-dependent; the leaf mechanism — hinged, sliding,
    pocket, folding — is _not_ distinguished, it changes nothing the model
    reasons about) · `solid` (a wall, or a floor / ceiling slab).
  - optional **side** — the cardinal bearing (`N` · `E` · `S` · `W`, rough
    side only, never geometry); the two areas carry opposite bearings
    (N↔S / E↔W).
  - optional **sensor** — a Home Assistant door/window `binary_sensor` for
    live open/closed state (only meaningful for `barrier: door`).
  - optional **`glazed`** — the connection transmits daylight (a window,
    interior or exterior). Orthogonal to `passage` and `barrier`: a
    French window / balcony door is `{level, door, glazed}`, a plain
    interior door is `{level, door}`, a fixed interior window between two
    rooms is `{none, door, glazed}` (no passage, closable frame,
    daylight-permeable), a wall-mounted skylight is `{none, open, glazed}`
    when it can be opened, `{none, door, glazed}` when only openable via
    a mechanism. v1 keeps `barrier` coarse for sound/air reasoning;
    separating light as its own permeability (borrowed-light reasoning)
    is a later refinement, but `glazed` is already the seed for v3
    solar-gain / plant-light / passive-heating logic.

  So an open stairwell + lift between two landings is `{stairs, open}` and
  `{elevator, door, sensor}`; a plain shared wall is a single
  `{none, solid}`. A connection is **interior** when it leads to another
  area (it backs that edge) or **exterior** when it faces outside (a window
  or outside door, no second area — attached to the one area). A window
  can be either: an **exterior** window on an `outdoor` wall (see next
  concept), or an **interior** `glazed` connection between two of your
  areas that passes daylight to an inner room. Propagation
  for v3 quiet grading takes the **most permeable connection** on an edge:
  an open stair dominates an enclosed lift beside it.

  In the UI a connection is picked from a named **preset** — interior
  door, open passage, shared wall, open stair, enclosed stair, lift,
  loft ladder, ramp, window, outside door — that expands to a `passage` +
  `barrier` pair. The **stored model stays the two-axis form**, so presets
  are convenience only, not a new object type; rare real combinations
  (a glass observation lift = `elevator` + `open`) remain settable by hand
  without a preset for every permutation.

  What lies **beyond** a traversable interior connection is the trust
  class of its target area; a bare exterior connection with no modeled
  target defaults to `public` (nothing behind it ⇒ treat as exposed), or
  may carry an inline class so a building hallway can be `shared` without
  being modeled as its own area. A **perimeter connection** — the secure
  envelope of the home — is _derived_ from the trust delta: any connection
  whose two sides differ in trust class (private↔shared, private↔public)
  is one, so the set of doors to watch when away or asleep falls out
  automatically. An optional per-connection **`perimeter` flag** covers
  the rare same-class boundary the delta cannot see — a door between a
  main flat and a granny flat, both `private` — forcing it to count as a
  perimeter.

- **Outer walls (`beyond`) & occupancy extent** — a wall side of an area
  that does _not_ border one of your own areas gets a **`beyond`** class:
  `outdoor` (open air — the only side an exterior window or balcony door
  may sit on), `neighbor` (a party wall to a foreign occupied unit you do
  not model — "there is a wall here, not empty air, and not the outside"),
  or `earth` (a buried wall, e.g. a cellar against soil — no window
  possible). "Exterior vs. interior wall" is therefore _derived_, never a
  second flag: interior = the side borders your own area (an edge);
  exterior / party / buried = the `beyond` class. This is what lets the UI
  **constrain window placement** — an exterior opening is offered only on
  an `outdoor` side. A home-level **occupancy extent** — `whole_property`
  vs. `unit_within_building` — records whether all areas together are a
  standalone home or a unit inside a larger structure; largely derivable
  (any `neighbor` wall ⇒ a unit) but kept explicit for the map (envelope
  vs. unit) and as the default for unmodeled outer walls (`whole_property`
  ⇒ `outdoor`, a unit ⇒ `neighbor` / unknown).

- **Floors & vertical stacking** — topology consumes the HA floor
  registry, whose `level: int | None` is the **authoritative vertical
  ordering** (HA itself sorts floors by `level`, higher = higher up;
  verified in `helpers/floor_registry.py`). Where `level` is unset,
  topology lets the user supply it (consume, then complement). Floor
  `level` orders the _floors_; which specific area sits above which
  specific area is a separate fact, carried by explicit **vertical
  connections** (`stairs` / `ramp` / `elevator` / `ladder` / `hatch`, or a
  `{none, solid}` connection for a plain stacked ceiling) between the two
  areas. A multi-storey garage is just negative-`level` floors joined this
  way; a stair or lift serving many floors is modeled as per-floor
  landings (or a small `shared` shaft area) with pairwise connections — no
  hyper-edge primitive is needed. "Above/below" is therefore always unambiguous; "north/west of" is
  available wherever a bearing was set.

**Modeling is individual.** Outdoor space can be one area (one trust
class) or split — front yard `public`, back garden `private`, or further
by bearing (N/E/S/W) — whatever the site needs; merging front and back
into one garden area means one shared trust class, so split when they
differ. A building's shared hallway may be modeled as a `shared` area (so
a further hallway→street door shows `shared` vs. `public`) or left
implicit on the apartment door via the connection's inline class. topology
forces neither; it only makes the chosen granularity machine-readable.

topology is useful **standalone** — annotating areas is valuable without
Residents — so it must never hard-depend on Residents.

## 1a. Entities and services topology exposes

Full rationale in `DECISIONS.md` — "Entity Model". Summary:

- **`sensor.topology_house`** — one household summary sensor.
  State = `annotated_count / area_count` as a percentage (0–100).
  Attributes: `occupancy_extent`, `area_count`, `annotated_count`,
  `unannotated_areas` (list of area_ids), `perimeter_connection_count`,
  `outdoor_area_count`, `floor_count`. Always enabled. `entity_category`
  unset (it is a user-facing summary, not a diagnostic).
- **`binary_sensor.topology_perimeter_open`** — aggregate, `on` when any
  perimeter connection with a bound `binary_sensor` is `on`. Attributes:
  `open_connections` (list of `{edge_id, area_a, area_b, source_entity}`).
  `device_class: opening`. Always enabled — this is the primary security
  hook.
- **`sensor.topology_<area_slug>_type`**, **`_environment`**, **`_trust`**
  — one triple per area, `entity_category: diagnostic`, **disabled by
  default**. Users opt in per area for dashboard/automation targeting
  beyond the read hook. Options come from the corresponding enum;
  `icon-translations` and `entity-translations` are pulled from
  `strings.json` / `icons.json`.

The adjacency graph, individual connections, and outer-wall `beyond`
classifications remain accessible only via the read hook (§2, WebSocket
API) and the panel — deliberately not one entity per connection, to keep
registry churn bounded.

**Services** (Phase 6 in §5):

- `topology.annotate_area(area_id, type?, environment?, trust?)` — bulk
  setter, used by imports and the panel.
- `topology.declare_connection(area_a, area_b, preset, sensor?, side?,
glazed?)` — panel-driven; preset expands to `passage` + `barrier`.
- `topology.set_beyond(area_id, side, beyond)` — annotate an outer wall.
- `topology.project_labels(scope: all|environment|type|trust)` — one-way
  label projection (§6).
- `topology.import_from_core(source: aliases|labels)` — one-shot import;
  never runs automatically.

Every service action is registered in `async_setup()` (not
`async_setup_entry()`), raises `ServiceValidationError` on unknown
`area_id` / `edge_id`, and is documented with selectors in
`services.yaml`.

## 2. Interface contract: what Residents reads from topology

| Value                          | Used for                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `environment` per area         | exclude `outdoor` areas from `needs_quiet` and from indoor-only occupancy reasoning                                        |
| area `type`                    | seed defaults only — suggest `sleeping_place` for `bedroom`, `dining_place` for `dining`, etc.                             |
| adjacency graph                | v3 quiet grading: areas adjacent to a `needs_quiet` area get partial quiet (propagation over edges)                        |
| edge connections               | propagation: most-permeable `barrier` — `open` (open stairwell) spreads, `door` state-dependent, `solid` blocks            |
| door/window sensors            | live open/closed refines v3 quiet propagation and feeds perimeter-open checks                                              |
| floor `level` + vertical edges | reason about areas above/below (e.g. footstep noise over a bedroom); floor-difference distance                             |
| compass bearing per connection | orientation-aware logic (e.g. west-facing windows for afternoon sun / heat)                                                |
| consistency / health signal    | raise a degradation repair issue when data a used capability needs is incomplete — never re-deriving topology's own checks |

Nothing here is required by Residents v1. Each consumer is a refinement
that **degrades cleanly** when topology is absent (see §4).

## 3. Obligations this imposes on topology

The mirror of PLAN.md §9 — because Residents is the consumer here, these
obligations bind topology:

1. **Key on the HA `area_id` and `floor_id`** — no new identifier space.
   Both integrations reference areas and floors by the same registry keys
   (topology consumes the floor registry's `level` rather than inventing a
   floor ordering), so there is nothing to reconcile.
2. **Machine-readable values** — enumerated type/environment/connection
   values and a typed adjacency structure; no display-only strings on the
   contract surface.
3. **Documented enumerations** — the type catalog, environment values,
   and edge kinds listed in user docs so Residents can validate against
   them and degrade on unknown values.
4. **No Residents special-casing** — if Residents needs something new, it
   is added as a general topology feature or not at all.
5. **Detection + read hook** — a documented, cheap way for Residents to
   detect topology and read per-area metadata + the adjacency graph
   (entity/attribute convention or a small WS/helper API; decided
   together with topology's own storage design).
6. **Consistency / health signal** — expose a cheap, machine-readable
   summary of data completeness (ok / warnings + which areas are affected)
   through the read hook, so a consumer can detect incomplete topology
   data and degrade **without re-implementing topology's own checks**. The
   checks themselves (§7) belong to topology and raise topology's own
   repair issues.
7. **Reactive registry integration** — subscribe to
   `area_registry_updated` and `floor_registry_updated` events; area
   deletion marks referencing edges as _orphaned_ with a 72 h undo
   window; area addition raises no immediate write but updates the
   household sensor's `unannotated_areas` attribute and, past a threshold,
   raises a repair issue. Rationale and mechanics in `DECISIONS.md` —
   "Registry-Driven State With Reactive Cleanup".

## 4. Degradation without topology

Residents must run fully without topology installed. Each consumer has a
conservative fallback plus a **repair issue** pointing the user to
topology when a dependent capability would benefit:

| Without topology       | Replacement                                                         |
| ---------------------- | ------------------------------------------------------------------- |
| `environment` per area | assume `indoor` (conservative: no area silently drops out of quiet) |
| area `type`            | no default suggestions; relationships set manually                  |
| adjacency graph        | no quiet grading; only per-area `needs_quiet`, no propagation       |

## 5. Sequencing

- **Residents first, independently.** topology is not on the critical
  path — no Residents v1 capability hard-depends on it, and the
  consumption code is guarded and added in a later minor.
- topology can be built at **any** time, before or after Residents; it is
  useful on its own.
- The Residents-side consumption wires in after topology exists and after
  Residents' own entity/attribute contract is frozen (PLAN.md §9), so the
  read hook can be versioned against a stable model on both ends.
- topology v1 scope (planned in its own repository):
  - Manifest as documented in `DECISIONS.md` ("Manifest Declaration"):
    `helper` + `calculated` + `single_config_entry: true` +
    `quality_scale: platinum` (self-declared).
  - Blueprint-boilerplate purge (Phase 1 in §5-analog): delete `api/`,
    the polling `error_handling.py` / `data_processing.py`, and every
    example platform (`fan/`, `switch/`, `number/`, `button/`).
  - Event-fanout coordinator (see `DECISIONS.md` — "Coordinator Role")
    replacing the polling coordinator; `PARALLEL_UPDATES = 0`.
  - Entity model per §1a: `sensor.topology_house`,
    `binary_sensor.topology_perimeter_open`, and disabled-by-default
    per-area diagnostics for `type`/`environment`/`trust`.
  - Area type catalog, environment flag, per-area trust/exposure class
    (`private`/`shared`/`public`) with derived perimeter connections
    (+ optional manual `perimeter` flag for same-trust unit boundaries).
  - Adjacency graph whose edges carry a **list of connections** — each
    with `passage` + `barrier`, an optional cardinal side, an optional
    `glazed` marker, and an optional door/window `binary_sensor` (axis
    derived from floors).
  - Outer-wall `beyond` classification (`outdoor` / `neighbor` / `earth`)
    - home occupancy extent (`whole_property` / `unit_within_building`),
      floor-`level` consumption + completion where unset.
  - **Config flow (singleton)** for setup-level choices only
    (`occupancy_extent`, opt-in imports, label-projection toggle) —
    covers Bronze `test-before-configure` / `test-before-setup` with
    meaningful checks (area registry accessible, store readable).
  - **Admin UI / panel** as the primary editing surface for area
    annotations, edges, and connections via named presets (expanding to
    `passage` + `barrier`); WebSocket API with `connection.user` auth,
    writes admin-gated. Rationale in `DECISIONS.md` — "Editing Surface".
  - **Reactive registry watcher**: area/floor add/rename/delete handling
    with 72 h orphan-undo window; automatic startup + daily cleanup.
  - **One-shot imports** (opt-in): from HA area `aliases` (heuristic
    `type` inference) and from user labels (as seed for `environment` /
    `type`). Never live consumption.
  - Read-only **schematic per-floor 2D map** + consistency view (§7).
  - Read hook for consumers (WebSocket API + attribute conventions);
    documented enums; consistency / health signal.
  - Diagnostics (`async_redact_data` for optional freetext fields;
    graph + trust distribution otherwise non-sensitive).
  - Opt-in **label projection** of `environment`/`type`/trust (§6).
  - Repairs (see §8): unannotated-area threshold, orphaned edges past
    undo window, contradictory bearings, exterior openings on non-outdoor
    walls, unknown enum values after downgrade.
  - Blueprints published alongside v1 for the anchor consumers listed in
    §9 (perimeter-at-night notify, west-side covers at sunset,
    ventilation coordination).
- **Later (v2+), not v1:**
  - **3D house view** — floors stacked by `level` into one orbit/zoom
    "house"; procedural layout. Split from the v1 per-floor 2D map so
    frontend work does not block v1 release. Details in §7.
  - **Starter templates** — one-click scaffolds that create several areas
    - connections at once (e.g. "apartment" → typical rooms + a `shared`
      hallway + a perimeter front door; "two-storey house" → ground and
      upper landing joined by an open stair). Deferred deliberately: high
      variant/maintenance cost and a real risk the template never matches
      the actual home. The two-axis connection presets and the `type`
      cascade cover everyday setup without it.
  - **Assist intent pack** — dedicated `intent_script` handlers that
    expose topology filters to the built-in Light/Cover/Lock intents
    ("outside", "north-facing", "on the perimeter"). v1 ships only
    documented Jinja recipes (§9).
  - **Multi-instance composition** — see `DECISIONS.md` "Future
    Considerations — Multi-Instance Composition".
  - Core-`type` merge facade — see `DECISIONS.md` "Future Considerations
    — Core Contribution of `type`". No action until Core lands the field.

## 6. Label projection & exit (Core interop)

topology is the **area-facing half** of the shared label-projection
policy; **`PLAN.md` §5 is the policy owner** and this section mirrors it.
When the policy in Residents changes, topology follows in the same
minor release; a mismatch between the two documents is a bug, not a
divergence. One-way, opt-in, integration-owned:

- Projects **`environment`** (indoor/outdoor), room **`type`**, and the
  **trust class** (`private`/`shared`/`public`) onto **area** labels
  (`topology:outdoor`, `topology:bedroom`, `topology:public`, …) so Core
  label features — automation `target`, UI filters, voice — can use them
  without going through topology's read hook. The trust label is
  especially useful as a security-automation target.
- **Floors and the adjacency graph are not projectable** — floors carry
  no labels (verified in `helpers/floor_registry.py`) and a graph is not
  a tag. Those stay topology-native (or a diagnostics export).
- **Owned + namespaced:** topology creates/updates/deletes only its own
  labels (tracked in its store, marked via the label `description`), never
  user labels. A one-time opt-in _import_ may seed `environment`/`type`
  from existing user labels; there is no live consumption.
- **Exit:** because labels live in the Core registry, the projected
  `environment`/`type` labels survive uninstalling topology — kept by
  default as a deliberate leave-behind, purgeable on request. That
  single-valued per-area subset is the only part of topology's data that
  outlives the integration.

## 7. Visual map (for humans)

§1 makes topology machine-readable "for automations, not for humans"; this
is the human counterpart — a rendered view purely to **see and verify**
what was entered, never a data source. It is _derived_ entirely from the
existing model (areas, `type`, `environment`, `trust`, the adjacency graph
with its connections, floor `level`, bearings) and adds **no** stored
geometry, room measurements, or **room shape** — square, rectangular, and
polygonal areas are all the same to the model. A cardinal side (N/E/S/W)
is a rough _direction label_ that can carry several walls, windows, or
connections at once, so odd shapes (an L-shaped room, two windows on the
south side) need no shape field; block sizes in the map come from graph
degree, not a stored outline.

**"Schematic" is about the data, not the visuals.** The absence of
measurements means room blocks are _procedurally generated_ from the
graph, bearings, and floor — an inferred massing model, not a surveyed
floorplan — but the render itself can be rich: a **rotatable, zoomable
3D** view
(WebGL / three.js, bundled in the panel, no external assets) is the
target, and for the stacked house it is the natural one. 3D does not
supply the missing geometry; it only makes the inferred arrangement
legible and explorable.

- **Per-floor view (v1)** — one view per floor: areas as blocks (icon /
  label by `type`, tint by `trust`, indoor/outdoor styling by
  `environment`), connections drawn between them (styled by `passage` /
  `barrier` — door vs. open vs. solid wall, stair / lift marked). Ships
  the verification value cheaply and **is explicitly 2D in v1** — the 3D
  house view is a separate v2+ milestone so a slipping frontend estimate
  never blocks v1 release. The 2D map already carries all consistency
  checks below.
- **Consistency check (v1)** — being a faithful render of the graph, the
  view doubles as QA: isolated areas (no connection), an _indoor_ area on
  no floor (outdoor areas may legitimately have none), missing bearings,
  contradictory bearings (A north of B _and_ B north of A), or an exterior
  window / door placed on a non-`outdoor` wall show at a glance and are
  surfaced as diagnostics. These are
  **topology's own** repair issues (its data), and the same result is
  published as the consistency / health signal on the read hook (§3.6) so
  consumers can react without re-deriving the checks.
- **3D house view (v2+)** — floors stacked by `level` into one orbit /
  zoom "house", vertical connections (stairs, lifts) drawn between floors,
  outdoor areas (garden, yard) placed around the stack.
- **Procedural layout (the hard part, v2+)** — positions and _sizes_ come
  from a graph layout, not coordinates. A hub is **sized by its degree**
  so several rooms attach along one face — the hallway with three rooms off
  its north side becomes a long block, not a point (the case you called
  out). This is akin to deriving a rectangular floorplan from an adjacency
  graph: solvable for most homes, but some graphs have no clean
  realization → the layout falls back to a looser arrangement, and
  optional **presentation-only** node nudging (drag to declutter) may be
  stored as display hints, kept strictly separate from the semantic model —
  layout sugar, never coordinates that carry meaning.

## 8. Quality Scale rule mapping (Platinum target)

Every rule from Bronze up through Platinum. Status is one of:
**IMPL** (implemented / to implement in the phase noted), **N/A**
(legitimately not applicable — reason recorded), **DECL** (self-declared
compliance, no automated check). Rationale is anchored in an ADR where
non-obvious.

### Bronze

| Rule                             | Status | Phase | Note                                                                                     |
| -------------------------------- | ------ | ----- | ---------------------------------------------------------------------------------------- |
| `action-setup`                   | IMPL   | 6     | Services registered in `async_setup`, not `async_setup_entry`                            |
| `appropriate-polling`            | N/A    | —     | Event-driven; no polling. ADR "Coordinator Role"                                         |
| `brands`                         | IMPL   | 8     | PR to `home-assistant/brands` before release                                             |
| `common-modules`                 | IMPL   | 1–2   | `coordinator.py` (event fanout) + `entity.py`                                            |
| `config-flow`                    | IMPL   | 2     | Singleton setup flow; ADR "Editing Surface"                                              |
| `config-flow-test-coverage`      | IMPL   | 2     | pytest coverage of every flow branch                                                     |
| `dependency-transparency`        | IMPL   | 1     | No PyPI dependencies                                                                     |
| `docs-actions`                   | IMPL   | 8     | Every service action in user docs                                                        |
| `docs-high-level-description`    | IMPL   | 8     | `docs/user/index.md`                                                                     |
| `docs-installation-instructions` | IMPL   | 8     | HACS + manual                                                                            |
| `docs-removal-instructions`      | IMPL   | 8     | Plus label leave-behind explanation (§6)                                                 |
| `entity-event-setup`             | IMPL   | 3     | Register listeners in `async_added_to_hass`, unregister in `async_will_remove_from_hass` |
| `entity-unique-id`               | IMPL   | 3     | Household + perimeter: fixed; per-area: `f"{entry_id}_{area_id}_{axis}"`                 |
| `has-entity-name`                | IMPL   | 3     | All entities set `_attr_has_entity_name = True`                                          |
| `runtime-data`                   | IMPL   | 2     | Typed dataclass in `ConfigEntry.runtime_data`                                            |
| `test-before-configure`          | IMPL   | 2     | Area registry accessible, store loadable                                                 |
| `test-before-setup`              | IMPL   | 2     | Same checks in `async_setup_entry`                                                       |
| `unique-config-entry`            | IMPL   | 2     | `single_config_entry: true` in manifest                                                  |

### Silver

| Rule                            | Status | Phase | Note                                                              |
| ------------------------------- | ------ | ----- | ----------------------------------------------------------------- |
| `action-exceptions`             | IMPL   | 6     | `ServiceValidationError` / `HomeAssistantError` per HA convention |
| `config-entry-unloading`        | IMPL   | 2     | Full unload of listeners + WS handlers                            |
| `docs-configuration-parameters` | IMPL   | 8     | Every config-flow field documented                                |
| `docs-installation-parameters`  | IMPL   | 8     | `occupancy_extent`, imports, projection toggles                   |
| `entity-unavailable`            | IMPL   | 3     | Set unavailable when store fails to load                          |
| `integration-owner`             | IMPL   | 1     | `codeowners: ["@jpawlowski"]` in manifest                         |
| `log-when-unavailable`          | IMPL   | 3     | Info-level, once per unavailability transition                    |
| `parallel-updates`              | IMPL   | 3     | `PARALLEL_UPDATES = 0` per platform                               |
| `reauthentication-flow`         | N/A    | —     | No credentials                                                    |
| `test-coverage`                 | IMPL   | 3+    | ≥ 95 % from Phase 3 onward; enforced in CI                        |

### Gold

| Rule                         | Status | Phase | Note                                                                   |
| ---------------------------- | ------ | ----- | ---------------------------------------------------------------------- |
| `devices`                    | N/A    | —     | No physical devices; ADR "Manifest Declaration"                        |
| `diagnostics`                | IMPL   | 6     | Adjacency graph + trust distribution; `async_redact_data` for freetext |
| `discovery`                  | N/A    | —     | Nothing to discover                                                    |
| `discovery-update-info`      | N/A    | —     | See above                                                              |
| `docs-data-update`           | IMPL   | 8     | Event-driven model, no polling; document the invalidation flow         |
| `docs-examples`              | IMPL   | 8     | Ship blueprints from §9 as examples                                    |
| `docs-known-limitations`     | IMPL   | 8     | Single instance, no coordinate geometry, no runtime label consumption  |
| `docs-supported-devices`     | N/A    | —     | No devices                                                             |
| `docs-supported-functions`   | IMPL   | 8     | Enumerated feature list                                                |
| `docs-troubleshooting`       | IMPL   | 8     | Registry-event debugging, orphan cleanup, panel access                 |
| `docs-use-cases`             | IMPL   | 8     | Anchor consumers in §9                                                 |
| `dynamic-devices`            | N/A    | —     | No devices                                                             |
| `entity-category`            | IMPL   | 3     | Per-area triples: `diagnostic`; house sensor: unset                    |
| `entity-device-class`        | IMPL   | 3     | Perimeter binary: `opening`; per-area: no matching class               |
| `entity-disabled-by-default` | IMPL   | 3     | Per-area triples disabled by default                                   |
| `entity-translations`        | IMPL   | 3     | `strings.json` per entity                                              |
| `exception-translations`     | IMPL   | 6     | `strings.json` `exceptions` block                                      |
| `icon-translations`          | IMPL   | 3     | `icons.json` per state                                                 |
| `reconfiguration-flow`       | IMPL   | 2     | Mirrors initial setup only                                             |
| `repair-issues`              | IMPL   | 6     | Set defined in §5 v1 scope                                             |
| `stale-devices`              | N/A    | —     | No devices                                                             |

### Platinum

| Rule                | Status | Phase | Note                                                           |
| ------------------- | ------ | ----- | -------------------------------------------------------------- |
| `async-dependency`  | N/A    | —     | No external dependency; ADR "Manifest Declaration"             |
| `inject-websession` | N/A    | —     | No HTTP                                                        |
| `strict-typing`     | IMPL   | 1+    | Pyright strict mode; `py.typed` marker; no `Any` in public API |

**Blockers for the official badge**, tracked in `DECISIONS.md` — "Quality
Target":

1. `documentation` URL must move to
   `https://www.home-assistant.io/integrations/topology` — requires a
   Core merge (v2+).
2. Core-team architecture review — scheduled once user base is
   nontrivial.
3. Test coverage ≥ 95 % continuously — enforced from Phase 3 onward.

## 9. Ecosystem anchor consumers

topology's data is useful in itself, but the biggest ecosystem lift comes
from shipping reference wiring for the integrations most likely to
consume it. Everything below is documented and — where it makes sense —
shipped as a **blueprint** with v1, so users get value on day one instead
of building the plumbing themselves.

- **Residents** (this repo's canonical consumer) — full contract in §2.
- **Alarmo / `alarm_control_panel`** — the derived perimeter-connection
  set (`binary_sensor.topology_perimeter_open` + attribute list) is a
  drop-in replacement for the "list every door/window sensor by hand"
  pattern. The read hook exposes each perimeter edge's bound
  `binary_sensor`, so an Alarmo config can be built from a template
  fetch rather than hard-coded lists.
- **Assist / Voice** — topology attributes unlock filters like "outside",
  "north-facing", "on the perimeter" for the built-in Light / Cover /
  Lock intents. v1 ships **documented Jinja recipes** in `docs/user/`;
  a dedicated `intent_script` extension pack is v2+.
- **Adaptive Lighting / circadian integrations** — `bearing` per
  connection + `glazed` flag unlock west-facing / east-facing filtering
  without hard-coding entity lists per room.
- **Energy / weather-reactive automations** — `outdoor` areas as a
  first-class target (retract awnings, protect balcony plants), `glazed`
  exterior connections as a passive-solar signal (v3), `beyond: earth`
  as a passive-cooling signal.
- **Notification layer (`courier`, planned in a sister repo)** — reads
  `needs_quiet` (derived by Residents from topology `environment`) and
  the trust class to decide discretion on shared channels.

**Blueprints shipped with v1** (as concrete examples for `docs-examples`
and to seed adoption):

1. _Notify when a perimeter door opens at night_ — uses
   `binary_sensor.topology_perimeter_open` + a sun/phase condition.
2. _Close covers on the west side before sunset_ — uses per-connection
   `bearing` filter via `expand` on adjacency attributes.
3. _Alarm exterior sensors when away_ — auto-selects perimeter
   connections without hard-coding entity lists.
4. _Ventilation coordination_ — throttle ventilation when any
   `barrier: door` / `barrier: open` connection to an `outdoor` area is
   open.

Each blueprint's template consumes only stable, documented attributes
from §1a and the read hook §2 — the same contract that Residents,
Alarmo, and any third-party consumer will use.

## 10. Design freeze points

The design-plan sections above deliberately stop above the code layer;
the concrete per-phase implementation plans (dataclass signatures,
store schemas, WS command payloads, entity IDs, etc.) are written
**per phase, right before that phase begins**. What must be _frozen_
before a given phase's implementation plan can be written is captured
here, so an implementation-plan author knows what they may fix in
stone and what they must leave open.

Each freeze point is a hand-off gate: once passed, changing the frozen
artifact costs a deprecation window (analogous to `PLAN.md` §9's public
interface commitments, but internal).

### Before Phase 1 (skeleton cleanup) — frozen now

- Manifest: `integration_type: helper`, `iot_class: calculated`,
  `single_config_entry: true`, `quality_scale: platinum`
  (`DECISIONS.md` — "Manifest Declaration").
- Package layout: keep `coordinator/`, `entity/`, `entity_utils/`,
  `config_flow_handler/`, `service_actions/`, `utils/`, `translations/`,
  `sensor/`, `binary_sensor/`; **delete** `api/`, `fan/`, `switch/`,
  `number/`, `button/`, and the polling helpers
  (`error_handling.py`, `data_processing.py`).
- Coordinator role: event fanout, no polling
  (`DECISIONS.md` — "Coordinator Role"); `PARALLEL_UPDATES = 0`.
- Python + HA baseline: HA 2026.7, Python 3.13, Pyright strict mode,
  `py.typed` marker.

### Before Phase 2 (data model, config flow, storage)

Must be frozen — this is the next active gate:

- **Store JSON schema v1** — dataclass shape for `AreaAnnotation`,
  `Edge`, `Connection`, `Beyond`, `HomeConfig`; storage version
  constant; migration hook signature; example payload.
- **Enum sets v1** — exact values for `type` (initial catalog),
  `environment`, `trust`, `passage`, `barrier`, `beyond`,
  `occupancy_extent`; connection-preset name → `passage`+`barrier`
  expansion table.
- **Enum-versioning policy** — how a consumer reads an unknown enum
  value produced by a newer topology version: fallback to `null` on the
  read hook + raise repair issue on downgrade. Documented in
  `docs/development/` alongside the schema.
- **WebSocket API contract v1** — command list, payload shapes,
  response shapes, error codes, change-notification event names.
  Frozen as the public interface commitment analog to `PLAN.md` §9.
- **Config-flow field set** — occupancy_extent, opt-in imports,
  label-projection toggle; Voluptuous schema definitions.
- **`runtime_data` structure** — the typed dataclass held on
  `ConfigEntry.runtime_data`.
- **Consistency / health signal shape** — the structure returned as
  part of the WS read hook (§3.6).

### Before Phase 3 (entities)

- **Entity ID scheme** — exact patterns for `sensor.topology_house`,
  `binary_sensor.topology_perimeter_open`, and per-area
  `sensor.topology_<area_slug>_type|environment|trust`.
- **`unique_id` generation rules** — deterministic, migration-safe
  (survives area rename).
- **Attribute names + machine-readable formats** — the public entity
  contract; from this point changes require a deprecation window.
- **`icon-translations` + `entity-translations` key set** — every
  entity+state combination that needs an icon or a label.

### Before Phase 4 (aggregates + derivations)

- **Perimeter-open derivation semantics** — any-of over bound sensors,
  debounce interval, behavior when a bound sensor is unavailable.
- **Adjacency-graph queries the read hook must serve** — neighbors of
  X, path between X and Y, all connections carrying `outdoor` on one
  side, etc. Pins the query surface v3 quiet grading will call.

### Before Phase 5 (repairs + services)

- **Repair-issue id scheme + severity mapping** — one id per issue
  class (unannotated-threshold, orphaned-past-undo, contradictory-
  bearings, exterior-opening-on-non-outdoor, unknown-enum-after-
  downgrade), plus fix-flow entry points.
- **Diagnostics redaction rules** — which fields carry PII / freetext
  and pass through `async_redact_data`.

### Before Phase 7 (panel)

- **Frontend build pipeline** — Lit vs. plain JS for v1 2D map, bundler
  (esbuild / vite / none), asset-hashing scheme for cache-busting; CSP
  constraint: no external CDN, everything inlined or `StaticPathConfig`-
  served.
- **WebSocket auth model details** — which commands require
  `@require_admin`, which are read-only for authenticated users.

### Before Phase 8 (release)

- **Blueprint distribution mechanism** — in-repo under `blueprints/`
  with Blueprint-Exchange import URLs, vs. a companion blueprint repo.
- **HACS listing form** — category, filters, screenshots.
- **Brands PR content** — icon set, logo, colors.
