# Residents — Implementation Plan

**Status:** Binding plan · Last updated 2026-07-21

This document is the authoritative implementation plan for the Residents
integration. It distills and supersedes the (German) idea-collection
documents that preceded it; it is written to be read standalone. Two
sister integrations, each in a separate repository, are planned alongside
it: **courier** (a notification layer that reads from Residents) in
[PLAN-courier.md](./PLAN-courier.md), and **topology** (area type,
indoor/outdoor, and adjacency, which Residents reads) in
[PLAN-topology.md](./PLAN-topology.md).

Everything in this repository — code, entity IDs, state values, services,
documentation — is written in **English**. Localized UI strings come from
Home Assistant translation files only.

## 1. Vision (condensed)

Home Assistant knows _where_ people are (`person`, `device_tracker`,
`zone`) but almost nothing _about_ them. Residents models the people and
pets of a household as a first-class domain: state, membership,
relationships, and master data.

The guiding question is not "where is person X?" but:

> What does the house need to know about its members so that automations
> can be written in human terms?

**Success criterion.** The plan succeeds if automations become expressible
that today require hard-coded entity lists or are not expressible at all:

- "When the last **adult** leaves the house …"
- "Motion in an **exclusively** assigned sleeping area although all
  assigned persons are provably away …"
- "Lights off in all areas that **only this person** has an exclusive
  relationship with"
- "Only wake the area the person triggering the alarm is assigned to"
- "While only guests are present, no resident-specific routines"
- "Night mode once all present persons with a sleeping place are asleep"

**Consume, complement, build.** Every capability is deliberately sorted
into one of three classes, and the classification is documented:

| Class            | Rule                    | Examples                                                                                                     |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| HA has it        | consume, never rebuild  | location, zones, Proximity (distance/direction), alarms, calendars, areas/floors, sun, repairs, translations |
| HA almost has it | complement, do not fork | `person` (no metadata), purpose-built triggers (no notion of person), Proximity (no intent)                  |
| HA lacks it      | build                   | person state space, membership, relationship model with roles, home mode                                     |

When a consumed source is missing (e.g., no Proximity config), Residents
does **not** rebuild it: the dependent capability degrades or disappears,
and a **repair issue** points the user to the integration to set up.

Area **topology** — room type, indoor/outdoor, and room adjacency
(a machine-readable floorplan) — is likewise consumed, not built: it is
house data, not resident data. It will come from **topology**, a
dedicated sister integration planned in
[PLAN-topology.md](./PLAN-topology.md) (separate repository, like
courier). Residents consumes it
where a capability benefits — e.g., excluding outdoor areas (balcony,
terrace, garden) from `needs_quiet`, or adjacency for the v3 quiet
grading — and degrades with a repair issue when it is absent. Once
consuming it, Residents also raises a **degradation repair issue** when
topology's consistency signal reports that data a Residents capability
depends on is incomplete — it reads that signal, never re-running
topology's own checks (consume, don't rebuild; topology owns and raises
the underlying issues). What stays in Residents is only the
_person-relative_ meaning of an area (`own_room` + `exclusive`, the
sleeping-area derivation, `retreat` / `seat` / `dining_place` /
`workspace` roles).

## 2. Domain model — core decisions

### 2.1 Membership × kind

Membership is a property of the _relationship between person and
household_, not of the person:

|                          | named (own preferences, own devices) | anonymous (placeholder) |
| ------------------------ | ------------------------------------ | ----------------------- |
| belongs to the household | **resident**                         | —                       |
| does not belong to it    | **regular** (regular guest)          | **guest slot**          |

- **Resident** — absence is the exception.
- **Regular** — named, with preferences and devices, but presence is the
  exception (grown-up children, recurring visitors, caregivers). Fully
  modeled in the state space; invisible in household aggregates while
  absent.
- **Guest slot** — anonymous, reusable identity placeholder with lifecycle
  free → occupied → free, expiry date, and automatic reset. A slot can be
  assigned to a named person for a stay, so "occupied by a regular" and
  "occupied anonymously" are the same mechanism.

**Kind** is orthogonal: `human` or `pet`.

**Presence and overnight stay are independent.** A dinner guest is present
without staying overnight. There is no "overnight" toggle: **a
time-limited sleeping-place relationship _is_ the overnight stay.**

### 2.2 State: two axes plus focus

| Axis         | Values                                                                                                            | Source                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **presence** | `home` · `nearby` · `away` · `extended_away`                                                                      | mostly automatic        |
| **activity** | `awake` · `winding_down` · `in_bed` · `asleep` · `awake_at_night` · `alarm_ringing` · `snoozing` · `waking`       | sensors, alarms, manual |
| **focus**    | open catalog (defaults: `personal`, `work`, `mindfulness`, `fitness`, `reading`, `gaming`, `driving`, `shopping`) | **self-declared**       |

- `away` vs. `extended_away` is about return expectation, not distance.
  The transition is derived primarily from the **zone role** (staying in a
  zone where an overnight stay is expected), with a time threshold only as
  fallback.
- `nearby` is fed by the Proximity integration; `heading_home` combines
  Proximity direction with the zone flag `departure_implies_homebound`.
- Focus is declared context (Apple/Google focus modes), never derived.
  Sleep is **not** a focus — a set focus rests while the person sleeps.
- **No numeric state encoding.** Context groups ("is in sleep context")
  become registered conditions for the automation editor plus a `context`
  attribute (`away`, `home`, `bedtime`, `sleep`, `wakeup`) for templates:
  _condition for the UI, attribute for Jinja_.
- Ordinal helpers become attributes: snooze levels are one state
  (`snoozing`) plus a `snooze_count` attribute.
- A fourth, non-state axis is master data: **life stage** (`adult`,
  `teen`, `child`, `toddler`, `senior`, `caregiver`) — drives
  `home_alone`, default profiles, and message-category limits.

### 2.3 Relationship model

The central structural pattern: **everything that references an area, a
device, a zone, or a person is modeled as a relationship with a role** —
never as a named single attribute. Each relationship carries:

| Field                        | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `target`                     | polymorphic: `area_id` \| `device_id` \| `zone_id` \| `member_id` |
| `role`                       | see role sets below                                               |
| `rank`                       | `primary` \| `secondary`                                          |
| `schedule`                   | recurring time window                                             |
| `valid_from` / `valid_until` | one-off validity period                                           |
| `exclusive`                  | "Julian's room" yes, "kitchen" no                                 |

Cardinality is always 0..n; relationships are queryable from both sides
(person → areas and area → persons are the same data).

**Role sets** (extensible):

- Area, human: `sleeping_place`, `own_room`, `workspace`, `retreat`,
  `dining_place`, `seat`, `responsible` · pet: `sleeping_place`,
  `feeding_place`, `water`, `litter`, `allowed`, `forbidden`
  - `own_room` and the other roles above are **usage** ("whose room /
    seat / desk"); `responsible` is a distinct **authority** role — who
    decides over the area and is its notification contact. The two usually
    point at the same person but are separable (a toddler _uses_ the room;
    a parent is `responsible` for it). "First vs. sole contact" needs no
    new field: `rank` (`primary`/`secondary`) gives first vs. fallback,
    and cardinality / `exclusive` gives sole vs. shared responsibility.
  - **Implicit default:** where no explicit `responsible` relationship
    exists for an area, the `own_room` primary holder is responsible by
    _derivation_ — a live fallback, not a stored value, so it tracks
    `own_room` automatically; any explicit `responsible` overrides it.
    Consumers read the **effective** responsible (explicit, else implied);
    rooms with neither (kitchen, no `own_room`) simply have none.
- Zone: `own_household`, `secondary_household`, `other_household`,
  `workplace`, `education`, `routine`, `transit` — plus two independent
  flags that do most of the work: `overnight_expected` (drives `away` →
  `extended_away`) and `departure_implies_homebound` (drives
  `heading_home`)
- Device: `carried` (counts for presence), `stationary` (does **not**
  count for presence, but is a channel), `access_token`, `sleep_sensor`,
  `alarm_source`, `vehicle`
- Person: kinship, `keeper_of` / `responsible_for`, escalation contact,
  state inheritance, optional per-pair spoken name

The polymorphic target resolves granularity by available sensors: a
sleeping place points at an area if nothing more is known, or at a bed
sensor device if one exists. Shared vs. separate beds fall out of whether
two persons reference the same device — no extra field.

Multi-instance support is **coupling level 0** only in v1: zone roles are
a local statement about a remote place; no instance-to-instance transport.

### 2.4 Metadata catalog (v1: categories A, B, C, H)

- **A — identity:** display name, spoken name (separate!), kind,
  membership, life stage, birth date, language/formality, linked HA user,
  picture
- **B — area & zone relationships**, **C — device relationships** (2.3)
- **H — system:** member since/until, active/inactive, visibility flags
- **Custom fields from day one**; categories E (capabilities), F
  (patterns), G (comfort) follow in v2.

Model rules: relationship over attribute · queryable from both sides ·
custom fields from the start · everything captured must be queryable
(condition, attribute, template) · **empty is always valid**.

### 2.5 Derived area properties

- **`needs_quiet`** — an area needs quiet when an assigned person is
  asleep there, or when a valid, occupied sleeping-place relationship
  exists and it is night. For non-exclusive sleeping areas (sofa bed in
  the living room) the person's activity state is the only valid source.
- **Sleeping area is a derivation, not a static flag** — an area is a
  sleeping area while at least one valid sleeping-place relationship
  points at it. The sofa-bed weekend case falls out automatically.
- **`sleeping_capacity`** — static per-area counter of how many people
  _could_ sleep there. Free overnight places = capacity − valid
  sleeping-place relationships.

Intrinsic, person-independent area facts — room type, indoor/outdoor,
adjacency — are deliberately **not** modeled here; they are consumed from
the area-topology sister integration (see §1, §6). Everything in this
section is a derivation from _person_ relationships.

### 2.6 Home mode: three axes

A mode is an interpretation for automations to condition on — **it never
executes actions** (the key lesson from FHEM HOMEMODE's mistakes).

- **Axis 1 — occupancy** (derived only): `empty` · `pets_only` ·
  `vulnerable_only` · `guests_only` · `normal`. Order is the precedence
  rule (lowest matching row wins).
- **Axis 2 — phase** (the only _ordered_ axis): `morning` · `day` ·
  `evening` · `night` · `quiet`. Source precedence: **resident activity >
  sun position > wall clock**. Transitions support offsets, virtual
  earliest/latest bounds (Adaptive Lighting's primitives), debounce, and
  weekday/weekend variants. The phase is **monotonic** within a day —
  no backwards flapping; backwards only via override. A phase override
  ends silently "when the derivation catches up".
- **Axis 3 — exception** (manual, optional expiry): `vacation` · `party` ·
  `illness` · `contractor` · `moving` · `emergency` · `maintenance`;
  optionally scoped to a single area (no per-area mode machine).

**Override** per axis: derived → overridden-with-expiry → pinned.
**Simulation** is distinct from override: mandatory expiry, arbitrary
(even impossible) combinations, permanently visible, clean rollback.
**Preview/hindsight** computes (never sets) the mode for a virtual point
in time, including an annual sweep to flag degenerate configurations.

## 3. Glossary (binding terms)

The English identifiers below are binding for code, entity IDs, state
values, and services (German shown for reference only).

| EN                                                                                                                                                                               | DE                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `residents` (domain), household                                                                                                                                                  | Haushalt                                      |
| member                                                                                                                                                                           | Person (Mensch oder Tier)                     |
| membership: `resident`, `regular`, `guest_slot`                                                                                                                                  | Zugehörigkeit: Bewohner, Stammgast, Gastplatz |
| kind: `human`, `pet`                                                                                                                                                             | Typ: Mensch, Tier                             |
| life stage: `adult`, `teen`, `child`, `toddler`, `senior`, `caregiver`                                                                                                           | Lebensphase                                   |
| presence: `home`, `nearby`, `away`, `extended_away`                                                                                                                              | Anwesenheit                                   |
| activity: `awake`, `winding_down`, `in_bed`, `asleep`, `awake_at_night`, `alarm_ringing`, `snoozing`, `waking`                                                                   | Aktivität                                     |
| context: `away`, `home`, `bedtime`, `sleep`, `wakeup`                                                                                                                            | Kontextgruppe                                 |
| focus, focus catalog                                                                                                                                                             | Focus                                         |
| `heading_home`, `home_alone`                                                                                                                                                     | auf dem Heimweg, allein zu Hause              |
| `needs_quiet`, `sleeping_capacity`                                                                                                                                               | ruhebedürftig, Schlafgelegenheit              |
| mode axes: `occupancy_mode`, `phase`, `exception`                                                                                                                                | Modus: Belegung, Phase, Ausnahme              |
| occupancy: `empty`, `pets_only`, `vulnerable_only`, `guests_only`, `normal`                                                                                                      | Belegungswerte                                |
| phase: `morning`, `day`, `evening`, `night`, `quiet`                                                                                                                             | Phasenwerte                                   |
| exception: `vacation`, `party`, `illness`, `contractor`, `moving`, `emergency`, `maintenance`                                                                                    | Ausnahmewerte                                 |
| `overridden` / `pinned`, source: `derived` \| `overridden`                                                                                                                       | übersteuert / eingefroren                     |
| simulation, preview, `virtual_time`, `annual_sweep`                                                                                                                              | Simulation, Vorschau                          |
| relation: `target`, `role`, `rank` (`primary`/`secondary`), `schedule`, `valid_from`/`valid_until`, `exclusive`                                                                  | Beziehung                                     |
| area roles: `sleeping_place`, `own_room`, `workspace`, `retreat`, `dining_place`, `seat`, `responsible`, `feeding_place`, `water`, `litter`, `allowed`, `forbidden`              | Ortsrollen                                    |
| zone roles: `own_household`, `secondary_household`, `other_household`, `workplace`, `education`, `routine`, `transit`; flags `overnight_expected`, `departure_implies_homebound` | Zonenrollen                                   |
| device roles: `carried`, `stationary`, `access_token`, `sleep_sensor`, `alarm_source`, `vehicle`                                                                                 | Geräterollen                                  |
| `spoken_name`, `capabilities`, `patterns`, `comfort`, `custom_field`                                                                                                             | Stammdaten                                    |
| `last_arrival`, `last_departure`, `last_absence_duration`, `expected_return`, `snooze_count`                                                                                     | Statistik                                     |

## 4. Technical foundations (verified spikes)

Verified against the Home Assistant **2026.4.4** source installed in the
devcontainer venv (repo baseline is now 2026.7; re-verify live in
Phase 0). File references are relative to the installed `homeassistant/`
package.

### 4.1 Custom triggers and conditions — viable

- The trigger platform API loads generically via
  `async_process_integration_platforms` (`helpers/trigger.py:174-235`) —
  custom integrations are included; there is no core-only whitelist.
- New-style API: `Trigger` base class with `async_validate_config` +
  `async_attach_runner`, exposed via `async_get_triggers` returning
  `dict[str, type[Trigger]]` (`helpers/trigger.py:258-330, 952-985`).
  Key `"_"` maps to the bare domain, other keys become
  `residents.<key>` (`helpers/automation.py:59-77`).
- Conditions are symmetric: `Condition` with `async_validate_config` +
  `async_get_checker`, via `async_get_conditions`
  (`helpers/condition.py:287-329, 687-702`).
- Editor metadata comes from `triggers.yaml` / `conditions.yaml`
  (loaded at `helpers/trigger.py:1432-1453`,
  `helpers/condition.py:1699-1712`) plus `strings.json`
  (`triggers`/`conditions` blocks) and `icons.json`; descriptions are
  pushed to the frontend via the WebSocket commands
  `trigger_platforms/subscribe` / `condition_platforms/subscribe`
  (`components/websocket_api/commands.py:551-647`).
- The Labs "new triggers and conditions" gate only hides a hard-coded
  list of **core** domains (`components/automation/__init__.py:120-227`);
  a custom domain is served unconditionally.
- **Caveat:** the API is officially a preview feature. Reference
  implementation: `components/switch/`. Mitigation: keep entity states
  and attributes stable so classic state triggers remain a full fallback.

### 4.2 Config subentries — viable for per-member data

- `ConfigSubentryFlow` supports `user` and `reconfigure` steps (no
  options flow for subentries) — `config_entries.py:3592-3749`; storage
  format `{data, subentry_id, subentry_type, title, unique_id}`
  (`config_entries.py:336-388`).
- A relationship list (target + role + rank) fits in a **single form**
  using `ObjectSelector(multiple=True, fields={...})` with nested
  selectors per field (`helpers/selector.py:1567-1646`); areas/devices/
  entities have dedicated selectors, zones resolve via
  `EntitySelector(domain="zone")`.
- Limits to design around: no cross-subentry references (manual
  `subentry_id` bookkeeping, no referential integrity), updates reload
  the whole config entry when using `async_update_reload_and_abort`, and
  the nested-selector UX is functional but not polished.
- References: `components/kitchen_sink/config_flow.py`,
  `components/google_generative_ai_conversation/config_flow.py`.

### 4.3 Panel with server-side user enforcement — viable

- Register a sidebar panel from the integration via
  `panel_custom.async_register_panel(module_url=...)` +
  `hass.http.async_register_static_paths([StaticPathConfig(...)])` —
  full pattern in `components/dynalite/panel.py:98-116`.
- Every WebSocket command sees the authenticated user server-side:
  `ActiveConnection.user` (`components/websocket_api/connection.py:39-98`);
  the frontend cannot spoof it. Per-user data filtering pattern:
  `components/frontend/storage.py:167-215`; admin gating via
  `@require_admin`.
- `person` stores `user_id` (`components/person/__init__.py:65`); there
  is no ready-made user→person lookup helper, but it is a trivial
  attribute scan.

## 5. Architecture decisions

Recorded as ADRs in [DECISIONS.md](./DECISIONS.md); summary:

- **Storage (was open question 5.1): hybrid.** One config subentry per
  member for master data and relationships (UI, registry cleanup, and
  reconfigure for free); a `helpers.storage.Store` exclusively for
  runtime state (state axes, statistics, guest-slot occupancy). Runtime
  state never lives in config entries.
- **Entity granularity (5.2): hybrid.** One entity per state axis
  (presence, activity, focus, `heading_home`, …); master data and
  statistics as attributes. No entity-per-field explosion.
- **Trigger API (5.8): adopt the new platform API, with fallback.**
  Entity states/attributes are a stable public contract so classic state
  triggers keep working if the preview API changes.
- **HA baseline: 2026.7** (minimum in `hacs.json`, enforced by
  `script/ha-version-sync`).
- **Template sync stays enabled** (upstream is the maintainer's own
  blueprint; project-identity files are protected via
  `.templatesyncignore`).
- **Label projection (Core interop): one-way, opt-in.** residents may
  project stable master data — `membership`, `life_stage` — onto the
  person/member entities as namespaced, integration-owned labels
  (`residents:adult`, …) so Core label features (automation `target`, UI
  filters, voice) reach household roles. Rules: structural / low-
  cardinality facts only — **never** state axes, `needs_quiet`, or mode
  (registry churn); create/update/delete only labels we own (tracked in
  our store, marked via `description`), never user labels; at most a
  one-time opt-in _import_, never live label consumption. Labels can only
  carry per-object single values — areas, entities, devices; **floors
  cannot carry labels** (verified in `helpers/floor_registry.py`), and a
  graph is not a tag, so relationships stay integration-native. On
  removal, projected labels are **kept by default** (a deliberate
  leave-behind so the facts survive) and purgeable on request; anything
  not projectable exits via the diagnostics export (Phase 6). topology
  owns the area-facing half — see [PLAN-topology.md](./PLAN-topology.md).
  **This section is the policy owner** for label projection across both
  repositories: topology's `PLAN-topology.md` §6 mirrors these rules and
  follows any change made here within the same minor release.

**Still open** (decide before Phase 3):

- 5.3 — activity sources in v1: proposal is manual + alarm sensor +
  optional sensor link, no own heuristics.
- 5.4 — final entity-ID naming scheme and its relation to `person.*` IDs.
- Focus catalog openness vs. registered trigger values; size of the
  exception value set (closed core set + custom values is the tendency).

## 6. Non-goals

Residents will **never** ship:

- own presence detection, geofencing, BLE, or ping
- own distance/direction math (consume Proximity)
- an alarm clock or wake-time toolkit (consume HA schedules + companion
  app alarm sensor)
- access control (access tokens are metadata only)
- alarm logic or alarm state (belongs to `alarm_control_panel`/Alarmo)
- actions attached to the mode object (HOMEMODE's `HomeCMD` mistake)
- own transport between HA instances (consume `remote_homeassistant` if
  coupling level 1 is ever wanted); no federation while Core has none
- migration tooling from FHEM or ioBroker
- text-command control
- own area typing, indoor/outdoor classification, or a room-adjacency /
  floorplan graph — house topology, not resident data: consume a
  dedicated area-topology sister integration and degrade + raise a repair
  issue when it is absent (person-relative area meaning stays here)
- labels as a second source of truth — runtime state is never mirrored to
  labels, and labels are never read as a live input (label projection is
  one-way, opt-in, and owned; a one-time import is the only inbound path)

## 7. Implementation phases

Each phase ends with `script/check` and `script/hassfest` green and the
listed definition of done. Tests are written per phase
(`tests/` mirrors the package structure).

### Phase 0 — Live spike verification (throwaway)

- **Scope:** After the devcontainer rebuild on HA 2026.7: register one
  trivial trigger + condition via the new platform API and confirm they
  appear and fire in the automation editor; click through a subentry
  form with an `ObjectSelector` relationship list.
- **DoD:** documented go/no-go for the trigger API (screenshot evidence);
  spike code deleted. If no-go: Phase 5 falls back to classic state
  triggers only.

### Phase 1 — Skeleton cleanup

- **Scope:** Remove the blueprint example: platforms `fan/`, `switch/`,
  `number/`, `button/`, example `sensor/`/`binary_sensor/` entities,
  `api/` client, example service; empty out `services.yaml`,
  `translations/en.json`, `const.py` example keys. The integration loads
  with a config entry and zero entities.
- **Packages:** nearly all under `custom_components/residents/`.
- **DoD:** installable, loads/unloads cleanly, checks green.

### Phase 2 — Data model, config flows, storage

- **Scope:** Domain dataclasses (member, membership, kind, life stage,
  metadata A/B/C/H, relations incl. validity windows); main entry =
  household; one subentry per member (`subentry_type` per membership or a
  single `member` type — decide in flow design); relationship lists via
  `ObjectSelector`; runtime `Store` with schema version + migration hook.
- **Packages:** `data.py`, `config_flow_handler/` (subentry flow,
  schemas, validators), `coordinator/` (member registry), `entity/`.
- **DoD:** create/edit/remove members via UI; guest-slot assignment and
  expiry stored; state survives restart; flow + store round-trip tests.

### Phase 3 — State machines and per-member entities

- **Scope:** Presence and activity state machines with manual services
  and automatic transitions (zone-role-driven `extended_away`,
  `heading_home` from Proximity + zone flag, alarm-sensor wake-up);
  focus with catalog, expiry, source flag; per-member entities (one per
  axis) with statistics attributes; **virtual clock abstraction first** —
  all time-dependent logic reads an injectable clock so simulation and
  tests can drive it.
- **Packages:** new domain-logic module (e.g., `engine/` — needs the
  approved-package exception in AGENTS.md, or live under
  `coordinator/`), `select/`, `sensor/`, `binary_sensor/`,
  `service_actions/`.
- **DoD:** a member walks through a full simulated day correctly;
  state-machine unit tests with time simulation; entity IDs and
  attributes frozen as public interface (see §9).

### Phase 4 — Aggregates and home mode

- **Scope:** Household aggregates (counters with list/first/last as
  attributes, `home_alone` incl. who/type/life stage, `anyone_asleep`,
  `guests_present`, free overnight places); derived area properties
  (`needs_quiet`, sleeping-area derivation, `sleeping_capacity`); mode
  axes with derivation, override (expiry, pinned, catch-up), simulation
  with mandatory expiry, preview + annual sweep.
- **DoD:** scenario golden tests (family evening, vacation, guests-only,
  sofa-bed weekend) pass; simulation is visibly flagged and rolls back
  cleanly.

### Phase 5 — Triggers and conditions

- **Scope:** `trigger.py` + `condition.py` with the new platform API;
  `triggers.yaml` / `conditions.yaml`, `strings.json`, `icons.json`;
  target filters (specific member, membership, life stage, kind, any);
  context-group conditions replacing numeric encodings; documented
  classic-trigger fallback recipes.
- **DoD:** own triggers/conditions selectable in the automation editor
  and firing; automation setup tests.

### Phase 6 — Services, diagnostics, repairs

- **Scope:** Public service actions (set state, occupy/assign/release
  guest slot, add/remove relation, set/end focus, override mode,
  start/stop simulation, set exception with optional area scope);
  diagnostics with `async_redact_data`; repair issues for missing
  consumed sources (Proximity, alarm sensor), incomplete topology data
  (read from its consistency signal, not re-derived), and broken
  references.
- **DoD:** services documented in `services.yaml` with selectors;
  diagnostics redact personal data; repairs appear and resolve.

### Phase 7 — Admin panel

- **Scope:** Sidebar panel (`panel_custom` + static assets) for managing
  members, relationships, and modes; WebSocket API with server-side
  authorization (`connection.user`, admin-gated writes). Self-service
  view for logged-in users is **v2**.
- **DoD:** panel usable for full household administration; WS command
  tests incl. authorization denial paths.

### Phase 8 — Docs and release readiness

- **Scope:** Write real `docs/user/*`; full `ARCHITECTURE.md` rewrite;
  README feature docs; brands assets; first release via release-please;
  HACS listing checklist.
- **DoD:** a stranger can install and configure Residents from the docs
  alone.

## 8. v1 scope mapping

| v1 item (from the idea collection)                                | Phase                |
| ----------------------------------------------------------------- | -------------------- |
| Membership & kind model (resident/regular/guest_slot × human/pet) | 2                    |
| Metadata categories A, B, C, H + custom fields                    | 2                    |
| Area/zone/device relationships incl. flags, queryable both ways   | 2 (+4 reverse views) |
| Both state axes, manual + automatic transitions                   | 3                    |
| Focus axis with catalog, expiry, visibility                       | 3                    |
| Transition conditions (sun, offset, bounds, clock, presence)      | 3–4                  |
| Household aggregates                                              | 4                    |
| `needs_quiet` per area (derived), `sleeping_capacity`             | 4                    |
| Mode: all three axes, derivation + override with expiry           | 4                    |
| Simulation with mandatory expiry; preview + annual sweep          | 4                    |
| Context groups as registered conditions                           | 5                    |
| Own triggers and conditions                                       | 5                    |
| Services                                                          | 6                    |
| Configuration UI (admin view)                                     | 2 + 7                |

v2 (later): person↔person relationships incl. state inheritance and
escalation contacts, metadata E/F/G, self-service panel, return
prediction, starter profiles, full transition-condition set. v3: portable
member profiles, coupling level 1 via `remote_homeassistant`,
plausibility checks, floor-hierarchy quiet grading (depends on the
area-topology sister integration).

## 9. Public interface commitments

From the end of Phase 3, the following are treated as a public API with a
deprecation policy (one minor release with repair-issue warning):

- entity IDs and their state values per axis (documented enumerations)
- attribute names and machine-readable formats (no display-only strings)
- mode entity values and the `source: derived | overridden` attribute
- service names and signatures

Primary consumer: **courier** — see
[PLAN-courier.md](./PLAN-courier.md) for exactly what it reads and why
soft coupling requires this stability.

## 10. Open questions

Tracked here until decided; each gets an ADR when closed:

1. Entity-ID scheme and relation to `person.*` (before Phase 3)
2. Activity sources in v1 (before Phase 3)
3. Focus catalog: closed core set + generic custom trigger vs. dynamic
   registration (before Phase 5)
4. Exception value set: closed vs. extensible (before Phase 4)
5. Whether `waking`/`winding_down` stay dedicated states or become
   derivations (before Phase 3)
6. Whether person-state simulation (beyond mode simulation) is ever safe
   (not before v2)
