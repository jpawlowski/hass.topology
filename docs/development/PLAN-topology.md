# Topology — Interface Plan

**Status:** Interface contract · Last updated 2026-07-21

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
  `storage`, `garage`, `outdoor`). Type is a _descriptive hint_, never
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
  fundamentally different kind of space than an interior room.

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
    interior or exterior). v1 keeps `barrier` coarse; separating light as
    its own permeability (borrowed-light reasoning) is a later refinement.

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
- topology v1 scope (planned in its own repository): area type catalog,
  environment flag, per-area trust/exposure class (`private`/`shared`/
  `public`) with derived perimeter connections (+ optional manual
  `perimeter` flag for same-trust unit boundaries), adjacency graph whose
  edges carry a **list of connections** — each with `passage` + `barrier`,
  an optional cardinal side, an optional `glazed` marker, and an optional
  door/window `binary_sensor` (axis derived from floors), outer-wall
  `beyond` classification (`outdoor` / `neighbor` / `earth`) + home
  occupancy extent (`whole_property` / `unit_within_building`),
  floor-`level` consumption + completion where
  unset, opt-in label projection of `environment`/`type`/trust (§6), admin
  UI / panel for drawing edges and placing connections via named presets
  (expanding to `passage` + `barrier`), a read-only schematic per-floor
  map + consistency view (§7), read hook for consumers, diagnostics.
- **Later (v2+), not v1:**
  - **Starter templates** — one-click scaffolds that create several areas
    - connections at once (e.g. "apartment" → typical rooms + a `shared`
      hallway + a perimeter front door; "two-storey house" → ground and
      upper landing joined by an open stair). Deferred deliberately: high
      variant/maintenance cost and a real risk the template never matches
      the actual home. The two-axis connection presets and the `type`
      cascade cover everyday setup without it.
  - **House view** — the per-floor maps stacked into one "house" (§7).

## 6. Label projection & exit (Core interop)

topology is the **area-facing half** of the shared label-projection
policy; the full rule set lives in Residents' PLAN.md §5. One-way,
opt-in, integration-owned:

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
  `barrier` — door vs. open vs. solid wall, stair / lift marked). Ships the
  verification value cheaply; may start 2D and gain depth later.
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
