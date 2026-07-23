# Topology — Implementation Plan

**Status:** Binding plan · Last updated 2026-07-23

This document is the authoritative implementation plan for the **topology**
integration developed in this repository. It replaces the earlier three-file
split (PLAN.md, PLAN-topology.md, PLAN-courier.md) that was carried over from
the sister residents repository, and rewrites the topology material from a
Residents-interface perspective into a first-person implementation plan.

Two sister integrations are planned alongside topology, each in a separate
repository, and only consume from it — never the other way round:

- **residents** ([jpawlowski/hass.residents](https://github.com/jpawlowski/hass.residents))
  — models the people and pets of a household as a first-class domain
  (state, membership, relationships, master data). Consumes topology
  _optionally_, the same way it consumes Proximity: capabilities degrade
  cleanly when topology is absent.
- **courier** (planned in its own repository) — a notification layer that
  reads from residents. Courier does **not** read topology directly; it
  sees topology only transitively, through values residents derives from
  it (e.g. `needs_quiet` after adjacency propagation, perimeter-open
  checks).

Everything in this repository — code, entity IDs, state values, services,
documentation — is written in **English**. Localized UI strings come from
Home Assistant translation files only.

## 1. Vision (condensed)

Home Assistant knows _which_ areas and floors exist, but nothing _about_
them: an area has no type, no indoor/outdoor flag, and no notion of which
areas border each other. topology is a thin metadata layer over the HA
area/floor registry that makes the house **machine-readable** — a
floorplan for automations, not for humans.

topology **consumes, never rebuilds** the area/floor registry: it never
defines areas, only annotates them. The primitives are fixed at planning
level:

- **Area type** — an open catalog with defaults (`bedroom`, `living`,
  `kitchen`, `dining`, `bathroom`, `hallway`, `office`, `utility`,
  `storage`, `garage`, `outdoor`). Type is a _descriptive hint_, never
  authoritative: it may seed defaults (e.g., suggest a `sleeping_place`
  when type = `bedroom`) but residents' sleeping-area derivation stays
  the source of truth. Within topology, picking a type also **cascades
  editable defaults** onto the other two area fields — `bedroom` ⇒
  indoor + `private`, `hallway` ⇒ indoor + `shared`, `outdoor` ⇒
  outdoor — so an area is one choice plus corrections, not three
  separate decisions. These are only starting points; `trust` in
  particular stays individual (a front garden is `outdoor` but
  `public`).

- **Environment** — `indoor` · `outdoor` · `semi_outdoor` (covered
  balcony, porch). A balcony, terrace, or garden is a real area but a
  fundamentally different kind of space than an interior room.

- **Trust / exposure class** — a per-area, user-set rating of how exposed
  a space is, **orthogonal to environment**: `private` (exclusively
  yours — rooms, a fenced back garden) · `shared` (limited / communal
  access — an apartment building's hallway, a shared garden) · `public`
  (exposed to strangers — the street, an open front yard). The scale is
  **ordered** (`private` < `shared` < `public`), which makes the
  perimeter derivation (under Connections) machine-evaluable. It is
  deliberately individual: the same terrace door faces a private back
  garden in one home and a public street in another. Trust is
  independent of environment — back garden = outdoor + `private`,
  hallway = indoor + `shared`, front yard = outdoor + `public`,
  bedroom = indoor + `private`.

- **Adjacency graph** — undirected area↔area edges. The horizontal /
  vertical **axis** is _derived_ from the two areas' floors (same
  `level` = horizontal, differing = vertical) and never stored. An edge
  is backed by **one or more connections** (next primitive) — two
  floor landings routinely hold both a stair and a lift at once, so a
  single edge is a _bundle_, not one link. "Connected vs. only next to
  each other" is whether any connection is traversable; graph
  "distance" is the hop count plus the floor-level difference.
  Observer-relative directions (left/right/front/back) are deliberately
  **not** modeled — they are ambiguous without a fixed viewpoint — and
  there are no metric (x/y/z) coordinates.

- **Connections (doors, windows, stairs, lifts …)** — one physical way
  the two sides of an edge meet; an edge carries a **list** of them, so
  a stairwell with both a stair and a lift is two connections, not a
  compromise into one. Each connection has:
  - **`passage`** — how a person crosses: `none` (adjacent, not
    traversable) · `level` (walk, same floor) · `stairs` · `ramp`
    (vehicle or wheelchair) · `elevator` · `ladder` · `hatch`.
    Distinguishing `stairs` / `ramp` / `elevator` also enables step-free
    routing later.
  - **`barrier`** — permeability to sound / air / light: `open` (no
    barrier — open doorway, or an open stairwell / atrium _void_) ·
    `door` (closable, state-dependent; the leaf mechanism — hinged,
    sliding, pocket, folding — is _not_ distinguished, it changes
    nothing the model reasons about) · `solid` (a wall, or a floor /
    ceiling slab).
  - optional **side** — the cardinal bearing (`N` · `E` · `S` · `W`,
    rough side only, never geometry); the two areas carry opposite
    bearings (N↔S / E↔W).
  - optional **sensor** — a Home Assistant door/window `binary_sensor`
    for live open/closed state (only meaningful for `barrier: door`).
  - optional **`glazed`** — the connection transmits daylight (a
    window, interior or exterior). v1 keeps `barrier` coarse;
    separating light as its own permeability (borrowed-light reasoning)
    is a later refinement.

  So an open stairwell + lift between two landings is `{stairs, open}`
  and `{elevator, door, sensor}`; a plain shared wall is a single
  `{none, solid}`. A connection is **interior** when it leads to
  another area (it backs that edge) or **exterior** when it faces
  outside (a window or outside door, no second area — attached to the
  one area). A window can be either: an **exterior** window on an
  `outdoor` wall (see next primitive), or an **interior** `glazed`
  connection between two of your areas that passes daylight to an
  inner room. Propagation for downstream reasoning (quiet grading, air
  flow) takes the **most permeable connection** on an edge: an open
  stair dominates an enclosed lift beside it.

  In the UI a connection is picked from a named **preset** — interior
  door, open passage, shared wall, open stair, enclosed stair, lift,
  loft ladder, ramp, window, outside door — that expands to a
  `passage` + `barrier` pair. The **stored model stays the two-axis
  form**, so presets are convenience only, not a new object type; rare
  real combinations (a glass observation lift = `elevator` + `open`)
  remain settable by hand without a preset for every permutation.

  What lies **beyond** a traversable interior connection is the trust
  class of its target area; a bare exterior connection with no modeled
  target defaults to `public` (nothing behind it ⇒ treat as exposed),
  or may carry an inline class so a building hallway can be `shared`
  without being modeled as its own area. A **perimeter connection** —
  the secure envelope of the home — is _derived_ from the trust delta:
  any connection whose two sides differ in trust class
  (private↔shared, private↔public) is one, so the set of doors to
  watch when away or asleep falls out automatically. An optional
  per-connection **`perimeter` flag** covers the rare same-class
  boundary the delta cannot see — a door between a main flat and a
  granny flat, both `private` — forcing it to count as a perimeter.

- **Outer walls (`beyond`) & occupancy extent** — a wall side of an
  area that does _not_ border one of your own areas gets a **`beyond`**
  class: `outdoor` (open air — the only side an exterior window or
  balcony door may sit on), `neighbor` (a party wall to a foreign
  occupied unit you do not model — "there is a wall here, not empty
  air, and not the outside"), or `earth` (a buried wall, e.g. a cellar
  against soil — no window possible). "Exterior vs. interior wall" is
  therefore _derived_, never a second flag: interior = the side borders
  your own area (an edge); exterior / party / buried = the `beyond`
  class. This is what lets the UI **constrain window placement** — an
  exterior opening is offered only on an `outdoor` side. A home-level
  **occupancy extent** — `whole_property` vs. `unit_within_building` —
  records whether all areas together are a standalone home or a unit
  inside a larger structure; largely derivable (any `neighbor` wall ⇒
  a unit) but kept explicit for the map (envelope vs. unit) and as the
  default for unmodeled outer walls (`whole_property` ⇒ `outdoor`, a
  unit ⇒ `neighbor` / unknown).

- **Floors & vertical stacking** — topology consumes the HA floor
  registry, whose `level: int | None` is the **authoritative vertical
  ordering** (HA itself sorts floors by `level`, higher = higher up;
  verified in `helpers/floor_registry.py`). Where `level` is unset,
  topology lets the user supply it (consume, then complement). Floor
  `level` orders the _floors_; which specific area sits above which
  specific area is a separate fact, carried by explicit **vertical
  connections** (`stairs` / `ramp` / `elevator` / `ladder` / `hatch`,
  or a `{none, solid}` connection for a plain stacked ceiling) between
  the two areas. A multi-storey garage is just negative-`level` floors
  joined this way; a stair or lift serving many floors is modeled as
  per-floor landings (or a small `shared` shaft area) with pairwise
  connections — no hyper-edge primitive is needed. "Above/below" is
  therefore always unambiguous; "north/west of" is available wherever
  a bearing was set.

**Modeling is individual.** Outdoor space can be one area (one trust
class) or split — front yard `public`, back garden `private`, or
further by bearing (N/E/S/W) — whatever the site needs; merging front
and back into one garden area means one shared trust class, so split
when they differ. A building's shared hallway may be modeled as a
`shared` area (so a further hallway→street door shows `shared` vs.
`public`) or left implicit on the apartment door via the connection's
inline class. topology forces neither; it only makes the chosen
granularity machine-readable.

topology is useful **standalone** — annotating areas is valuable
without residents — so it must never depend on residents (or on
courier, which does not see topology at all).

**Consume, complement, build.** Every primitive is deliberately sorted
into one of three classes:

| Class            | Rule                    | Examples in topology                                                    |
| ---------------- | ----------------------- | ----------------------------------------------------------------------- |
| HA has it        | consume, never rebuild  | area registry, floor registry (`level`), labels, door/window sensors    |
| HA almost has it | complement, do not fork | floor `level` where unset (topology writes back the missing ordering)   |
| HA lacks it      | build                   | area type/env/trust, adjacency graph, connections, `beyond`, perimeter  |

## 2. Consumers and interface contract

topology is designed to be useful on its own — the panel + map (§7)
already deliver value without any consumer — and to expose the same
data cleanly to sister integrations. Two consumer relationships are
planned around:

- **Direct: residents.** residents reads topology attributes and the
  read hook; each dependent capability degrades cleanly when topology
  is absent, with a repair issue pointing the user to install it.
- **Indirect: courier.** courier consumes residents' entities, not
  topology's. Where a courier feature depends on topology data (e.g.
  silencing shared channels in areas that need quiet after adjacency
  propagation), that dependency is invisible to courier: the value
  arrives inside a residents-owned attribute. topology therefore has
  no obligations to courier — only through residents.

### 2.1 What residents reads

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

Nothing here is required by residents v1. Each consumer is a
refinement that **degrades cleanly** when topology is absent
(see §2.3).

### 2.2 Obligations this imposes on topology

Because residents is the consumer, these obligations bind topology:

1. **Key on the HA `area_id` and `floor_id`** — no new identifier
   space. Both integrations reference areas and floors by the same
   registry keys (topology consumes the floor registry's `level`
   rather than inventing a floor ordering), so there is nothing to
   reconcile.
2. **Machine-readable values** — enumerated type / environment /
   trust / passage / barrier / beyond values and a typed adjacency
   structure; no display-only strings on the contract surface.
3. **Documented enumerations** — the type catalog, environment
   values, and edge kinds listed in user docs so residents can
   validate against them and degrade on unknown values.
4. **No residents special-casing** — if residents needs something
   new, it is added as a general topology feature or not at all. This
   applies equally to any indirect need surfaced via courier: courier
   never talks to topology, so its wishes only enter topology by
   first being folded into a general residents-level requirement.
5. **Detection + read hook** — a documented, cheap way for residents
   to detect topology and read per-area metadata + the adjacency
   graph. A WS API is the primary form; per-area entity attributes
   mirror the same values so classic templates keep working if the
   WS surface changes.
6. **Consistency / health signal** — expose a cheap, machine-readable
   summary of data completeness (ok / warnings + which areas are
   affected) through the read hook, so a consumer can detect
   incomplete topology data and degrade **without re-implementing
   topology's own checks**. The checks themselves (§7) belong to
   topology and raise topology's own repair issues.

### 2.3 Degradation without topology

residents must run fully without topology installed. Each consumer
has a conservative fallback plus a **repair issue** pointing the user
to topology when a dependent capability would benefit:

| Without topology       | residents' replacement                                              |
| ---------------------- | ------------------------------------------------------------------- |
| `environment` per area | assume `indoor` (conservative: no area silently drops out of quiet) |
| area `type`            | no default suggestions; relationships set manually                  |
| adjacency graph        | no quiet grading; only per-area `needs_quiet`, no propagation       |

These fallbacks live in residents, not in topology; documented here
only to close the loop on what "cleanly degrade" means.

## 3. Technical foundations (spikes)

Verified against the Home Assistant **2026.4.4** source installed in
the devcontainer venv (repo baseline is 2026.7; re-verify live in
Phase 0). File references are relative to the installed
`homeassistant/` package.

### 3.1 Area & floor registry consumption — viable

- `helpers/area_registry.py` exposes `AreaRegistry` with typed
  entries carrying `id`, `name`, `floor_id`, `labels`, and free-form
  attributes. topology never creates or deletes areas; it only reads
  entries and (for label projection, §5) mutates the area's own
  `labels` set.
- `helpers/floor_registry.py` sorts floors by `level: int | None`;
  higher `level` = higher up. Where a user has left `level` unset,
  topology completes the ordering via the floor registry's update
  API. Floors carry no labels of their own — a graph is not a tag —
  so all floor annotations stay integration-native.
- **Caveat:** entries are mutated at the registry level, not via a
  config entry; topology must own its writes cleanly (track what it
  set, only clear its own values, never touch user-authored fields).

### 3.2 Storage: `helpers.storage.Store` — viable

- Areas and floors already live in the HA registries; topology has
  no need for per-area config subentries (there is no user "add area"
  flow — the area already exists). Instead:
  - a single top-level `Store` keyed on `area_id` for annotations
    (type, environment, trust, per-side `beyond`, side bearings),
  - a companion `Store` for the graph (edges keyed on a stable
    `(area_id, area_id)` pair or an internal `edge_id`, each carrying
    its list of connections; connections carry an internal
    `connection_id` so a door/window `binary_sensor` link is stable
    across renames), and
  - a small home-level document for occupancy extent
    (`whole_property` vs. `unit_within_building`).
- All stores carry a schema version and a migration hook from day
  one (Phase 2). The main config entry is a bare hub — no data on it,
  no reloads on annotation edits.

### 3.3 Read hook: WebSocket API + attribute mirror — viable

- The detection + read hook (obligation §2.2 #5) is served by a
  small WebSocket API namespace (`topology/subscribe_areas`,
  `topology/subscribe_graph`, `topology/health`). Every command sees
  the authenticated user server-side via `ActiveConnection.user`
  (`components/websocket_api/connection.py:39-98`); read is open,
  writes are admin-gated.
- The same values are mirrored as attributes on per-area entities
  (§3.5 below): so consumers that prefer classic templates or state
  triggers keep working if the WS surface has to change. The
  attribute contract and the WS contract carry the same values; both
  are frozen together at the end of Phase 5.

### 3.4 Sidebar panel with server-side authorization — viable

- Register a sidebar panel via
  `panel_custom.async_register_panel(module_url=...)` plus
  `hass.http.async_register_static_paths([StaticPathConfig(...)])`
  (full pattern in `components/dynalite/panel.py:98-116`).
- The panel is topology's primary UI: annotating areas, drawing
  edges, choosing connection presets, and inspecting the schematic
  map (§7). WS writes are `@require_admin`; reads are open.
- **v1** ships a 2D per-floor schematic. **v2+** upgrades to the
  rotatable/zoomable 3D house view (WebGL / three.js, bundled in the
  panel, no external assets). No external CDNs or fonts — everything
  ships with the integration.

### 3.5 Per-area entities — viable

- One `sensor.topology_area_<slug>` entity per HA area, state = the
  area's `type` (or `unknown`), attributes = `environment`, `trust`,
  bearings, floor `level`, adjacency summary, perimeter derivation.
  Entity state and attributes are the classic-templates fallback for
  the WS read hook.
- A household-level `binary_sensor.topology_perimeter_open` reflects
  whether any perimeter connection with a linked `binary_sensor` is
  currently open. Additional aggregates (e.g. count of unresolved
  consistency warnings) live on a diagnostic sensor.

### 3.6 Custom triggers and conditions — deferred to v2

- The new-style Trigger/Condition platform API
  (`helpers/trigger.py:174-330`,
  `helpers/condition.py:287-329, 687-702`) works for custom domains,
  but topology's v1 surface is state-shaped, not event-shaped. Users
  drive automations off the per-area entities (§3.5) and the WS API;
  custom triggers/conditions are considered again once real-world
  usage identifies which are worth the maintenance cost.

## 4. Architecture decisions

Recorded as ADRs in [DECISIONS.md](./DECISIONS.md); summary of the
topology-level choices:

- **Storage: single `Store` per aspect, keyed on registry IDs.** No
  config subentries per area — areas are user-created in the area
  registry, topology only annotates them. The main config entry is a
  bare hub. Runtime perimeter/open state is derived from linked HA
  sensors and is never persisted.
- **Panel-first configuration.** Type/environment/trust are simple
  enough for a compact editor per area; adjacency and connections
  need a spatial editor from day one. YAML-only configuration is not
  a goal — connections between areas are inherently graph-shaped and
  unpleasant to hand-edit.
- **Read hook shape: WS API primary, attribute mirror on entities as
  fallback.** Both frozen together at the end of Phase 5.
- **HA baseline: 2026.7** (minimum in `hacs.json`, enforced by
  `script/ha-version-sync`).
- **Template sync stays enabled** (upstream is the maintainer's own
  blueprint; project-identity files are protected via
  `.templatesyncignore`).
- **Label projection (Core interop): one-way, opt-in, owned.**
  topology may project `environment` (indoor/outdoor), area `type`,
  and the trust class onto **area** labels (`topology:outdoor`,
  `topology:bedroom`, `topology:public`, …) so Core label features —
  automation `target`, UI filters, voice — reach these facts without
  going through topology's read hook. The trust label is especially
  useful as a security-automation target. Rules:
  - **Floors and the adjacency graph are not projectable.** Floors
    carry no labels (verified in `helpers/floor_registry.py`) and a
    graph is not a tag; these stay topology-native (or a diagnostics
    export).
  - **Owned + namespaced.** topology creates/updates/deletes only
    its own labels (tracked in its store, marked via the label
    `description`), never user labels. A one-time opt-in _import_
    may seed `environment` / `type` from existing user labels;
    there is no live consumption.
  - **Exit.** Because labels live in the Core registry, projected
    labels survive uninstalling topology — kept by default as a
    deliberate leave-behind, purgeable on request. That
    single-valued per-area subset is the only part of topology's
    data that outlives the integration.

**Still open** (decide before the referenced phase):

- 4.1 — final entity-ID naming scheme for per-area entities and the
  household perimeter sensor (before Phase 4).
- 4.2 — whether floor `level` completion writes back to the HA floor
  registry immediately, or holds the completion in topology's own
  store until the user confirms (before Phase 2).
- 4.3 — WS namespace and command names for the read hook; whether
  they carry a version tag (before Phase 5).
- 4.4 — connection preset catalogue: whether the initial set is
  closed (fewer surprises for consumers) or extensible via YAML
  (before Phase 3).

## 5. Non-goals

topology will **never** ship:

- **Area or floor creation.** Areas and floors are HA registry
  concepts; topology only annotates them. If an area is missing, the
  user creates it in HA (or via another integration); topology raises
  no config flow for it.
- **Metric coordinates.** No stored x/y/z, no room dimensions in
  metres, no wall lengths. The per-floor map is a graph layout, not a
  surveyed floorplan (§7).
- **Room shape.** Square, rectangular, L-shaped, and polygonal areas
  are all the same to the model; a cardinal side (N/E/S/W) is a rough
  _direction label_ that can carry several walls, windows, or
  connections at once. Odd shapes need no shape field.
- **Observer-relative directions.** No `left`, `right`, `front`,
  `back` — ambiguous without a fixed viewpoint. Only cardinal
  bearings on connection sides.
- **Automation actions.** topology publishes data; it never executes
  actions (the HOMEMODE / HomeCMD mistake). Perimeter alerts, quiet
  automations, and security routines are built by the user (or by
  residents / courier) against topology's entities and read hook.
- **Access control.** Trust is descriptive metadata used by consumers
  to decide policy; topology itself grants no permissions and gates
  no doors.
- **Own presence, alarm, or notification logic.** These belong to
  residents, `alarm_control_panel` / Alarmo, and courier respectively.
- **Migration tooling from other floorplan systems** (SweetHome3D,
  IKEA Home Planner, CAD exports). Import formats can be considered
  in v2+ if a clear standard emerges.
- **Labels as a second source of truth.** Runtime state is never
  mirrored to labels, and labels are never read as a live input;
  label projection is one-way, opt-in, and owned, with at most a
  one-time import.
- **A residents dependency in either direction.** topology stands
  alone; residents consumes it optionally.

## 6. Implementation phases

Each phase ends with `script/check` and `script/hassfest` green and
the listed definition of done. Tests are written per phase (`tests/`
mirrors the package structure).

### Phase 0 — Live spike verification (throwaway)

- **Scope:** After the devcontainer rebuild on HA 2026.7: register a
  minimal sidebar panel via `panel_custom` that opens a WS command
  gated by `@require_admin`; read from the area registry; mutate one
  test-only area label to verify write-back works and survives a
  restart; write and read back one floor `level` update.
- **DoD:** documented go/no-go for panel + WS + registry mutation
  (screenshot evidence); spike code deleted. If no-go on registry
  mutation: label projection (§5) becomes a diagnostics export only
  and the panel edits fall back to a topology-owned store.

### Phase 1 — Skeleton cleanup

- **Scope:** Remove the blueprint example: platforms `fan/`,
  `switch/`, `number/`, `button/`, example `sensor/` / `binary_sensor/`
  entities, `api/` client, example service; empty out
  `services.yaml`, `translations/en.json`, `const.py` example keys.
  The integration loads with a single hub config entry and zero
  entities.
- **Packages:** nearly all under `custom_components/topology/`.
- **DoD:** installable, loads/unloads cleanly, checks green.

### Phase 2 — Data model and storage

- **Scope:** Domain dataclasses (area annotation with type /
  environment / trust / per-side bearings and `beyond`; edge with
  its list of connections; connection with passage / barrier /
  optional side / optional glazed / optional sensor link; home-level
  occupancy extent); three `Store`s (areas, graph, home) with
  schema versions and migration hooks; ID stability for connections
  across renames; area/floor registry consumption (read entries;
  complete floor `level` where unset per ADR 4.2).
- **Packages:** `data.py`, `coordinator/` (registry watcher + graph
  index), `store/` (schemas, migrations, atomic writes).
- **DoD:** data survives restart; area / floor renames preserve
  annotations and connection sensor links; store round-trip and
  migration tests; `hassfest` and `script/check` green.

### Phase 3 — Adjacency, connections, and the `beyond` model

- **Scope:** Connection preset catalogue expanding to the two-axis
  `passage` + `barrier` form (ADR 4.4); interior vs. exterior
  derivation from whether the other side of the edge exists; door /
  window `binary_sensor` linking with graceful handling of a
  vanished sensor; `beyond` per unconnected side (`outdoor` /
  `neighbor` / `earth`); home-level occupancy extent with sane
  defaults (a `neighbor` side ⇒ `unit_within_building`).
- **DoD:** an example home covering an apartment (with a shared
  hallway) and a two-storey house (with an open stair and a lift)
  can be entered end-to-end via WS commands, round-trip through the
  store, and re-load correctly; connection-preset expansion tests.

### Phase 4 — Derivations and per-area entities

- **Scope:** Derived facts computed from the stored model —
  perimeter connections (trust delta + explicit `perimeter` flag),
  effective trust behind a bare exterior connection, adjacency
  summaries per area (list of neighbours, most-permeable barrier
  per edge). Per-area `sensor.topology_area_<slug>` entities
  (state = `type`, attributes = environment / trust / floor level /
  adjacency summary / perimeter membership); household
  `binary_sensor.topology_perimeter_open` and diagnostic sensor(s)
  for consistency warning counts.
- **DoD:** derivations recompute correctly on annotation changes
  and sensor state changes; entity IDs and attribute keys land on
  their final names (freeze target for Phase 5); scenario tests for
  apartment / house / mixed-use.

### Phase 5 — Read hook (public interface freeze)

- **Scope:** WebSocket API (`topology/subscribe_areas`,
  `topology/subscribe_graph`, `topology/health`) delivering the
  full model in a stable schema; attribute mirror on the per-area
  entities carrying the same values; documented enumerations for
  every field; a machine-readable **consistency / health signal**
  (obligation §2.2 #6) that summarises data completeness without
  re-running topology's own checks on the consumer side.
- **DoD:** the WS surface and attribute contract are documented in
  `docs/user/` and covered by contract tests; residents can be
  pointed at a live topology installation and read every value
  listed in §2.1 with only the documented interface. From here on
  the interface is frozen under the §8 policy.

### Phase 6 — Label projection & repair issues

- **Scope:** One-way projection of `environment` / `type` / trust
  onto namespaced area labels (`topology:*`) per ADR "Label
  projection"; one-time opt-in import from existing user labels;
  ownership tracking so uninstall keeps the labels by default and
  purges only on request; repair issues for broken sensor links,
  contradictory bearings, exterior windows on non-`outdoor` sides,
  isolated indoor areas, and any consistency warning that also
  drives the health signal (§5).
- **DoD:** projected labels appear / disappear cleanly on
  annotation changes; import is idempotent; repair issues fire and
  clear against a scripted scenario.

### Phase 7 — Panel: 2D per-floor map

- **Scope:** Sidebar panel with a per-floor schematic map (areas
  as blocks tinted by `trust`, icons by `type`, indoor/outdoor
  styling by `environment`; connections styled by `passage` /
  `barrier`); side-by-side editor for area annotations and edge /
  connection lists via named presets; the map doubles as the
  consistency view — the diagnostics from Phase 6 are surfaced
  visually where they occur.
- **Packages:** `panel/` (bundled static assets, no external
  CDNs), `websocket/` (write commands, admin-gated).
- **DoD:** a fresh install can be fully configured through the
  panel without ever touching YAML; the map keeps up with mutations
  in real time via WS subscriptions.

### Phase 8 — Services, diagnostics, repairs

- **Scope:** Public service actions (set / clear area annotations,
  add / remove / update connections, set occupancy extent, complete
  a floor `level`, purge projected labels); diagnostics with
  `async_redact_data` (redact area names, floor names, sensor
  entity IDs); ensure every repair issue introduced in Phase 6 has
  a working resolver flow.
- **DoD:** services are documented in `services.yaml` with
  selectors; diagnostics redact identifying data; repairs appear
  and resolve on a scripted scenario.

### Phase 9 — Docs and release readiness

- **Scope:** Write real `docs/user/*` (concepts, configuration via
  panel, WS API, label rules, exit behaviour); full
  `ARCHITECTURE.md` rewrite; README feature docs and screenshots;
  brands assets; first release via release-please; HACS listing
  checklist.
- **DoD:** a stranger can install and configure topology from the
  docs alone; residents can be pointed at the documented interface
  contract with no repository access.

### Later (v2+), not v1

- **3D house view.** Floors stacked by `level` into one orbit /
  zoom "house", vertical connections drawn between floors, outdoor
  areas placed around the stack (WebGL / three.js bundled in the
  panel).
- **Procedural layout.** Positions and _sizes_ come from a graph
  layout, not coordinates. A hub is sized by its degree so several
  rooms attach along one face — the hallway with three rooms off
  its north side becomes a long block, not a point. Some graphs
  have no clean realization; the layout falls back to a looser
  arrangement, with optional **presentation-only** drag-to-declutter
  hints stored strictly separate from the semantic model.
- **Starter templates.** One-click scaffolds that create several
  areas + connections at once (e.g. "apartment" → typical rooms + a
  `shared` hallway + a perimeter front door; "two-storey house" →
  ground and upper landing joined by an open stair). Deferred
  deliberately: high variant / maintenance cost and a real risk the
  template never matches the actual home. The two-axis connection
  presets and the `type` cascade cover everyday setup without it.
- **Custom triggers / conditions.** Add-on later if real usage
  demonstrates need (§3.6).
- **Borrowed-light reasoning.** Separating light as its own
  permeability axis, distinct from `barrier` (§1).

## 7. v1 scope mapping

| v1 item                                                                            | Phase   |
| ---------------------------------------------------------------------------------- | ------- |
| Area annotation store (type / environment / trust) with cascade defaults           | 2       |
| Floor-`level` consumption + user-supplied completion where unset                   | 2       |
| Adjacency graph + connections (`passage` + `barrier`, side, sensor, glazed)        | 3       |
| Connection presets expanding to the two-axis form                                  | 3       |
| Outer-wall `beyond` classification + home occupancy extent                         | 3       |
| Derived perimeter connections + explicit `perimeter` flag                          | 4       |
| Per-area entities + household `perimeter_open` binary sensor                       | 4       |
| Read hook: WS API + attribute mirror + consistency/health signal                   | 5       |
| Label projection of `environment` / `type` / trust (one-way, opt-in)               | 6       |
| Repair issues (broken sensor link, contradictions, isolated areas, misplaced exts) | 6       |
| Admin panel with 2D per-floor map + consistency view                               | 7       |
| Services and diagnostics                                                           | 8       |
| Docs and first release                                                             | 9       |

## 8. Public interface commitments

From the end of Phase 5, the following are treated as a public API
with a deprecation policy (one minor release with repair-issue
warning):

- Entity IDs and their state values / attribute keys per per-area
  entity and the household perimeter sensor (documented enumerations).
- WebSocket command names, payloads, and their response schemas.
- The consistency / health signal shape (obligation §2.2 #6).
- The label projection namespace (`topology:*`), the field set
  projected, and the exit behaviour.
- The service action names and their signatures.

Primary consumer: **residents** — see the sister repository for what
it reads and why soft coupling requires this stability. courier
consumes residents, not topology, so its stability contract is with
residents; topology's obligations to courier are always mediated by
residents (§2).

## 9. Open questions

Tracked here until decided; each gets an ADR when closed:

1. Entity-ID naming for per-area entities and the household
   perimeter sensor (before Phase 4).
2. Floor `level` completion path: write back to the HA floor
   registry immediately, or hold in topology's store until the user
   confirms (before Phase 2).
3. WS namespace, command names, and whether the read hook carries a
   version tag (before Phase 5).
4. Connection preset catalogue: closed vs. YAML-extensible
   (before Phase 3).
5. Whether the `perimeter` flag is per-connection only, or also
   per-edge for the "shared same-class boundary" case (before Phase 4).
6. Whether the 2D map ships as SVG or Canvas — trade-off between
   accessibility (SVG) and later 3D reuse (Canvas / WebGL)
   (before Phase 7).
