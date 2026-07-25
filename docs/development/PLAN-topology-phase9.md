# Phase 9 — Physical-model completion: spans, remote edges, envelope, perimeter components, native automation surface

**Status:** Implementation plan. All product decisions (D-A … D-O below) ratified by the maintainer on
2026-07-25 after a structured Q&A over `.ai-scratch/findings.md` (34 field findings from the dev
instance). Executed as **one coherent change set** ("ein großer Wurf") on a single branch — the
maintainer explicitly chose no intermediate milestones. **No migrations of any kind** (ratified
2026-07-25): the project is pre-release with a single disposable dev instance — schema and contracts
evolve freely, and existing legacy migration code is removed rather than extended.

**Relationship to Phase 8:** Phase 8 (release) stays the _last_ phase; its still-open items — G1
(brands PR), G8 (install docs → default store), G9/G10 (master-plan/ADR hygiene), G11 (dead shims),
release-please merge → `v1.0.0`, HACS default-store PR — are untouched here and run after Phase 9.
Phase 9 **amends the Phase-8 scope fence** in three rows:

| Phase-8 fence row                                                                 | Phase-9 stance                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "No new entity, attribute, WS command, enum, service, store field, or derivation" | Superseded by this phase (ratified 2026-07-25).                                            |
| "Uninstall-time projected-label purge — out, post-1.0"                            | Pulled in: `async_remove_entry` now purges owned labels, the store file, and issues (D-I). |
| "Non-English translations — out, post-1.0"                                        | Pulled in: German ships with this phase (D-M).                                             |

Zones (`zone.home`, proximity) were considered and **rejected for Topology** — they are a
Residents-side concern; Topology only guarantees clean read surfaces (D-decision recorded here so it
is not re-litigated).

---

## 1. Findings → decisions map

| Decision                        | Resolves findings | Summary                                                                                                                                                                                                                                                                           |
| ------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-A Level authority             | 1, 28             | Our store level is authoritative; HA registry `floor.level` is only the seed suggestion. Document the `level_delta` sign convention in the read contract.                                                                                                                         |
| D-B Level spans                 | 3, 9, 10, 20, 24  | An area may declare a level span (e.g. −1..2) in our store, independent of HA's single `floor_id`. Solves stairwells, multi-stairwell homes, "garden belongs to the ground floor".                                                                                                |
| D-C Remote edges                | 2, 11             | Edge `kind: direct \| remote`. Remote = traversable route through unmodeled space; no shared-structure claims; never merges perimeter components.                                                                                                                                 |
| D-D Envelope from environment   | 13, 18, 26        | Whether a connection is part of the building envelope is derived from the two areas' environments (indoor↔outdoor / indoor↔semi_outdoor). Preset `scope` becomes a UI preselection, not a hard filter. New presets `garage_door`, `gate`. `glazed` only offered where meaningful. |
| D-E Reachability                | 8                 | Optional per-connection `reachable` (from outside). Default derived from level (min level ≤ 0 → reachable; unknown → reachable, conservative for alarms).                                                                                                                         |
| D-F Perimeter components        | 19                | Perimeter groups derived as connected components of the indoor graph over direct edges. One binary sensor per component + the existing aggregate.                                                                                                                                 |
| D-G Exclusion marking           | 11, 25            | Per-area `excluded` flag: no health check counts it, house coverage excludes it, panel dims it. One deliberate decision → zero repair cards.                                                                                                                                      |
| D-H Trigger/condition platforms | 21, 33            | `trigger.py` + `condition.py` (HA 2026.x class-based platform API) so Topology appears natively in the automation editor. New target types are core-frontend-only and remain impossible — documented, not attempted.                                                              |
| D-I Lifecycle cleanup           | 7, 30             | Entity-registry rows removed when purged; `async_remove_entry` (store file, owned labels, issues); demo binary sensors in the dev config.                                                                                                                                         |
| D-J Type catalog                | 14, 16            | `stairway, entrance, driveway, garden, laundry, cellar, attic, carport, workshop` + cascade entries. UI copy repositions `type` as the functional classification consumers query.                                                                                                 |
| D-K Vertical beyond             | 12                | `beyond` gains `down`/`up` sides (earth below, sky above) — always explicit, with one-click suggestions for `whole_property` homes.                                                                                                                                               |
| D-L elkjs layout                | 5, 15, 17, 18, 27 | ELK layered layout: floors as partitions, crossing minimization, orthogonal border-anchored edges, variable node sizes, outdoor band adjacent to the ground floor.                                                                                                                |
| D-M German i18n                 | 6                 | `frontend/src/i18n/de.ts` + `translations/de.json`; `localize()` bound to `hass.language`, `en` fallback.                                                                                                                                                                         |
| D-N UX explanation              | 1                 | Panel copy explaining the deliberate duplication: HA order/level = display, Topology = physics.                                                                                                                                                                                   |
| D-O Contract/test hygiene       | 28, 31, 32        | Sign-convention docs; `live()` `<select>` first-render test convention for every new select; `from_area`/`to_area` stays.                                                                                                                                                         |

Findings 23, 29, 34 were already resolved before this plan; finding 22 → Residents.

---

## 2. Store & data model (`data.py`, `store.py`, `const.py`)

**No migrations, no version ceremony** (maintainer decision: pre-release, dev instance is reset
rather than migrated). Schema fields are added freely; `STORAGE_VERSION`/`STORAGE_VERSION_MINOR` and
the config-entry version stay untouched. **Legacy removal:** `__init__.py::async_migrate_entry`
(entry 1.1 → 1.2, `LEGACY_CONF_KEYS` relocation) and its `test_migration.py` coverage are deleted —
they only accommodated past breaking changes. The `StoreFutureVersionError` guard stays (a safety
net with its own repair issue, not migration code). `read_hook_payload` **`api_version` stays 1**
(changes happen to be additive; policy recorded as a `read_contract.py` docstring).

- New enums: `EdgeKind(direct|remote)`, `VerticalSide(down|up)`; `type BeyondSide = CardinalSide | VerticalSide`
  (beyond keys only — `Connection.side` stays cardinal; skylights are out of scope, see Risks R7).
- `ConnectionPreset` + `CONNECTION_PRESETS`: `garage_door` (level/door, sensor_allowed, scope exterior),
  `gate` (level/door, sensor_allowed, scope interior).
- `AREA_TYPE_CATALOG` + `TYPE_CASCADE`: `stairway` (indoor/shared), `entrance` (indoor/shared),
  `driveway` (outdoor/–), `garden` (outdoor/–), `laundry`/`cellar`/`attic`/`workshop` (indoor/private),
  `carport` (semi_outdoor/–).
- Fields: `ConnectionDict.reachable?: bool` (absent = derive); `EdgeDict.kind?` (unknown → `DIRECT` +
  `UnknownEnumValue`; key emitted only when remote); `AreaAnnotationDict.level_span?: {from_level, to_level}`
  (normalized min/max on parse) and `excluded?: bool`; `FloorOverride.level_override` becomes semantically
  authoritative (docstring only).
- Dataclasses: `Connection.reachable`, `Edge.kind`, `AreaAnnotation.level_span/.excluded`,
  `AreaProjection.excluded`, `PerimeterConnection.reachable/.component_id`, new
  `PerimeterComponent(component_id, anchor_area_id, area_ids, connection_count, monitored_count)`,
  `TopologyDerived.perimeter_components`, `HouseProjection.excluded_count`.
- `store.py`: `async_update_area` accepts `excluded`/`level_span` (updates type widens to
  `Mapping[str, Any]`); `async_upsert_edge(kind=...)`.

## 3. Derivations (`entity_utils/derivations.py`, `entity_utils/graph.py`)

- **D-A:** flip precedence in `effective_level` — store override wins, registry level is the fallback.
- **D-B:** new `effective_span(...)` (annotation span > effective level > None) and
  `derive_spans(snapshot, ...)` computed once per derive pass, threaded everywhere levels are used.
- **`graph.edge_levels(edge, spans)`** becomes span-aware: span overlap → `("horizontal", 0)`; otherwise
  delta = gap between the nearest touching levels. Sign convention unchanged and now documented:
  positive = `area_b` (the lexicographically larger id) lies above; `neighbors[].level_delta` is already
  re-signed relative to the queried area. Callers: `build_graph`, `_derive_edge_geometry`,
  `read_contract.edge_out`, `websocket_api`.
- **D-C:** `Neighbor.kind`; remote edges traversable in path queries; excluded from
  `edges_spanning_multiple_floors`, `vertical_edges_without_vertical_passage`, and the bearings check;
  they still satisfy `isolated_areas` (a route is a route).
- **D-D:** `is_envelope_edge(edge, env_map)` = env pair {indoor, outdoor} or {indoor, semi_outdoor} and
  `kind == direct`. `is_perimeter_edge` = trust delta **or** envelope **or** `perimeter_override`.
  Envelope owner with equal/unknown trust: the non-outdoor endpoint, fallback `area_a`.
- **D-E:** `default_reachable(owner, spans)` = min level ≤ 0; unresolvable → `True`. Effective value
  applied in `_iter_perimeter` and `connections_facing_outdoor`.
- **D-F:** `graph.perimeter_components(...)` — union-find over live, non-excluded, non-orphaned indoor
  areas joined by non-orphaned **direct** edges. `component_id = anchor = lexicographically smallest
area_id` (deterministic; rename-on-new-smaller-anchor accepted, see R2). Exterior entries attach to
  the owning area's component, else `None` (aggregate-only).
- **D-G:** `excluded_ids` as a single choke point: `annotation_counts` (coverage %, `excluded_count`),
  `derive_consistency`, `build_graph`, `_iter_perimeter` all filter; `indoor_areas_without_floor` does
  not flag an area with a `level_span`.

## 4. API surface

- **`read_contract.py`:** `area_out += excluded, level_span`; `edge_out += kind, is_envelope` (+ sign
  convention docstring); `perimeter_payload += reachable, component_id, components[], reachable_count,
monitored_reachable_count`; `neighbors_payload += kind`; `serialize_floors` with the new precedence
  (shape unchanged — the panel needs all three level fields for the D-N copy);
  `list_annotations_payload += perimeter_components`.
- **`websocket_api.py`:** `_CONNECTION_SCHEMA += reachable`; `update_area += excluded, level_span`
  (from ≤ to normalized, not rejected); `upsert_edge += kind` with remote validation (no `side`, no
  `shared_wall`/`ceiling`, no `barrier: solid` → `ERR_INVALID_CONNECTION`); `set_beyond` side domain
  gains `up`/`down`.
- **Services:** `annotate_area += excluded, from_level/to_level (vol.Inclusive), clear_level_span`;
  `declare_connection += kind, reachable` (remote validation mirrored in `validation.py`);
  `set_beyond` + up/down selector options; `get_perimeter += reachable_only` + components in the
  response. `services.yaml` + `translations/en.json` updated for every new field.

## 5. Entities & lifecycle

- **Per-component perimeter sensors:** extract the tracking/debounce core from
  `binary_sensor/perimeter.py` into a shared base; new `binary_sensor/perimeter_component.py` filters
  `derived.perimeter` by `component_id`. unique*id `{entry_id}\_perimeter*{component*id}`, object_id
`topology_perimeter*{anchor_slug}`, name via translation key + placeholder. Dynamic add/remove in
`binary_sensor/**init**.py`(mirror the`sensor/**init**.py`listener; vanished components:`async_remove()`+ registry row removal). Attributes include`reachable_open_count`,
`reachable_monitored_count`. The aggregate `binary_sensor.topology_perimeter_open`stays
(+`components`, `reachable_open_count`).
- **House sensor:** coverage % excludes excluded areas (falls out of `annotation_counts`);
  - `excluded_count` attribute.
- **Cleanup (D-I):** new `entity_utils/cleanup.py::async_remove_area_entities` — on purge
  (registry watcher + repair flow) remove the three per-area diagnostic sensor registry rows.
  `__init__.py::async_remove_entry`: delete the store file (public `TopologyStore.async_remove()`),
  strip owned `topology:*` labels (`label_projection.async_remove_owned_labels`), delete every issue in
  a new `const.ALL_ISSUE_IDS`.
- **Dev config:** three `input_boolean` + `template` binary sensors (door/garage_door device classes)
  in `config/configuration.yaml` so perimeter blueprints and the new triggers are testable end-to-end
  (finding 30).

## 6. Trigger & condition platforms (D-H)

New `trigger.py` + `triggers.yaml`, `condition.py` + `conditions.yaml`; translations under top-level
`triggers`/`conditions` keys in `en.json`/`de.json` (structure per core `sun`). Class-based API
verified against HA 2026.7.4: `Trigger` subclasses with `async_validate_config` /
`async_attach_runner`, exported via `TRIGGERS` + `async_get_triggers`; `Condition` analogous.

- Triggers: `perimeter_opened` / `perimeter_closed` (entity selector over topology binary sensors,
  default = aggregate; `reachable_only` flag; edge-detects `open_count` resp. `reachable_open_count`
  crossing 0), `model_updated` (bus `topology_updated`, optional change-type filter).
- Conditions: `area_environment_is` / `area_trust_is` / `area_type_is` (runtime resolver extracted from
  `websocket_api._runtime` into a shared helper), `path_traversable`
  (`shortest_path(traversable_only=True)`).
- Gate: hassfest validates the YAML descriptors and translation keys.

## 7. Frontend

- **Types/client:** `types.ts` / `ws-client.ts` gain all new fields (`kind`, `is_envelope`,
  `reachable`, `excluded`, `level_span`, `perimeter_components`).
- **elkjs (D-L):** `elkjs` (bundled build, main thread, no worker → CSP-safe; ~1.4 MB accepted for an
  admin panel). New `frontend/src/map/elk-layout.ts` returning the same `LayoutResult` shape as
  `layout.ts` plus `edgeRoutes` and per-node sizes. Layered algorithm, `direction: DOWN`, floor bands
  as ELK partitions, **outdoor band adjacent to the ground floor** (not below the basements),
  orthogonal border-anchored routing, determinism via sorted input + model-order strategy. Span areas:
  partition = topmost covered band, then post-process the node height down to the lowest covered band
  (tall box). `layout.ts` stays as fallback and test double; `floor-map.ts` computes ELK async
  (`@state layoutResult`, grid rendered until the promise resolves). Floor filtering becomes
  span-aware (`areaOnFloor`: `floor_id` match **or** span covers the floor's effective level);
  connector stubs stay for the single-floor view.
- **Editors:** floor-editor — level always editable, registry level shown as "suggested by Home
  Assistant", D-N explainer; area-editor — excluded toggle + span inputs, excluded areas dimmed on the
  map and excludable from flagged lists; neighbors-editor — `distant` group becomes "Remote (via
  unmodeled space)", preselects `kind: remote`, kind-aware preset filter; edge-editor — kind select,
  remote hides sides/structural presets; connection-fields — envelope presets as an opt-group when the
  edge is envelope (scope = preselection, not a lock), `glazed` hidden for outdoor↔outdoor,
  reachability tri-state (auto with the derived default shown / yes / no); beyond-editor — Down/Up rows
  - one-click suggestions ("ground touches earth", "top is open sky") for `whole_property`;
    home-config-editor — D-N copy.
- **Convention (D-O):** every new `live()` `<select>` gets a first-render dom-spec (Lit commits
  `.value` before the option children exist — finding 31's bug class).
- **i18n (D-M):** `de.ts` with key parity to `en.ts`; `localize.ts` gains `setLocale(hass.language)`
  (`de-DE` → `de`, `en` fallback); `translations/de.json` mirrors `en.json` in full.

## 8. Repairs / health

No new issue ids. Excluded/remote suppression falls out of the derivations;
`build_health += excluded_areas` (additive, for the panel's dimmed list); the purge flow calls the
entity cleanup.

## 9. Verification

- **Python:** extend `test_store`, `test_derivations`
  (spans, exclusion, reachable defaults, envelope/perimeter rule matrix), `test_graph_queries`
  (span-aware deltas both signs, overlap → horizontal, remote traversal), `test_websocket*`,
  `test_service_actions` / `test_read_services`, `test_sensor_house`, `test_repairs`,
  `test_registry_events` / `test_orphan_window` (row cleanup), `test_perimeter`. New:
  `test_perimeter_components`, `test_binary_sensor_components`, `test_trigger`, `test_condition`,
  `test_remove_entry`.
- **Frontend:** new `elk-layout.spec.ts` (determinism, band order, outdoor adjacency), dom-specs for
  every new select/editor, `de.spec.ts` (en/de key-set parity), floor-map span specs.
- **Blueprints:** `perimeter_arming` / `perimeter_open_at_night` gain an optional `reachable_only`
  input; `test_blueprints` revalidates.
- **Gates:** `script/check` (pytest `fail_under = 95`, pyright strict, hassfest, frontend-check) +
  end-to-end via `./script/develop` with the demo sensors: perimeter components visible; stairway with
  span −1..2 makes `topology.get_path kitchen → studio (traversable_only)` succeed (finding 24's
  acceptance case).
- **Docs:** CONFIGURATION.md (sign convention, envelope/perimeter rule, components, exclusion, spans,
  level authority), EXAMPLES.md (triggers/conditions **plus a "which surface for what" table**:
  triggers = when, conditions = boolean gates, read services = structured data pulls for automations,
  entities/attributes/labels = the dashboard surface — Lovelace visibility conditions and card
  templates cannot use integration conditions or call services, so dashboards consume entities only),
  DECISIONS.md entry for this phase, Phase-8 scope fence amendments (§ above).

## 10. Execution order (single branch, tree stays green)

1. Model (`data.py`, `const.py`, `store.py`; delete the legacy entry migration) →
2. Derivations (precedence, spans, envelope, reachable, exclusion, components) →
3. API (read_contract, websocket, services, `en.json`) →
4. Entities/lifecycle (component sensors, cleanup, `async_remove_entry`, dev demo) →
5. Triggers/conditions →
6. Frontend (types → editors → elkjs → map) →
7. German i18n (last, once all keys exist) →
8. Docs →
9. Full gates.

## 11. Resolved risks

| #   | Resolution                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | `api_version` stays 1 — everything additive; policy documented in `read_contract.py`.                                                                  |
| R2  | Component-id churn when a lexicographically smaller anchor joins: accepted pre-1.0, documented; persisted component ids rejected as stateful drift.    |
| R3  | No migrations or version bumps at all — pre-release, reset beats migration; the legacy entry migration is removed.                                     |
| R4  | `elk.bundled.js` on the main thread, no worker (CSP); grid layout stays as fallback/test double; graphs are tens of nodes, layout is milliseconds.     |
| R5  | Reachable default on unresolvable level = `True` — an alarm that over-monitors beats one that silently ignores a ground-floor window.                  |
| R6  | Remote edges are never envelope and never merge components, but can be trust-delta perimeter; their entries attach to the indoor endpoint's component. |
| R7  | Skylights (`side: up` on connections) out of scope — `beyond.up/down` covers D-K; revisit on demand.                                                   |
| R8  | Edges to excluded areas stay in the store (suppressed from derivations only); un-excluding restores everything.                                        |
| R9  | Perimeter triggers target sensors via entity selector, not free-text component ids; empty = aggregate.                                                 |
