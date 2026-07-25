# Configuration Reference

Everything Topology knows about your home, and where you set it.

## What is configured where

| Surface                                  | What lives there                                                                                                     | Who can change it               |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Config flow** (adding the integration) | **Nothing.** One confirm step, no fields. It only checks that the area registry and the Topology store are readable. | Anyone who can add integrations |
| **Options dialog**                       | **Does not exist.** The integration tile's **Configure** button opens the panel instead.                             | —                               |
| **Topology panel** → Home configuration  | Occupancy extent, label-projection toggles, unannotated-area repair threshold                                        | Admins only                     |
| **Topology panel** → area editor         | Per-area `type`, `environment`, `trust`; outer walls (`beyond`); windows and outside doors                           | Admins only                     |
| **Topology panel** → connection editor   | Edges between areas, their connection bundles, bound door/window sensors, perimeter override                         | Admins only                     |
| **Topology panel** → floor editor        | Level overrides for floors whose registry level is unset                                                             | Admins only                     |
| **Home Assistant Core**                  | The areas and floors themselves, their names, their floor assignment, and each floor's `level`                       | Admins only                     |
| **Service actions**                      | Everything the panel does, callable from automations and scripts                                                     | Anyone who can call actions     |
| **Entity settings**                      | Enabling the per-area diagnostic sensors, renaming entities                                                          | Admins only                     |

There is no YAML configuration. Topology is a single-entry helper (`single_config_entry: true`), so a second
instance cannot be added.

Topology **never** creates, renames, or deletes areas and floors. Those stay Home Assistant's, and Topology
reacts to your changes there: a renamed area keeps its annotation (references are keyed on the stable
`area_id`), and a deleted area's data is kept for a 72-hour undo window before it is purged.

## Home configuration

Panel → **Home configuration**.

| Setting                          | Values                                    | Default          | Meaning                                                                                                                                                                                               |
| -------------------------------- | ----------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Occupancy extent**             | `whole_property` · `unit_within_building` | `whole_property` | Whether your areas together are a standalone home or one unit inside a larger structure. Affects how unmodeled outer walls are read (a whole property borders open air; a unit may border neighbors). |
| **Project environment labels**   | on / off                                  | off              | See [Label projection](#label-projection)                                                                                                                                                             |
| **Project type labels**          | on / off                                  | off              | See [Label projection](#label-projection)                                                                                                                                                             |
| **Project trust labels**         | on / off                                  | off              | See [Label projection](#label-projection)                                                                                                                                                             |
| **Unannotated repair threshold** | 1–100                                     | 3                | How many unannotated areas it takes before Home Assistant raises the "Several areas are not annotated" suggestion.                                                                                    |

Changes take effect immediately — no reload, no restart. Flipping a projection toggle reconciles the labels
right away.

## Per-area annotation

Three dimensions, all optional, all independent. An area with none of them set is "unannotated", and Topology
reports it as `null` rather than guessing — a consumer treating `null` as "unknown" is the correct behavior,
and a silent `indoor` default would let an unannotated garden be reasoned about as a room.

### Type — what the room is for

An **open catalog**: the 13 shipped values below are suggestions, and any other string is legal. Type is a
descriptive hint, never authoritative — it seeds defaults and lets consumers make smarter guesses.

`bedroom` · `living` · `kitchen` · `dining` · `bathroom` · `hallway` · `office` · `utility` · `storage` ·
`garage` · `balcony` · `terrace` · `outdoor`

Picking one **cascades** editable defaults onto the other two dimensions, so annotating an area is usually one
choice plus a correction rather than three separate decisions:

| Type                                                                                           | Suggests environment | Suggests trust |
| ---------------------------------------------------------------------------------------------- | -------------------- | -------------- |
| `bedroom`, `living`, `kitchen`, `dining`, `bathroom`, `office`, `utility`, `storage`, `garage` | `indoor`             | `private`      |
| `hallway`                                                                                      | `indoor`             | `shared`       |
| `balcony`                                                                                      | `semi_outdoor`       | (no default)   |
| `terrace`, `outdoor`                                                                           | `outdoor`            | (no default)   |

The outdoor types deliberately suggest no trust: a front garden and a back garden are both outdoor but rarely
equally exposed. `hallway` suggests `shared` because the common case that matters is an apartment building's
stairwell — correct it to `private` for a hallway inside your own flat.

### Environment — what kind of space it is

| Value          | When to pick it                                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| `indoor`       | An enclosed, conditioned room — anything with a roof and walls you heat.           |
| `semi_outdoor` | Roofed but open to the air: a covered balcony, a porch, a carport, an open loggia. |
| `outdoor`      | Open air: a garden, a terrace, a yard, a driveway.                                 |

This is about **enclosure only**. It says nothing about who can reach the space — that is trust.

### Trust — how exposed the space is

An **access-exposure** class, and the scale is **ordered**: `private` < `shared` < `public`.

| Value     | When to pick it                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| `private` | Exclusively yours. Your rooms, a fenced back garden, your own garage.                                                    |
| `shared`  | Limited or communal access. An apartment building's stairwell or lift, a shared laundry, a garden shared with neighbors. |
| `public`  | Reachable by strangers. The street, a pavement, an unfenced front yard.                                                  |

Trust is **orthogonal to environment** — all four combinations are normal:

| Space                      | Environment | Trust     |
| -------------------------- | ----------- | --------- |
| Bedroom                    | `indoor`    | `private` |
| Apartment building hallway | `indoor`    | `shared`  |
| Fenced back garden         | `outdoor`   | `private` |
| Open front yard            | `outdoor`   | `public`  |

Trust is the dimension that earns its keep, because the **perimeter is derived from it**: any connection whose
two sides differ in trust class is a perimeter connection. Get trust right and the list of doors to watch when
away or asleep maintains itself.

This also drives how you split your outdoor space. One garden area means one trust class; if your front and
back gardens differ in exposure, model them as two areas. Topology forces no granularity — it only makes the
granularity you chose machine-readable.

> [!NOTE]
> An area with **no** trust set but with exterior openings is treated conservatively: its openings count as
> perimeter connections, because "unknown vs. the outside world" is not something to assume away. Annotating
> trust removes the guesswork.

## Outer walls (`beyond`)

For each cardinal side (N, E, S, W) that does **not** border one of your own areas, record what is on the other
side:

| Value      | Meaning                                                   | Openings allowed there                                |
| ---------- | --------------------------------------------------------- | ----------------------------------------------------- |
| `outdoor`  | Open air.                                                 | Yes — windows and outside doors belong here.          |
| `neighbor` | A party wall to a foreign occupied unit you do not model. | A door to shared space is plausible; a window is not. |
| `earth`    | A buried wall — a cellar against soil.                    | None.                                                 |

"Interior wall" and "exterior wall" are never flags you set. They are **derived**: a side either borders one of
your areas (that is an edge) or it carries a `beyond` class. This is also what constrains where an exterior
opening may go, and what the "Exterior opening on a non-outdoor side" repair checks.

A cardinal side is a **rough direction label**, not geometry. One side may hold several walls, windows, and
connections at once, so an L-shaped room or two south windows need no shape field.

## Windows and outside doors (exterior connections)

Per area, a list of the openings that face outside rather than another of your areas. Each carries the same
shape as an interior connection — a passage, a barrier, an optional side, an optional `glazed` marker, and an
optional bound `binary_sensor`.

Two extras exist only here:

- **Inline trust.** What is on the far side, when you did not model it as an area. Absent means `public`
  (nothing modeled behind it, so treat it as exposed). Set it to `shared` when, for example, your flat's front
  door opens onto a communal stairwell you did not create an area for.
- Openings are only offered on a side whose `beyond` is `outdoor`, so set the outer walls first.

## Edges and connections

An **edge** is an undirected adjacency between two of your areas. An edge is a **bundle** of one or more
**connections**, because two floor landings routinely hold both a stair and a lift, and forcing that into one
link would lose information.

Each connection is two axes plus optional detail:

| Axis          | Values                                                                 | What it answers               |
| ------------- | ---------------------------------------------------------------------- | ----------------------------- |
| **`passage`** | `none` · `level` · `stairs` · `ramp` · `elevator` · `ladder` · `hatch` | How does a person cross?      |
| **`barrier`** | `open` · `door` · `solid`                                              | What separates the two sides? |

`passage: none` means the two areas are adjacent but not traversable — a shared wall. `barrier: open` means
nothing is in the way (an open doorway, an open stairwell void); `door` means closable and therefore
state-dependent; `solid` means a wall or a floor slab. The leaf mechanism (hinged, sliding, pocket, folding) is
deliberately not modeled — it changes nothing the model reasons about.

Optional per connection:

- **`side`** — the rough cardinal bearing, recorded from the first area's perspective. The far area meets the
  same wall from the opposite bearing (N↔S, E↔W); Topology mirrors that for you.
- **`glazed`** — the connection transmits daylight. Orthogonal to the two axes: a French door is
  `{level, door, glazed}`, a fixed interior window between two rooms is `{none, door, glazed}`.
- **`sensor_entity_id`** — a `binary_sensor` reporting live open/closed state. Only allowed when the barrier is
  a `door`; anything else is rejected.
- **`perimeter_override`** — force this connection to count as perimeter even when both sides share a trust
  class. The one case that needs it: a door between two equally-private units, such as a main flat and a
  granny flat.

### Connection presets

You pick a **preset**, not the raw axes. The preset expands to a passage + barrier pair and is stored as such,
so presets are convenience, never a second object type — and a rare real combination (a glass observation lift
= `elevator` + `open`) stays settable by hand.

| Preset           | `passage`  | `barrier` | Glazed by default | Sensor allowed | Typical use                                  |
| ---------------- | ---------- | --------- | ----------------- | -------------- | -------------------------------------------- |
| `interior_door`  | `level`    | `door`    | No                | Yes            | The ordinary room door                       |
| `open_passage`   | `level`    | `open`    | No                | No             | A doorway with no door in it, a wide opening |
| `shared_wall`    | `none`     | `solid`   | No                | No             | Two rooms on one floor that only touch       |
| `ceiling`        | `none`     | `solid`   | No                | No             | One room stacked on another, slab between    |
| `open_stair`     | `stairs`   | `open`    | No                | No             | A stairwell with nothing closing it off      |
| `enclosed_stair` | `stairs`   | `door`    | No                | Yes            | A stair behind a door                        |
| `lift`           | `elevator` | `door`    | No                | Yes            | A lift between two landings                  |
| `loft_ladder`    | `ladder`   | `door`    | No                | Yes            | A pull-down loft ladder behind a trapdoor    |
| `ramp`           | `ramp`     | `open`    | No                | No             | A step-free slope, e.g. into a garage        |
| `hatch`          | `hatch`    | `door`    | No                | Yes            | A crawl hatch, a service opening             |
| `window`         | `none`     | `door`    | **Yes**           | Yes            | A window — closable, glazed, not walkable    |
| `outside_door`   | `level`    | `door`    | No                | Yes            | A front, back, or balcony door               |

`window` and `outside_door` are the presets you use for **exterior** openings; the rest describe boundaries
between two of your own areas.

`shared_wall` and `ceiling` expand identically — nobody passes through either — but they are separate presets
so a stacked pair reads as a floor slab rather than as a wall between storeys. Use `ceiling` whenever the two
areas are on different floors and nobody climbs between them; Topology's "connection between floors with no way
to climb" suggestion deliberately never fires on it.

### What is derived from a connection

Nothing below is stored — Topology computes it from the model every time, so it cannot go stale:

- **Horizontal vs. vertical.** From the effective floor levels of the two areas: equal levels means
  horizontal, differing means vertical. A signed level delta says which way (positive: the neighbor is above).
- **Interior vs. exterior.** An interior connection backs an edge between two of your areas; an exterior one
  faces outside.
- **Perimeter membership.** Any connection whose two sides differ in trust class, plus anything with
  `perimeter_override`.
- **Traversability.** An edge is traversable when at least one of its connections has a `passage` other than
  `none`.
- **Neighbors, hop counts, and shortest paths.** From the graph of non-orphaned interior edges.

## Floors and levels

Home Assistant's floor registry owns each floor's `level` integer, and Topology treats it as authoritative. It
uses the number for exactly two things: ordering floors relative to each other, and telling a horizontal
connection from a vertical one. It never displays the number and never assumes a convention.

So the numbering is yours: `0` is legal (a ground floor / _Erdgeschoss_ can be level `0`), negatives are legal
(a basement is `-1`), and if your convention calls the ground floor the "1st floor", `1` is equally fine. Only
the relative order carries meaning; the human label always comes from the floor's **name**.

Where a floor has **no** level in the registry, Topology can hold an **override** (panel → floor editor, or
`topology.set_floor_level`). The registry value always wins when one is present — the override only fills a
gap. Setting the level in Home Assistant Core itself is always the better fix; the override exists so a missing
level does not block the model.

Areas with no floor are shown in the **Outdoor / unfloored** view. That is expected for gardens; an _indoor_
area with no floor is flagged as a repair suggestion, but only when the rest of your home does use floors.

## Label projection

Off by default. Enable it per dimension in **Home configuration**.

With a dimension enabled, Topology writes labels named `topology:<dimension>:<value>` onto your areas in Home
Assistant Core:

| Dimension     | Example labels                                                |
| ------------- | ------------------------------------------------------------- |
| `environment` | `topology:environment:indoor`, `topology:environment:outdoor` |
| `type`        | `topology:type:bedroom`, `topology:type:hallway`              |
| `trust`       | `topology:trust:private`, `topology:trust:public`             |

Why bother: Core's own label features — automation `target`, UI filters, voice — can then use the model
directly, with no template and no WebSocket call. The trust labels are especially handy as security-automation
targets.

Rules the projection follows:

- **One-way.** Topology writes labels; it never reads them back as configuration. (The one-shot import can
  seed annotations _from_ labels, but that is an explicit, separate action.)
- **Owned and namespaced.** Topology only touches labels it created, marked by a description sentinel. A label
  of yours that happens to share a name is left completely alone.
- **Reversible while installed.** Turning a toggle off removes those labels from the areas and deletes the
  now-unused labels.
- **A deliberate leave-behind on uninstall.** Labels live in the Core registry, so the projected
  `environment`/`type`/`trust` labels survive removing Topology. That single-valued subset is the only part of
  the model that outlives the integration; delete the labels by hand if you do not want them kept.

`topology.project_labels` runs the reconcile on demand. Called with a specific `scope`, it fails if that
dimension's toggle is off; called with the default `all`, it projects every enabled dimension.

## Service actions

All seven actions are available whether or not the panel is open, and all of them raise a clear validation
error for an unknown `area_id` or `floor_id`.

### `topology.annotate_area`

Set an area's annotation. Only the fields you pass are changed.

| Field         | Required | Values                                             |
| ------------- | -------- | -------------------------------------------------- |
| `area_id`     | Yes      | An area                                            |
| `type`        | No       | Any string (catalog values offered as suggestions) |
| `environment` | No       | `indoor` · `outdoor` · `semi_outdoor`              |
| `trust`       | No       | `private` · `shared` · `public`                    |

At least one of `type`, `environment`, `trust` must be present.

```yaml
action: topology.annotate_area
data:
  area_id: back_garden
  type: outdoor
  environment: outdoor
  trust: private
```

### `topology.declare_connection`

Create or **replace** the connection between two areas from a preset.

| Field    | Required | Values                                                            |
| -------- | -------- | ----------------------------------------------------------------- |
| `area_a` | Yes      | One endpoint                                                      |
| `area_b` | Yes      | The other endpoint (must differ from `area_a`)                    |
| `preset` | Yes      | A preset name from the table above                                |
| `side`   | No       | `N` · `E` · `S` · `W`                                             |
| `glazed` | No       | Overrides the preset's default                                    |
| `sensor` | No       | A `binary_sensor.<slug>` entity id; only for door-barrier presets |

```yaml
action: topology.declare_connection
data:
  area_a: hallway
  area_b: living_room
  preset: interior_door
  sensor: binary_sensor.living_room_door
```

> [!IMPORTANT]
> This action writes a **single-connection** bundle, replacing whatever the edge held before. Multi-connection
> bundles (a stair _and_ a lift on the same pair) are built in the panel, which edits the whole bundle at once.

### `topology.set_beyond`

Record — or clear — what lies beyond one outer-wall side.

| Field     | Required | Values                                          |
| --------- | -------- | ----------------------------------------------- |
| `area_id` | Yes      | An area                                         |
| `side`    | Yes      | `N` · `E` · `S` · `W`                           |
| `beyond`  | No       | `outdoor` · `neighbor` · `earth`; omit to clear |

### `topology.set_exterior`

Replace an area's whole list of windows and outside doors, atomically. An empty list clears them.

| Field         | Required | Values                       |
| ------------- | -------- | ---------------------------- |
| `area_id`     | Yes      | An area                      |
| `connections` | Yes      | A list of connection objects |

Each object takes the raw two-axis form (not a preset name):

| Key                  | Required | Values                                                                 |
| -------------------- | -------- | ---------------------------------------------------------------------- |
| `passage`            | Yes      | `none` · `level` · `stairs` · `ramp` · `elevator` · `ladder` · `hatch` |
| `barrier`            | Yes      | `open` · `door` · `solid`                                              |
| `side`               | No       | `N` · `E` · `S` · `W`                                                  |
| `glazed`             | No       | `true` / `false`                                                       |
| `sensor_entity_id`   | No       | A `binary_sensor.<slug>`; requires `barrier: door`                     |
| `inline_trust`       | No       | `private` · `shared` · `public` (default: `public`)                    |
| `perimeter_override` | No       | `true` / `false`                                                       |
| `preset_name`        | No       | The preset this came from, for display                                 |

```yaml
action: topology.set_exterior
data:
  area_id: living_room
  connections:
    - passage: none
      barrier: door
      side: W
      glazed: true
      sensor_entity_id: binary_sensor.living_room_window
    - passage: level
      barrier: door
      side: S
      sensor_entity_id: binary_sensor.terrace_door
```

### `topology.set_floor_level`

Store or clear a level override for a floor. Remember: the registry level wins whenever it is set, so this only
helps a floor that has none.

| Field      | Required | Values                                         |
| ---------- | -------- | ---------------------------------------------- |
| `floor_id` | Yes      | A floor                                        |
| `level`    | No       | Any integer, negatives included; omit to clear |

### `topology.project_labels`

| Field   | Required | Values                                   | Default |
| ------- | -------- | ---------------------------------------- | ------- |
| `scope` | No       | `all` · `environment` · `type` · `trust` | `all`   |

### `topology.import_from_core`

Seed annotations once from existing Core data. **Fill-empty-only** — it never overwrites a value you set, and
it never creates connections.

| Field    | Required | Values               |
| -------- | -------- | -------------------- |
| `source` | Yes      | `aliases` · `labels` |

`aliases` matches each area's aliases and its name against the type catalog and applies the type cascade.
`labels` matches your own label names against the environment values and the type catalog. Labels Topology
projected itself are ignored as import sources — they are outputs, not intent.

## Repair issues

Topology checks its own data continuously and reconciles these suggestions on every change. All of them clear
themselves once the underlying condition is gone — there is nothing to dismiss manually.

Each card carries **two** links, because they answer different questions. The button at the bottom of the card
takes you straight to the panel view where the problem is drawn, so the common case is one click from "what is
this" to "fixed". The link at the end of the card's text brings you to the matching section below, for when you
want to know what the check actually means before changing anything. The two cards the panel cannot fix — a
store from a newer version, and unrecognised values — have no view to open, so both of their links come here.

| Issue                                                                               | What it means                                                                                                                                             | What to do                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Several areas are not annotated](#several-areas-are-not-annotated)                 | The number of areas with no annotation reached your threshold (default 3).                                                                                | Annotate them in the panel, or raise the threshold in Home configuration if you genuinely do not want to model those areas.                                                                |
| [Some areas are not connected](#some-areas-are-not-connected)                       | An area is an endpoint of no interior edge, so it is isolated in the graph.                                                                               | Declare a connection to a neighbor. Adjacency logic and path queries cannot reach an isolated area.                                                                                        |
| [Indoor areas have no floor](#indoor-areas-have-no-floor)                           | An `indoor` area has no floor assigned while the rest of your home does use floors.                                                                       | Assign the floor in Home Assistant (**Settings** → **Areas, labels & zones**). Without it, Topology cannot tell a vertical connection from a horizontal one.                               |
| [Contradictory wall bearings](#contradictory-wall-bearings)                         | The same cardinal side of an area is used both for an interior connection and for a `beyond` class — it cannot be both.                                   | Open that area and decide which side is really which. A common cause is copying bearings between mirrored rooms.                                                                           |
| [Exterior opening on a non-outdoor side](#exterior-opening-on-a-non-outdoor-side)   | An opening sits on a side facing `earth`, or a glazed opening faces a `neighbor` party wall.                                                              | Either correct the side's `beyond` class or move the opening. A buried wall admits no opening at all; a party wall admits a door but not a window.                                         |
| [Topology has orphaned entries](#topology-has-orphaned-entries)                     | Annotations, edges, or floor overrides reference areas or floors you deleted. They are kept for a 72-hour undo window in case the deletion was a mistake. | **Fixable:** submit the card to purge them now. Or restore the area in Home Assistant to keep the data. Doing nothing is fine too — the daily cleanup purges them once the window elapses. |
| [An edge spans more than one storey](#an-edge-spans-more-than-one-storey)           | A connection joins two areas whose floors are more than one storey apart.                                                                                 | Check the floor assignments of both areas. A void, an atrium or a maisonette opening makes this legitimate — the card is a prompt, not an error.                                           |
| [A vertical edge has no vertical passage](#a-vertical-edge-has-no-vertical-passage) | A connection between two storeys can be crossed, but nothing on it climbs.                                                                                | Change the kind to a stair, ramp, lift, ladder or hatch — or, if the two areas are simply stacked, to `ceiling`.                                                                           |
| [Topology store has unrecognized values](#topology-store-has-unrecognized-values)   | The stored model contains values this version does not understand, usually after downgrading.                                                             | Upgrade the integration again. The unrecognized values are shown as unknown but **preserved untouched**, so nothing is lost by upgrading.                                                  |
| [Topology store is from a newer version](#topology-store-is-from-a-newer-version)   | The store's schema version is newer than this installation supports, so Topology cannot load at all.                                                      | Upgrade the integration again, or restore a compatible backup.                                                                                                                             |

Each check in detail:

### Several areas are not annotated

**What it means.** The number of areas in your Home Assistant registry that Topology has no annotation for
reached the threshold you configured (default 3). Topology never invents annotations, so these areas simply do
not exist as far as any derivation is concerned.

**What to do.** Open the panel and annotate them — type, environment and trust. If some of those areas are
genuinely not part of your home model (a virtual area you use for grouping, say), raise the threshold under
**Home configuration** instead; the card is a nudge, not a rule.

**If you ignore it.** Nothing breaks. Unannotated areas stay out of the perimeter, out of the graph's trust
reasoning, and out of any label projection — so automations that expect them will simply not see them.

### Some areas are not connected

**What it means.** An area is not an endpoint of any interior connection, so it is isolated in the adjacency
graph. Nothing borders it and nothing can reach it.

**What to do.** Declare a connection to a neighbouring area. The panel's neighbours editor does this from the
area itself, so you do not need to find the two rooms on the map first.

**If you ignore it.** `topology.get_neighbors` returns nothing for that area and `topology.get_path` can never
reach it, so anything that reasons about "the room next door" skips it silently.

### Indoor areas have no floor

**What it means.** An area annotated `indoor` has no floor assigned in Home Assistant, while the rest of your
home does use floors. Topology derives whether a connection is horizontal or vertical purely from the two
areas' floor levels, so a floorless area makes every connection to it `unknown`.

**What to do.** Assign the floor in Home Assistant under **Settings** → **Areas, labels & zones**. Topology
consumes the floor registry, it does not maintain its own.

**If you ignore it.** Connections to that area stay `unknown` rather than horizontal or vertical, the distance
between rooms cannot be weighted, and the area is placed in the map's "no floor" band at the bottom.

**Not flagged:** a single-storey home that models no floors at all. The check only fires once some area has a
floor, because that is what proves you use them.

### Contradictory wall bearings

**What it means.** The same cardinal side of an area is used both for an interior connection to another room
_and_ for a `beyond` class. A wall cannot both border your kitchen and face open air.

**What to do.** Open that area and decide which side is really which. A common cause is copying bearings
between mirrored rooms. Remember that a connection's side is recorded from one area's point of view and the
other area meets the same wall from the opposite bearing — the panel does that mirroring for you.

**If you ignore it.** The `beyond` class stays stored but the wall also carries a room behind it, so
`connections_facing_outdoor` may report an opening as facing outside when it opens into a corridor.

### Exterior opening on a non-outdoor side

**What it means.** An opening sits where it physically cannot: on a side whose `beyond` is `earth` (a buried
wall admits no opening at all), or a glazed opening on a `neighbor` party wall (a party wall may carry a door
to shared space, but not a window).

**What to do.** Either correct that side's `beyond` class or move the opening to the side it is really on.

**If you ignore it.** The opening still counts towards the perimeter, so an implausible one inflates the set
your arming automation waits on.

### An edge spans more than one storey

**What it means.** A connection joins two areas whose effective floor levels are more than one apart — a
connection from the ground floor straight to the attic.

**What to do.** Check both areas' floor assignments first; a wrong floor is the usual cause. If the model is
right, leave it: a void, an atrium or a maisonette opening legitimately spans storeys, and Topology deliberately
still lets you create the connection.

**If you ignore it.** Nothing changes in behaviour. The distance between the two areas counts every storey the
route crosses, so a genuinely spanning connection makes the two areas read as further apart — which is usually
what you want.

### A vertical edge has no vertical passage

**What it means.** A connection joins two areas on different storeys, at least one of its kinds can be crossed,
and none of them climbs — no stairs, ramp, lift, ladder or hatch. Something claims to be a route between floors
that nobody can actually take.

**What to do.** Change the kind to the one that is really there. If the two areas are simply stacked on top of
each other with nothing joining them, pick **Floor / ceiling slab** (`ceiling`): it records the adjacency
without claiming a route, and this card never fires on it.

**If you ignore it.** Path queries will happily route people through a doorway that does not exist, so
"how far is the nursery from the front door" can come back with a route nobody can walk.

**Not flagged:** a connection nobody can pass through at all. `shared_wall` and `ceiling` make no claim about
crossing, so there is nothing missing from them.

### Topology has orphaned entries

**What it means.** Annotations, connections, or floor overrides still reference areas or floors you deleted in
Home Assistant. Topology keeps them for a 72-hour undo window in case the deletion was a mistake.

**What to do.** Three options, all fine. Submit the card to purge them now. Or restore the area in Home
Assistant, which re-adopts its annotation — the panel's orphans view also offers to restore an orphaned
connection once both its areas are back. Or do nothing: the daily cleanup purges them once the window elapses.

**If you ignore it.** The entries stay out of every derivation while orphaned, so they affect nothing; they are
simply deleted after 72 hours.

### Topology store has unrecognized values

**What it means.** The stored model contains values this version of Topology does not understand — almost
always because you downgraded after using a newer version that knew more values.

**What to do.** Upgrade the integration again.

**If you ignore it.** The unrecognised values are shown as unknown but **preserved untouched**, never rewritten
or dropped, so nothing is lost by upgrading later. In the meantime the affected field behaves as if it were
unset.

### Topology store is from a newer version

**What it means.** The store's schema version is newer than this installation supports. Topology refuses to
load rather than risk rewriting data it cannot interpret.

**What to do.** Upgrade the integration again, or restore a backup taken before the upgrade.

**If you ignore it.** Topology does not start at all: no entities, no panel, no service actions. This is the one
card that describes a hard failure rather than a suggestion.

## How the data updates

Topology polls nothing. It talks to no device and no cloud service, so there is no update interval to configure
and no connection that can time out.

Everything reacts to events instead:

- **You edit something** — a change in the panel, or a service action, writes the store and immediately
  recomputes the derived view. Entities update in the same turn, and a `topology_updated` event goes on the bus
  so other consumers can re-read.
- **You change an area or a floor in Home Assistant** — creating, renaming, re-assigning or deleting one is a
  registry event, and Topology follows it. A new area appears with its annotations empty; a deleted one has its
  annotations kept for 72 hours (see [Repair issues](#repair-issues)) so an accidental deletion is undoable.
- **A bound door or window sensor changes** — `binary_sensor.topology_perimeter_open` re-evaluates immediately.
  It only watches the sensors currently bound to a perimeter connection, and re-subscribes whenever that set
  changes.
- **Everything else is computed on read** — whether a wall is exterior, whether a connection is horizontal or
  vertical, the perimeter set, neighbours, paths, and the health signal are all derived from the stored
  annotations each time they are asked for. None of it is cached on disk, so it can never go stale relative to
  what you have annotated.

Writes to the store are debounced by one second, so a burst of edits becomes a single disk write. Nothing is
lost on a restart: the store is flushed on shutdown.

## Diagnostics

**Settings** → **Devices & Services** → **Topology** → three-dot menu → **Download diagnostics**.

The export contains the whole model — home configuration, every annotation, every edge and connection, floor
overrides, and the health signal — with area ids, floor ids, edge ids, and bound sensor object ids replaced by
stable pseudonyms (`area_1`, `floor_2`, `binary_sensor.sensor_3`). Adjacency joins survive the pseudonymization,
so the graph is still analyzable. Registry display names are never included, and the free-text `type` field is
redacted.

## Entity configuration

The per-area diagnostic sensors (`sensor.topology_<area>_type`, `_environment`, `_trust`) exist for every area
but are **disabled by default**, so a 20-area home does not gain 60 entities nobody asked for. Enable the ones
you want in **Settings** → **Devices & Services** → **Entities**.

The two always-enabled entities (`sensor.topology_house`, `binary_sensor.topology_perimeter_open`) can be
renamed like any entity; their unique ids are stable across area renames, so renaming an area never breaks an
automation.

## Removing Topology

1. **Settings** → **Devices & Services** → **Topology** → three-dot menu → **Delete**.
2. Optionally delete the integration files (via HACS, or by removing `custom_components/topology/`).

What is left behind: the projected `topology:<dimension>:<value>` **area labels**, deliberately, because they
live in Core's registry and may still be useful. Delete them in **Settings** → **Areas, labels & zones** →
**Labels** if you do not want them. Your areas, floors, and their assignments are untouched — Topology never
owned them.

## Troubleshooting

**The panel is not in the sidebar.** It is registered with admin-only access. Confirm your user is an
administrator, then reload the integration.

**A write in the panel fails with "Admin permission required".** Every write command is admin-gated; read
access alone is not enough.

**`binary_sensor.topology_perimeter_open` is always `off`.** It aggregates only perimeter connections that have
a `binary_sensor` **bound**. Check its `monitored_count` attribute — if it is 0, bind a sensor to a door or
window in the panel. Check `unavailable_sensors` too: a bound sensor that is unavailable is reported there and
does not count as open.

**A boundary I expected on the perimeter is not there.** Perimeter membership comes from a **trust delta**.
If both sides carry the same trust class (or one side has no trust set on an interior edge), the boundary is not
derived as perimeter — fix the trust classes, or set the connection's perimeter override for a genuinely
same-class boundary.

**An edge I created is reported as `axis: unknown`.** At least one of the two areas has no resolvable floor
level: no floor assigned, or a floor with no `level` and no override. Fix the floor assignment or the level.

**I deleted an area by accident.** Restore it in Home Assistant within 72 hours and its annotations and edges
come back; the "orphaned entries" repair card is the reminder that the window is open.

**Enable debug logging:**

```yaml
logger:
  default: info
  logs:
    custom_components.topology: debug
```

## Related documentation

- [Getting Started](./GETTING_STARTED.md) — install, set up, and annotate your first room
- [Examples](./EXAMPLES.md) — automations, templates, and scripts built on this model
- [GitHub Issues](https://github.com/jpawlowski/hass.topology/issues) — report problems
