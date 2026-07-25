# Getting Started with Topology

This guide takes you from an empty Home Assistant to a working topology model: one annotated room, two rooms
connected, a door sensor bound to that connection, and the entities verified.

Topology annotates the areas and floors you **already have**. It never creates them. So before you start, make
sure your rooms exist as areas in **Settings** → **Areas, labels & zones** — even a rough set is enough to
begin with.

## Prerequisites

- Home Assistant **2026.7.0** or newer
- An administrator account (the Topology panel and every write is admin-only)
- A few areas in the area registry; floors are optional but recommended for multi-storey homes
- HACS, if you want to install through it (a manual install works too)

Topology needs no account, no API key, and no network access. It talks to no device and no cloud service.

## Step 1 — Install

### Via HACS

Topology is not in the HACS default store yet, so add it as a custom repository:

1. Open **HACS** → **Integrations**.
2. Three-dot menu → **Custom repositories**.
3. Enter `https://github.com/jpawlowski/hass.topology`, choose category **Integration**, click **Add**.
4. Find **Topology** in the list and click **Download**.
5. **Restart Home Assistant.** This is required — Home Assistant only discovers a new custom integration on
   startup.

### Manually

1. Copy `custom_components/topology/` from this repository into your configuration's `custom_components/`
   directory.
2. Restart Home Assistant.

## Step 2 — Add the integration (one Submit)

1. Go to **Settings** → **Devices & Services** → **+ Add Integration**.
2. Search for **Topology** and select it.
3. The form has **no fields**. Click **Submit**.

What that single click does: it verifies that the area registry can be read and that the Topology store loads,
then creates the config entry. If either check fails you get an error in the dialog and can retry.

There is only ever **one** Topology entry, and there is **no options dialog** — everything you configure later
lives in the panel.

## Step 3 — Open the Topology panel

**Topology** now appears in the sidebar. Click it. (The integration tile's **Configure** button opens the same
panel; there is nothing else behind it.)

The panel is where all editing happens:

- Floors are listed newest-topmost, ordered by level, so reading down the list reads like a section through
  the building. Two extra views join them: **All floors** and **Outdoor / unfloored**.
- Each floor view shows its areas as a schematic map, with the connections drawn between them.
- A side list flags what still needs attention: unannotated areas, isolated areas, contradictory bearings.
- **Home configuration** holds the household-level settings; every view has a way back to it.

## Step 4 — Optionally seed from what you already have

On first run the panel shows a card offering a **one-shot import** from Home Assistant Core:

- **Import area aliases** — matches each area's aliases (and its name) against the shipped type catalog, so an
  area named or aliased "Bedroom" gets `type: bedroom`, and the type cascade fills in `environment: indoor`
  and `trust: private`.
- **Import area labels** — matches your existing label names against the environment values and the type
  catalog.

Both are **fill-empty-only**: they never overwrite a value you already set. Neither creates connections — the
graph is always yours to declare. If neither matches your naming habits, choose **Not now**; skipping costs
nothing, and you can run the import later with the `topology.import_from_core` action.

## Step 5 — Annotate one room, end to end

Pick a real room — a bedroom on an upper floor with one window is a good first case — and click it on the map.
Its editor opens with everything belonging to that area:

1. **Type.** Choose `bedroom` from the catalog, or type your own value; the catalog is open, any string is
   legal. Picking a type pre-fills the next two fields with sensible defaults, which you can correct.
2. **Environment.** `indoor` for a room, `outdoor` for a garden or terrace, `semi_outdoor` for a covered
   balcony or porch.
3. **Trust.** How exposed the space is: `private` for your own rooms, `shared` for space with limited or
   communal access (an apartment building's stairwell), `public` for space strangers reach (the street, an
   open front yard). Trust is deliberately individual — it is what makes the perimeter derivation work, so
   think about who can reach the space, not about whether it is indoors.
4. **Outer walls.** In the outer-wall editor, set what lies beyond each side that does _not_ border another of
   your areas: `outdoor` for open air, `neighbor` for a party wall against a unit you do not model, `earth`
   for a buried wall. You never mark a wall "exterior" — that is derived: a side either borders one of your
   areas or it has a `beyond` class.
5. **Windows and outside doors.** In the exterior-openings editor add the room's window. An exterior opening
   may only sit on a side whose `beyond` is `outdoor`, which is why step 4 comes first.

Save. That is one area fully described.

> [!TIP]
> You do not have to finish the whole house in one sitting. `sensor.topology_house` tells you how far along you
> are, and Home Assistant raises a gentle repair suggestion once several areas are still unannotated.

## Step 6 — Connect two rooms

Adjacency is what turns a list of annotated rooms into a model. Still in an area's editor, find the
**Neighbors** section:

1. Pick the other area. The candidate list is grouped by **same floor**, **floor above**, and **floor below**,
   so the choice reflects the building rather than an alphabetical list of every area you own.
2. Pick a **preset** — the named connection type. "Interior door" for the usual door, "Open passage" for a
   doorway with no door in it, "Open stair" for a stairwell with no door at the top, "Lift", "Loft ladder",
   "Shared wall" for two rooms that only touch, and so on. The preset expands to the two axes Topology
   actually stores: a `passage` (how a person crosses) and a `barrier` (what separates the two sides).
3. Save. The connection appears on the map between the two areas.

Nothing about vertical/horizontal is asked: Topology derives that from the floor levels of the two areas. If
you connected a landing to the room above it, the edge is vertical because the floors differ — see
[Floors and levels](#floors-and-levels) below.

An edge is a **bundle**, so if a landing is served by both a stair and a lift, add a second connection to the
same pair instead of compromising on one.

## Step 7 — Bind a door sensor

This is the step that makes `binary_sensor.topology_perimeter_open` useful.

1. Click the connection on the map (or open it from either area's Neighbors list). The connection editor
   opens.
2. Bind a **`binary_sensor`** entity — your door or window contact. Only connections whose barrier is a
   **door** can carry a sensor: an open passage has nothing to sense, and a solid wall does not open.
3. Save.

Do the same for the exterior openings that matter (the front door, ground-floor windows). Topology now knows
which physical sensor reports the state of which boundary.

Whether a boundary counts as **perimeter** is derived, not asked: any connection whose two sides differ in
trust class is one. Your front door sits between a `private` hallway and the `public` street, so it is a
perimeter connection automatically. For the rare boundary between two equally-trusted spaces that still
matters — the door between a main flat and a granny flat, both `private` — the connection editor has a
perimeter override.

## Step 8 — Verify the entities

Go to **Developer tools** → **States** and check:

| Entity                                  | What you should see                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `sensor.topology_house`                 | A percentage — annotated areas over total areas. Attributes list the household counts. |
| `binary_sensor.topology_perimeter_open` | `on` while a bound perimeter sensor is open, `off` otherwise                           |

On `sensor.topology_house`, confirm:

- `area_count` matches the number of areas you have,
- `annotated_count` grew by one after step 5,
- `unannotated_areas` still lists the rooms you have not done yet,
- `perimeter_connection_count` grew after step 7,
- `floor_count` matches your floors.

On `binary_sensor.topology_perimeter_open`, confirm `monitored_count` is at least 1 — that is the count of
perimeter connections with a bound sensor. Open the physical door and watch the state flip to `on` and the
door appear in `open_connections`. If `monitored_count` is 0, no sensor is bound yet (step 7).

Want per-area values as entities? The per-area diagnostic sensors
(`sensor.topology_<area>_type`, `_environment`, `_trust`) exist for every area but are **disabled by
default**. Enable the ones you want in **Settings** → **Devices & Services** → **Entities**.

## Floors and levels

Home Assistant stores a `level` integer on every floor, and Topology uses **only that number**, for **only two
things**: ordering floors relative to each other, and telling a horizontal connection from a vertical one.

That means the numbering convention is entirely yours:

- `0` is legal, so a German _Erdgeschoss_ or a British ground floor can be level `0`.
- Negative numbers are legal, so a basement is `-1` and a sub-basement `-2`.
- If your convention calls the ground floor the "1st floor", set it to `1`. Nothing breaks.

Topology never displays the number and never assumes a convention. You label floors by name; the level only
says what is above what. If a floor has **no** level set in the registry, Topology can hold an override for it
(in the panel's floor editor, or with `topology.set_floor_level`) — but the registry value always wins when
one is present, because the floor registry owns that field.

An indoor area with no floor at all is flagged as a repair suggestion, but only when the rest of your home
does use floors — a single-storey home that models no floors is left alone.

## Where to go next

- [Configuration Reference](./CONFIGURATION.md) — what is configured where, every annotation dimension, the
  full preset table, label projection, and every repair issue with what to do about it
- [Examples](./EXAMPLES.md) — runnable automations and templates built on the entities and labels above
- Report problems at [GitHub Issues](https://github.com/jpawlowski/hass.topology/issues)

## Troubleshooting first setup

**The Topology item is not in my sidebar.** The panel requires an administrator account. Confirm your user is
an admin, then reload the integration (**Settings** → **Devices & Services** → Topology → three-dot menu →
**Reload**).

**Setup failed with "The area registry could not be read".** A transient Home Assistant problem; retry the
dialog.

**Setup failed with "The topology store could not be read".** The stored model (`.storage/topology.storage`) is
unreadable. Restore it from a backup and retry.

**Setup aborted with "written by a newer version".** You downgraded the integration after it had already saved
a newer store schema. Upgrade again, or restore a compatible backup.

**Everything set up but the map is empty.** Topology renders your area registry. If you have no areas yet,
create them in **Settings** → **Areas, labels & zones** first — Topology will pick them up immediately,
without a restart.

**Enable debug logging:**

```yaml
logger:
  default: info
  logs:
    custom_components.topology: debug
```
