# Topology — Phase 4 Implementation Plan

**Status:** Implementation plan (frozen artifacts per PLAN-topology.md §10,
gate "Before Phase 4 (aggregates + derivations)") · Last updated 2026-07-24

**Scope:** Phase 4 (aggregates + derivations) only — the live/derived layer on
top of the Phase 1–3 foundation (store snapshot, `read_hook`/`health`, registry
watcher, the registry-merged `coordinator.derived` view, and the Phase-3 entity
set). Phase 4 turns three things on:

1. the **perimeter-open binary sensor** whose contract was frozen but left
   unimplemented in Phase 3 (D1 there);
2. the **four graph-consistency checks** that fill the `health` lists which
   have been present-but-empty since Phase 2;
3. the **adjacency-graph query surface** on the WebSocket API (neighbours of an
   area, path between two areas, connections facing outdoor).

Nothing from Phase 5+ is implemented here; later phases are referenced only
where Phase 4 must freeze an artifact for them, or where a boundary is drawn.
In particular the consistency **checks** are Phase 4, but the **repair issues**
that consume them are Phase 5, and no service action or panel work happens here.

**Binding inputs:** `PLAN-topology.md` (§1a perimeter entity, §2 interface
contract / adjacency reads, §7 consistency view, §10 gate "Before Phase 4"),
`PLAN-topology-phase2.md` (§2 store schema, §3 enum catalog, §4 WS contract
incl. §4.10 `read_hook`/§4.11 frozen `health` shape), `PLAN-topology-phase3.md`
(§3.2 frozen perimeter contract, §4 id scheme, §7 `TopologyDerived`),
`DECISIONS.md` (ADRs "Entity Model", "Registry-Driven State", "Coordinator
Role", "Release Strategy"), `AGENTS.md` (package rules, layering, validation
scripts). The real code on `main` after the Phase-3 merge
(`custom_components/topology/{data,store,websocket_api}.py`,
`entity_utils/derivations.py`, `coordinator/base.py`, `sensor/`,
`binary_sensor/`) is the fixed substrate every signature below is written
against.

**Definition of done for Phase 4:** a developer implements Phase 4 from this
document alone in ~4 working days without going back to the design plan;
`script/check`, `script/hassfest`, and `script/test` green with ≥ 95 %
coverage on new Phase-4 code; every artifact in §2–§6 implemented exactly as
frozen here; every open decision in §9 ratified before code is written. The
Phase-2 WS contract (`read_hook`, `health` shape, error codes) does not change
except by **adding** the new query commands and by **filling** the four
Phase-4 `health` lists — no field is removed or renamed.

**How this document must be used:** §9 is not optional reading. The design plan
deliberately stops above the code layer, and for two of the consistency checks
(especially `contradictory_bearings`) the frozen store model cannot represent
the literal example the design gives — this plan proposes a concrete,
implementable definition and **names the divergence** for ratification. Ratify
§9 first; the sections above already assume the recommended options.

---

## 1. Phase-4 delta table

Basis: the tree on `main` after the Phase-3 merge. "add" = new file, "extend" =
add to an existing file without changing frozen behavior, "refactor" = move
existing logic with no behavior change. No store field, enum, or existing WS
response field changes; the four `health` lists change from always-empty to
computed, which the frozen shape already allows (§4.11 of the Phase-2 plan).

| Path                            | Action      | What changes                                                                                                                                                                                                                        |
| ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `const.py`                      | **extend**  | Perimeter debounce constant, `EVENT`-free; the perimeter/consistency translation + issue keys already exist. Bound-sensor "open" state set. (§2, §9)                                                                                |
| `data.py`                       | **extend**  | `PerimeterConnection`, `Neighbor`, `ConsistencyReport`, `GraphView` frozen dataclasses (§5). `TopologyDerived` gains `perimeter`, `graph`, `consistency`. No Phase-1/2/3 dataclass changes.                                         |
| `entity_utils/derivations.py`   | **extend**  | Typed `derive_perimeter_connections`, `build_graph`, `neighbors`, `shortest_path`, `connections_facing_outdoor`, and `derive_consistency` (the four checks). `derive()` fills the new `TopologyDerived` fields. (§3, §4, §5)        |
| `entity_utils/graph.py`         | **add**     | Pure adjacency + BFS helpers backing the query surface and `isolated_areas` (§4). Kept out of `derivations.py` for size (AGENTS.md 200–400 lines/file).                                                                             |
| `websocket_api.py`              | **extend**  | `_build_health` fills the four lists from `coordinator.derived.consistency`; add read commands `topology/neighbors`, `topology/path`, `topology/connections_facing_outdoor` (§4). Error codes `area_not_found` reused; no removals. |
| `coordinator/base.py`           | **extend**  | `derive()` now also computes perimeter/graph/consistency; no new call site (still recomputed on every seed/publish). The perimeter binary sensor listens through the coordinator (§2.4).                                            |
| `binary_sensor/__init__.py`     | **rewrite** | Real platform setup: add the single `TopologyPerimeterBinarySensor`. Still `PARALLEL_UPDATES = 0`.                                                                                                                                  |
| `binary_sensor/perimeter.py`    | **add**     | `TopologyPerimeterBinarySensor` — live any-of aggregate over bound door/window sensors (§2).                                                                                                                                        |
| `translations/en.json`          | **keep**    | The `binary_sensor.perimeter_open` name + on/off states were frozen in Phase 3 (§5.1 there). No new entity key. New WS query commands need no translations.                                                                         |
| `icons.json`                    | **keep**    | `perimeter_open` icons were frozen in Phase 3. No change.                                                                                                                                                                           |
| `diagnostics.py` / `repairs.py` | **keep**    | Untouched. Diagnostics export is Phase 6; the repair issues that consume the four lists are Phase 5. Phase 4 only computes and exposes the lists.                                                                                   |
| `tests/`                        | **add**     | The Phase-4 test matrix (§7).                                                                                                                                                                                                       |
| `manifest.json`                 | **keep**    | No change. No version/tag/quality change (ADR "Release Strategy").                                                                                                                                                                  |

**Phase-4 DoD:** `binary_sensor.topology_perimeter_open` reflects live
door/window state with its frozen attribute contract; `topology/health`'s four
graph lists are populated; the three graph query commands answer; the read-hook
`perimeter` list is unchanged; `script/check` + `script/hassfest` +
`script/test` green.

---

## 2. Perimeter-open binary sensor

Implements the contract frozen in PLAN-topology-phase3.md §3.2. The id,
unique_id, `device_class`, translations, and icons are **already frozen** — this
section only adds the live derivation the "Before Phase 4" gate reserves.

### 2.1 Identity (unchanged from the Phase-3 freeze)

| Property                        | Value                                                               |
| ------------------------------- | ------------------------------------------------------------------- |
| Class                           | `TopologyPerimeterBinarySensor(TopologyEntity, BinarySensorEntity)` |
| entity_id                       | `binary_sensor.topology_perimeter_open`                             |
| unique_id                       | `perimeter_unique_id(entry_id)` == `f"{entry_id}_perimeter_open"`   |
| translation_key                 | `perimeter_open`                                                    |
| device_class                    | `BinarySensorDeviceClass.OPENING` (`on` = open)                     |
| entity_category                 | none (primary security hook)                                        |
| entity_registry_enabled_default | `True` (always on)                                                  |

Constructed like the house sensor (§4.3 of the Phase-3 plan): explicit
`entity_id` via `async_generate_entity_id(BINARY_SENSOR_ENTITY_ID_FORMAT,
perimeter_object_id(), hass=...)`, `has_entity_name` for the name.

### 2.2 Bound sensors

The set of tracked entities is every **non-orphaned** perimeter connection's
`sensor_entity_id` that is set (a `binary_sensor.*`), taken from
`coordinator.derived.perimeter` (§5). A perimeter connection with no bound
sensor contributes nothing to `is_on` (it cannot be observed) but is still a
perimeter member for the count in the house sensor (structural, Phase 3).

### 2.3 State semantics (frozen here — the "Before Phase 4" artifact)

- **`is_on`** = `True` iff **any** tracked bound sensor's current state is in the
  **open set** `{STATE_ON}` (D2). `off`, `unknown`, `unavailable`, and a missing
  state object all count as **not open** (D3 — the conservative-for-noise choice;
  see §9 for the security-fail-safe alternative).
- **Availability:** the entity is available whenever the coordinator has data
  (`coordinator.last_update_success`). It is **not** made unavailable when bound
  sensors are unavailable; instead the count of unobservable sensors is surfaced
  in an attribute (D4). With zero perimeter sensors the state is a steady `off`.
- **Debounce:** bound-sensor changes are coalesced through a
  `homeassistant.helpers.debounce.Debouncer` with `cooldown =
PERIMETER_DEBOUNCE_SECONDS` (default **0.0**, i.e. effectively immediate;
  frozen as a named constant so it can be raised without touching logic — D5),
  `immediate=True`. The debounce exists to collapse the burst of state-change
  events at HA startup / bulk sensor recovery into one state write.

### 2.4 Listener lifecycle (Silver `entity-event-setup`)

- In `async_added_to_hass`: subscribe to the current bound-sensor set via
  `async_track_state_change_event(hass, entity_ids, self._async_sensor_changed)`
  and store the unsubscribe with `self.async_on_remove(...)`. Also subscribe to
  the coordinator (base `CoordinatorEntity` already does) so the entity re-reads
  the perimeter set when the topology changes.
- The bound-sensor set can change when the store mutates (a connection gains or
  loses a `sensor_entity_id`). On each coordinator update the entity **diffs**
  the tracked set; if it changed, it tears down the old state-change
  subscription and re-subscribes to the new set (one helper,
  `_async_resubscribe`). This keeps the subscription exactly aligned with the
  derived perimeter without leaking listeners across reloads.
- All teardown is via `async_on_remove` / an explicit unsub kept on the entity,
  cleared in `async_will_remove_from_hass`.

### 2.5 Attribute contract (extends the Phase-3 freeze; deprecation-bound)

| Attribute             | Type         | Format                                                                                                                                                                                                                                                       |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `open_connections`    | `list[dict]` | One per **open** perimeter connection: `{"edge_id": str \| null, "area_id": str, "connection_index": int, "source_entity": str}` — the Phase-3-frozen shape (D6; supersedes the `area_a/area_b` sketch in PLAN-topology.md §1a). Empty when nothing is open. |
| `open_count`          | `int`        | `len(open_connections)`.                                                                                                                                                                                                                                     |
| `monitored_count`     | `int`        | Number of perimeter connections with a bound sensor being tracked.                                                                                                                                                                                           |
| `unavailable_sensors` | `list[str]`  | Bound sensor entity_ids currently `unavailable`/`unknown`/missing (so a consumer can tell "all closed" from "cannot see", D4).                                                                                                                               |

`open_connections` is sorted deterministically by `(edge_id or "", area_id,
connection_index)`.

---

## 3. Graph-consistency checks (the four `health` lists)

These fill the four lists frozen empty in the Phase-2 `health` shape (§4.11).
Each list holds **`area_id` strings** (D7), sorted, for non-orphaned registry
areas only. Computed once in `derive_consistency` (§5) and cached on
`coordinator.derived.consistency`; `topology/health` and `topology/read_hook`
serialize from there (single source, mirroring the Phase-3 `derive_house`/health
sharing).

### 3.1 `isolated_areas`

A non-orphaned registry area that is **not an endpoint of any non-orphaned
interior edge** (D8). Exterior connections do not count as connectivity (they
face outside, they do not join two areas). An area with zero edges is isolated;
one connected by even a `{none, solid}` edge is not (the edge records adjacency
regardless of traversability — traversability is a separate query concern, §4).

### 3.2 `indoor_areas_without_floor`

A non-orphaned registry area whose `environment == indoor` **and** whose
registry `AreaEntry.floor_id is None` (D9). Areas with `environment` `outdoor`,
`semi_outdoor`, or **unset** (`null`) are excluded — the design explicitly
allows outdoor areas to have no floor, and an unannotated environment is
"unknown", never assumed indoor (PLAN-topology.md §1).

### 3.3 `contradictory_bearings`

**Divergence from the design plan, ratify in §9 (D10).** The design's example
"A north of B and B north of A" cannot arise in the frozen store: there is one
edge per unordered area pair (§2.2 of the Phase-2 plan) and a connection carries
a single `side`, so opposite bearings are never stored twice. The
implementable v1 contradiction over the frozen model is a **side used for two
incompatible purposes on the same area**: an area that has, on the **same
cardinal side**, both an interior edge connection (`connection.side == X` on an
edge touching the area) **and** a `beyond[X]` outer-wall class. A wall side is
either interior (borders your own area) or exterior (`beyond`) — never both.
The list holds the offending `area_id`s. (The literal cross-area bearing
contradiction is revisited only if a future model stores per-area bearings.)

### 3.4 `exterior_on_non_outdoor_side`

A non-orphaned registry area that has an `exterior_connection` whose `side` is
set and whose `beyond[side] != outdoor` — i.e. a window/outside door placed on a
side that is not open air (D11). Exterior connections **without** a `side` are
skipped (nothing to check). This is the health-signal twin of the panel's
window-placement constraint (PLAN-topology.md §1); it is surfaced, never
hard-rejected at write time (that was decided in §4.7 of the Phase-2 plan).

### 3.5 `status`

Unchanged: `warning` iff any `health` list (Phase-2 lists **or** these four) is
non-empty, else `ok`. The four lists moving from always-empty to computed is
the only behavior change, and it is exactly what the frozen shape reserved.

---

## 4. Adjacency-graph query surface

Three new **read** WebSocket commands (authenticated, any user — same auth model
as `read_hook`/`health`, no admin gate). They pin the query surface the design's
"Before Phase 4" gate names ("neighbours of X, path between X and Y, all
connections carrying outdoor on one side"). All resolve the singleton entry and
fail with `not_loaded` when none is set up. Orphaned edges/areas are excluded
from every result (D12). Registration joins the existing list in
`async_register_websocket_api`.

### 4.1 `topology/neighbors` — read

- Payload: `{ "type": "topology/neighbors", "area_id": str }`
- Response:

```json
{
  "area_id": "flur",
  "neighbors": [
    {
      "area_id": "wohnzimmer",
      "edge_id": "flur::wohnzimmer",
      "axis": "horizontal | vertical | unknown",
      "is_perimeter": true,
      "traversable": true
    }
  ]
}
```

- `traversable` = any connection on the edge has `passage != none` (D13).
- `axis`/`is_perimeter` are the already-frozen `edge_out` derivations (§4 of the
  Phase-2 plan), reused verbatim.
- Errors: `not_loaded`, `area_not_found` (area_id not in the registry).

### 4.2 `topology/path` — read

- Payload: `{ "type": "topology/path", "from": str, "to": str, "traversable_only"?: bool }`
- Response:

```json
{ "from": "flur", "to": "dach", "path": ["flur", "treppe", "dach"], "hops": 2 }
```

- Shortest hop path by BFS over non-orphaned interior edges. When
  `traversable_only` is `true` (default `false`, D14) only edges with a
  traversable connection are walked. `path` is `null` and `hops` is `-1` when no
  path exists (or `from == to` returns `path: [from], hops: 0`).
- Errors: `not_loaded`, `area_not_found` (either endpoint).

### 4.3 `topology/connections_facing_outdoor` — read

- Payload: `{ "type": "topology/connections_facing_outdoor" }`
- Response: `{ "connections": [ ... ] }`, each entry:

```json
{
  "source": "exterior | edge",
  "area_id": "wohnzimmer",
  "edge_id": "flur::garten | null",
  "connection_index": 0,
  "side": "S | null",
  "passage": "none",
  "barrier": "door",
  "glazed": true,
  "sensor_entity_id": "binary_sensor.x | null"
}
```

- Included connections (D15): an **exterior** connection **only when** its
  `side` is set and the area's `beyond[side] == outdoor` — i.e. a proven
  open-air opening. Exterior connections on a `neighbor`/`earth` side, or with
  **no `side`** (open-air unprovable), are **excluded** (they are what the
  `exterior_on_non_outdoor_side` check flags, §3.4). Plus every **interior
  edge** connection where exactly one endpoint area has `environment ==
outdoor` (an opening onto a modelled outdoor area, e.g. a terrace door) —
  interior edges are not `beyond`-filtered because they border a real area, not
  an outer wall. Orphaned entries excluded.
- Every entry carries `passage` + `barrier` so a consumer can tell a
  `{none, solid}` wall from an openable door/window **without** re-joining
  `read_hook` by `edge_id`/`connection_index` (this is the point of the query);
  `glazed` and `sensor_entity_id` are included for the solar / perimeter uses.
- Purpose: the west-facing-covers / passive-solar / ventilation blueprints
  (PLAN-topology.md §9) select on this without re-deriving the graph.
- Errors: `not_loaded`.

### 4.4 What is deliberately not added

No write commands (this phase is read-only derivations). No path with edge
weights / distances (hop count + the existing per-edge `axis` cover the design's
"floor-difference distance"; metric geometry is explicitly out, PLAN-topology.md
§1). No neighbours-of-neighbours / subgraph export — consumers compose
`neighbors`/`path`, or read the full graph from `read_hook`.

---

## 5. What the coordinator/derived must additionally expose

Entities and query handlers must not read the registry directly (AGENTS.md
layering). Phase 4 extends the Phase-3 `TopologyDerived` so the perimeter binary
sensor, the health signal, and the query commands all read one cached
projection.

### 5.1 New dataclasses in `data.py`

```python
@dataclass(frozen=True, kw_only=True, slots=True)
class PerimeterConnection:
    """A derived perimeter connection with its bound sensor (§2, §4.10)."""
    source: str                 # "edge" | "exterior"
    edge_id: str | None
    area_id: str
    connection_index: int
    sensor_entity_id: str | None

@dataclass(frozen=True, kw_only=True, slots=True)
class Neighbor:
    area_id: str
    edge_id: str
    axis: str                   # "horizontal" | "vertical" | "unknown"
    is_perimeter: bool
    traversable: bool

@dataclass(frozen=True, kw_only=True, slots=True)
class GraphView:
    """Adjacency over non-orphaned interior edges (§4)."""
    adjacency: dict[str, tuple[Neighbor, ...]]   # area_id -> neighbours

@dataclass(frozen=True, kw_only=True, slots=True)
class ConsistencyReport:
    """The four Phase-4 graph-consistency lists (§3)."""
    isolated_areas: tuple[str, ...]
    indoor_areas_without_floor: tuple[str, ...]
    contradictory_bearings: tuple[str, ...]
    exterior_on_non_outdoor_side: tuple[str, ...]
```

`TopologyDerived` gains three fields (additive; Phase-1/2/3 fields unchanged):

```python
    perimeter: tuple[PerimeterConnection, ...]
    graph: GraphView
    consistency: ConsistencyReport
```

### 5.2 New functions in `entity_utils/derivations.py` + `entity_utils/graph.py`

```python
# derivations.py
def derive_perimeter_connections(snapshot, area_reg) -> tuple[PerimeterConnection, ...]: ...
def derive_consistency(snapshot, area_reg) -> ConsistencyReport: ...
def connections_facing_outdoor(snapshot, area_reg) -> list[dict[str, Any]]: ...

# graph.py
def build_graph(snapshot, area_reg, floor_reg, overrides) -> GraphView: ...
def neighbors(graph, area_id) -> tuple[Neighbor, ...]: ...
def shortest_path(graph, src, dst, *, traversable_only: bool) -> list[str] | None: ...
```

`derive_perimeter_connections` is the typed twin of the existing dict-returning
`derive_perimeter` (§7.2 of the Phase-3 plan) — the dict form stays for the
frozen `read_hook.perimeter` bytes (D16); the typed form feeds the binary sensor
and the `open_connections`/`connections_facing_outdoor` builders. Both share one
private core so they cannot diverge.

`derive()` composes all of them and returns the extended `TopologyDerived`; the
coordinator caches it exactly as today (no new call site, §7.3 of the Phase-3
plan). Registry reads stay inside `derive()` (it already receives `hass`).

### 5.3 WS/health wiring

`_build_health` reads the four lists from `coordinator.derived.consistency`
instead of returning `[]`; the rest of its shape is unchanged, so the frozen
`health` contract and every Phase-2 health test still hold except the four lists
now populate. The query handlers read `coordinator.derived.graph` /
`coordinator.derived.perimeter` — no registry access in the handler bodies
beyond the `area_not_found` existence check (which already uses `ar.async_get`).

---

## 6. Boundaries: Phase 5+ and what stays put

| Item                                                                                                                | Owner phase | Phase 4 stance                                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------- |
| Repair issues for the four checks (contradictory-bearings, exterior-on-non-outdoor, isolated, indoor-without-floor) | Phase 5     | **Not raised.** Phase 4 only computes the lists into `health`; `async_create_issue` for them is Phase 5. |
| Unannotated-threshold repair                                                                                        | Phase 5     | Not raised (already surfaced as a house attribute in Phase 3).                                           |
| Services (`annotate_area`, `declare_connection`, imports), diagnostics export                                       | Phase 6     | `diagnostics.py` stays the `{}` stub; `service_actions/` untouched.                                      |
| Panel / 2D map                                                                                                      | Phase 7     | Nothing frontend. The query commands are backend-only; the panel consumes them later.                    |
| v3 quiet-grading propagation, solar/`glazed` reasoning                                                              | v3          | Not modeled. `connections_facing_outdoor` + `glazed` are exposed as the seed only.                       |
| Metric geometry, edge weights, per-area bearings                                                                    | —           | Out of scope by design (PLAN-topology.md §1/§7).                                                         |

Phase 4 adds **no** new store field, **no** new enum, **no** write command, **no**
manifest/version/tag change. The only WS-contract change is additive (three read
commands) plus filling the four already-frozen `health` lists.

---

## 7. Test matrix (Phase 4)

Style per §9 of the Phase-3 plan: IDs + fixtures, no bodies. New fixtures in
`tests/conftest.py`: `door_sensor`/`window_sensor` (helpers that set
`binary_sensor.*` states via `hass.states.async_set`), `perimeter_payload` (a
store payload with a bound sensor on the apartment door and a trust-delta
edge). Reuses `area_registry`, `two_floor_registry`, `enable_all`,
`store_payload_full`, `load_payload`, `hass_ws_client`. ≥ 95 % on new code.

### Perimeter-open binary sensor

| ID                                          | Purpose                                                                                                 | Fixtures                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `test_perimeter_entity_identity`            | `binary_sensor.topology_perimeter_open`; unique_id `{entry_id}_perimeter_open`; device_class opening.   | setup_integration, area_registry                     |
| `test_perimeter_off_when_no_sensors`        | No bound sensors → steady `off`, `open_count 0`, `monitored_count 0`.                                   | setup_integration, area_registry                     |
| `test_perimeter_on_when_bound_sensor_on`    | A bound door sensor `on` → entity `on`; `open_connections` lists it with `source_entity`.               | setup_integration, area_registry, perimeter_payload  |
| `test_perimeter_off_when_all_closed`        | All bound sensors `off` → entity `off`, empty `open_connections`.                                       | setup_integration, perimeter_payload                 |
| `test_perimeter_unavailable_sensor_ignored` | A bound sensor `unavailable`/`unknown` counts as not-open and appears in `unavailable_sensors` (D3/D4). | setup_integration, perimeter_payload                 |
| `test_perimeter_tracks_new_binding`         | Adding a `sensor_entity_id` to a perimeter connection re-subscribes; its state now drives `is_on`.      | setup_integration, perimeter_payload, hass_ws_client |
| `test_perimeter_untrack_removed_binding`    | Removing a binding tears down the old listener (no state leakage after the sensor changes).             | setup_integration, perimeter_payload                 |
| `test_perimeter_orphaned_excluded`          | A perimeter connection on an orphaned area/edge is not tracked and not in `open_connections`.           | setup_integration, area_registry, perimeter_payload  |
| `test_perimeter_debounce_coalesces`         | Two rapid bound-sensor changes yield one state write (Debouncer, D5).                                   | setup_integration, perimeter_payload                 |
| `test_perimeter_enabled_by_default`         | Registered enabled; single instance.                                                                    | setup_integration, area_registry                     |

### Graph-consistency checks

| ID                                         | Purpose                                                                                            | Fixtures                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `test_consistency_all_clear`               | Fully wired §2.5 home → all four lists empty, `status ok`.                                         | setup_integration, store_payload_full, area_registry, floor_registry |
| `test_isolated_area_listed`                | A registry area with no edge → in `isolated_areas`, `status warning`.                              | setup_integration, area_registry                                     |
| `test_isolated_ignores_exterior_only`      | An area with only exterior connections (no edge) is still isolated (D8).                           | setup_integration, area_registry, perimeter_payload                  |
| `test_indoor_without_floor_listed`         | An indoor area with `floor_id None` listed; an outdoor floorless area is not (D9).                 | setup_integration, area_registry                                     |
| `test_indoor_without_floor_null_env_skip`  | An unannotated-environment floorless area is not listed (null ≠ indoor).                           | setup_integration, area_registry                                     |
| `test_contradictory_bearing_same_side`     | An area with an edge connection on side N and `beyond[N]` set → in `contradictory_bearings` (D10). | setup_integration, area_registry                                     |
| `test_exterior_on_non_outdoor_side_listed` | An exterior connection on a side whose `beyond` is `neighbor` → listed (D11).                      | setup_integration, area_registry                                     |
| `test_exterior_without_side_skipped`       | An exterior connection with no `side` is not flagged.                                              | setup_integration, area_registry                                     |
| `test_health_lists_match_derived`          | `topology/health` lists equal `coordinator.derived.consistency` (single source, §5.3).             | setup_integration, hass_ws_client                                    |
| `test_read_hook_health_lists_filled`       | `read_hook.health` carries the same four lists (not empty when a defect exists).                   | setup_integration, hass_ws_client                                    |

### Adjacency-graph query surface

| ID                                   | Purpose                                                                                           | Fixtures                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `test_ws_neighbors`                  | Returns adjacent areas with `edge_id`/`axis`/`is_perimeter`/`traversable`.                        | setup_integration, store_payload_full, load_payload, hass_ws_client |
| `test_ws_neighbors_unknown_area`     | Unknown `area_id` → `area_not_found`.                                                             | setup_integration, hass_ws_client                                   |
| `test_ws_path_found`                 | Shortest hop path across the §2.5 flat; `hops` correct.                                           | setup_integration, store_payload_full, load_payload, hass_ws_client |
| `test_ws_path_none`                  | Disconnected areas → `path: null`, `hops: -1`; `from == to` → `hops 0`.                           | setup_integration, area_registry, hass_ws_client                    |
| `test_ws_path_traversable_only`      | A `{none, solid}`-only edge is walked normally but skipped when `traversable_only` (D13/D14).     | setup_integration, area_registry, hass_ws_client                    |
| `test_ws_connections_facing_outdoor` | Exterior connections + an edge onto an `outdoor` area are returned; interior-only excluded (D15). | setup_integration, area_registry, hass_ws_client                    |
| `test_ws_query_not_loaded`           | All three query commands before setup → `not_loaded`.                                             | hass, hass_ws_client                                                |
| `test_ws_query_excludes_orphans`     | Orphaned edges/areas absent from neighbours/path/outdoor results (D12).                           | setup_integration, area_registry, hass_ws_client                    |

(~28 tests. No bodies here — Phase-4 implementation writes them.)

---

## 8. Umsetzungs-DAG (cluster ordering)

```mermaid
graph TD
    A1[a1: const.py — debounce + open-state constants] --> B1[b1: data.py — PerimeterConnection/Neighbor/GraphView/ConsistencyReport + TopologyDerived fields]
    B1 --> C1[c1: entity_utils/graph.py — build_graph/neighbors/shortest_path]
    B1 --> C2[c2: derivations.py — perimeter_connections/consistency/facing_outdoor + derive() wiring]
    C1 --> C2
    C2 --> D1[d1: coordinator.derived carries perimeter/graph/consistency]
    D1 --> E1[e1: binary_sensor/perimeter.py — live any-of + debounce + resubscribe]
    E1 --> E2[e2: binary_sensor/__init__.py — platform setup]
    C2 --> F1[f1: websocket_api — fill health lists]
    C1 --> F2[f2: websocket_api — neighbors/path/connections_facing_outdoor]
    D1 --> T1[t1: tests — perimeter sensor]
    C2 --> T2[t2: tests — consistency checks]
    F2 --> T3[t3: tests — query commands]
    E2 --> T1
    F1 --> T2
    T1 --> Z[Phase-4 DoD: check + hassfest + test green, coverage >= 95%]
    T2 --> Z
    T3 --> Z
```

Practical sequencing (~4 days): day 1 = a + b + c (the derivations + graph, the
keystone) with t2 alongside; day 2 = d + e (perimeter sensor) with t1; day 3 =
f (health fill + query commands) with t3; day 4 = coverage, hassfest/lint loop,
edge cases (orphans, debounce, resubscribe). Parallelization: the query commands
(f2) depend only on c1 and can be done alongside the binary sensor (e).

---

## 9. Decision protocol (D1–D16)

Every place the design leaves room, or where this plan diverges from it, with a
recommended, minimal-invasive option. **Ratify before Phase-4 code is written.**
The sections above assume the recommended option.

| #   | Question / gap                                              | Recommended option                                                                                                                                                                                                                                                                     | Note / contradiction                                                                                                                              |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Does Phase 4 own the perimeter binary sensor?               | **Yes** — implement the contract Phase 3 froze (§2).                                                                                                                                                                                                                                   | Closes the Phase-3 D1 deferral.                                                                                                                   |
| D2  | "Open" state set for a bound sensor                         | `is_on` counts a sensor open only when its state is exactly `on`.                                                                                                                                                                                                                      | Matches `device_class: opening` semantics (on = open).                                                                                            |
| D3  | Unavailable/unknown bound sensor → open or closed?          | Treat as **not open** (does not force the aggregate on).                                                                                                                                                                                                                               | **Security-fail-safe alternative:** treat unknown as open. Recommend not, but flag — a maintainer running an alarm may prefer fail-safe.          |
| D4  | Surface unobservable sensors                                | Add `unavailable_sensors` + `monitored_count` attributes; entity stays available.                                                                                                                                                                                                      | Lets a consumer distinguish "all closed" from "blind".                                                                                            |
| D5  | Debounce interval                                           | `PERIMETER_DEBOUNCE_SECONDS = 0.0` (immediate), via `Debouncer(immediate=True)`, as a named constant.                                                                                                                                                                                  | Raise later without logic change if startup churn is noisy.                                                                                       |
| D6  | `open_connections` entry shape                              | Keep the Phase-3-frozen `{edge_id, area_id, connection_index, source_entity}`.                                                                                                                                                                                                         | **Supersedes** PLAN-topology.md §1a's `{edge_id, area_a, area_b, source_entity}` sketch.                                                          |
| D7  | Type of the four consistency-list items                     | `area_id` strings, sorted.                                                                                                                                                                                                                                                             | Matches the frozen `health` `items: string`.                                                                                                      |
| D8  | `isolated_areas` — do exterior connections count?           | **No** — only non-orphaned interior edges provide connectivity.                                                                                                                                                                                                                        | Exterior openings face outside, not another area.                                                                                                 |
| D9  | `indoor_areas_without_floor` scope                          | `environment == indoor` and registry `floor_id is None`; exclude outdoor/semi_outdoor/`null`.                                                                                                                                                                                          | Design allows outdoor floorless; null ≠ indoor.                                                                                                   |
| D10 | `contradictory_bearings` definition                         | Same-side interior-edge **and** `beyond` on one area (§3.3).                                                                                                                                                                                                                           | **Divergence from the design's literal "A north of B / B north of A"**, which the single-edge store cannot represent. Ratify or redefine.         |
| D11 | `exterior_on_non_outdoor_side` scope                        | Exterior connection with `side` set and `beyond[side] != outdoor`; skip side-less exterior connections.                                                                                                                                                                                | Health twin of the panel window constraint; never a write-time reject.                                                                            |
| D12 | Orphaned entries in query results                           | Excluded from neighbours/path/outdoor (present only in `read_hook` with `orphaned_at`).                                                                                                                                                                                                | Consistent with `derive_perimeter`.                                                                                                               |
| D13 | `traversable` definition                                    | Any connection on the edge with `passage != none`.                                                                                                                                                                                                                                     | Drives `neighbors.traversable` and `path(traversable_only)`.                                                                                      |
| D14 | `topology/path` default over traversable-only?              | Default `false` (walk all adjacency, incl. `{none, solid}`); opt in to `traversable_only`.                                                                                                                                                                                             | Adjacency ≠ walkability; consumers choose.                                                                                                        |
| D15 | `connections_facing_outdoor` membership + shape             | Exterior connections **only** where `side` is set and `beyond[side] == outdoor` (side-less / `neighbor` / `earth` excluded), plus interior edges with exactly one `environment == outdoor` endpoint. Each entry includes `passage` + `barrier` (+ `side`/`glazed`/`sensor_entity_id`). | Tightened per PR review: only proven open-air openings, and consumers tell a `{none, solid}` wall from an opening without re-joining `read_hook`. |
| D16 | Keep the dict-returning `derive_perimeter` for `read_hook`? | **Yes** — add a typed `derive_perimeter_connections` sharing one core; the dict form keeps `read_hook.perimeter` byte-stable.                                                                                                                                                          | No frozen-contract change.                                                                                                                        |

**Explicit contradiction to ratify:** D10 (`contradictory_bearings` cannot match
the design's literal example under the frozen single-edge model — this plan
proposes the same-side interior/exterior conflict instead). Everything else
fills a gap the design left open.

---

## Appendix A — HA 2026.4.4 signature verification

Signatures verified against the installed test target (`homeassistant`
**2026.4.4**, pinned via `pytest-homeassistant-custom-component==0.13.325`,
Python 3.14.6) by introspection, not guessed. These supplement the Phase-2/3
appendices.

- `homeassistant.helpers.event.async_track_state_change_event(hass, entity_ids: str | Iterable[str], action: Callable[[Event[EventStateChangedData]], Any], job_type=None) -> CALLBACK_TYPE` — the bound-sensor subscription (§2.4). Returns an unsub callback.
- `EventStateChangedData` = `{entity_id: str, new_state: State | None, old_state: State | None}` — the callback payload.
- `homeassistant.helpers.debounce.Debouncer(hass, logger, *, cooldown: float, immediate: bool, function=None, background=False)` — the state-write coalescer (§2.3). `async_call()` schedules; `async_shutdown()` on remove.
- `homeassistant.helpers.event.async_call_later(hass, delay: float | timedelta, action) -> CALLBACK_TYPE` — available as a debounce alternative if the maintainer prefers no `Debouncer`.
- `homeassistant.const`: `STATE_ON = "on"`, `STATE_OFF = "off"`, `STATE_UNAVAILABLE = "unavailable"`, `STATE_UNKNOWN = "unknown"` — the open-state comparison set (§2.3, D2/D3).
- `homeassistant.components.binary_sensor.BinarySensorEntity` / `BinarySensorDeviceClass.OPENING = "opening"` / `ENTITY_ID_FORMAT` — verified in the Phase-3 appendix (A.3), reused here for the entity.
- `homeassistant.helpers.area_registry.AreaEntry.floor_id: str | None` and `async_list_areas()` / `async_get_area()` — the `indoor_areas_without_floor` and existence checks (Phase-2 appendix A.2).
- `homeassistant.helpers.entity.async_generate_entity_id(entity_id_format, name, current_ids=None, hass=None)` — explicit entity_id (Phase-3 appendix A.4).
