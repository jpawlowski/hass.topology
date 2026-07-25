# Examples

Ready-to-use automations, templates, and queries built on the real Topology surface: the two always-enabled
entities and their attributes, the optional per-area sensors, the projected area labels, the thirteen service
actions, and the WebSocket API.

Everything below uses actual entity ids and attribute names. Replace area ids (`living_room`, `hallway`, …) and
`binary_sensor.*` ids with your own.

Quick reference for what is available where:

| Surface                                                   | Gives you                                                                     | Usable from                                |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| `binary_sensor.topology_perimeter_open`                   | Live perimeter state, plus which openings are open and which sensors are dead | Automations, templates, dashboards         |
| `sensor.topology_house`                                   | Model completeness and household counts                                       | Automations, templates, dashboards         |
| `sensor.topology_<area>_type` / `_environment` / `_trust` | One area's annotation as an entity state (disabled by default)                | Automations, templates, dashboards         |
| Projected labels `topology:<dimension>:<value>`           | Annotation-based targeting of areas and their entities                        | Automation `target:`, templates, UI        |
| Write actions (`annotate_area`, …)                        | Writing annotations, connections, and floor levels                            | Automations, scripts                       |
| Read actions (`topology.get_*`)                           | The full model: graph, bearings, `glazed`, per-connection detail, health      | Automations, scripts, blueprints           |
| WebSocket API                                             | The same model, event-driven                                                  | Consumer scripts, browser console, add-ons |

> [!NOTE]
> Per-connection detail — the cardinal **side**, `glazed`, `passage`/`barrier` — is deliberately not projected
> onto labels and not exposed as an entity attribute, because that would put a registry entry behind every
> window in the house. It is reachable all the same: from YAML through the
> [read actions](#reading-the-model-from-an-automation), and from a consumer through the
> [WebSocket API](#reading-the-model-over-the-websocket-api).

## Perimeter automations

### Notify when a perimeter door opens at night

The single most valuable thing Topology gives you: one entity instead of a hand-maintained list of every door
and window sensor.

```yaml
automation:
  - alias: "Perimeter opened at night"
    triggers:
      - trigger: state
        entity_id: binary_sensor.topology_perimeter_open
        from: "off"
        to: "on"
    conditions:
      - condition: sun
        after: sunset
        before: sunrise
    actions:
      - action: notify.notify
        data:
          title: "Perimeter opened"
          message: >-
            {{ state_attr('binary_sensor.topology_perimeter_open', 'open_connections')
               | map(attribute='area_id') | map('area_name') | unique | join(', ') }}
```

`open_connections` is a list of objects, each with `edge_id`, `area_id`, `connection_index`, and
`source_entity` — so `map('area_name')` over the `area_id` values turns it into human-readable room names.

### Warn when the perimeter is still open at bedtime

```yaml
automation:
  - alias: "Perimeter still open at bedtime"
    triggers:
      - trigger: time
        at: "23:00:00"
    conditions:
      - condition: state
        entity_id: binary_sensor.topology_perimeter_open
        state: "on"
    actions:
      - action: notify.notify
        data:
          title: "Still open"
          message: >-
            {% set open = state_attr('binary_sensor.topology_perimeter_open', 'open_connections') %}
            {{ open | count }} of {{ state_attr('binary_sensor.topology_perimeter_open', 'monitored_count') }}
            monitored openings: {{ open | map(attribute='source_entity') | join(', ') }}
```

### Alert when a perimeter sensor stops reporting

A door sensor with a dead battery silently removes itself from the aggregate. `unavailable_sensors` makes that
visible.

```yaml
template:
  - binary_sensor:
      - name: "Perimeter sensors degraded"
        unique_id: perimeter_sensors_degraded
        device_class: problem
        state: >-
          {{ state_attr('binary_sensor.topology_perimeter_open', 'unavailable_sensors') | count > 0 }}
        attributes:
          affected: >-
            {{ state_attr('binary_sensor.topology_perimeter_open', 'unavailable_sensors') | join(', ') }}

automation:
  - alias: "Notify about degraded perimeter sensors"
    triggers:
      - trigger: state
        entity_id: binary_sensor.perimeter_sensors_degraded
        to: "on"
        for: "01:00:00"
    actions:
      - action: notify.notify
        data:
          message: >-
            Perimeter sensors not reporting:
            {{ state_attr('binary_sensor.perimeter_sensors_degraded', 'affected') }}
```

### Arm an alarm only when the perimeter is closed

```yaml
script:
  arm_away_if_secure:
    alias: "Arm away if the perimeter is closed"
    sequence:
      - choose:
          - conditions:
              - condition: state
                entity_id: binary_sensor.topology_perimeter_open
                state: "off"
            sequence:
              - action: alarm_control_panel.alarm_arm_away
                target:
                  entity_id: alarm_control_panel.home
        default:
          - action: notify.notify
            data:
              message: >-
                Not arming — still open:
                {{ state_attr('binary_sensor.topology_perimeter_open', 'open_connections')
                   | map(attribute='area_id') | map('area_name') | unique | join(', ') }}
```

## Automations from the projected labels

Enable the projection you need in the panel's **Home configuration** (or run
`topology.project_labels`). Topology then maintains area labels named `topology:<dimension>:<value>`; their
label ids are the slugified names, e.g. `topology:environment:outdoor` → `topology_environment_outdoor`.

Targeting a label in a service call expands to every entity in every area carrying it.

### Turn off all outdoor lights at sunrise

```yaml
automation:
  - alias: "Outdoor lights off at sunrise"
    triggers:
      - trigger: sun
        event: sunrise
    actions:
      - action: light.turn_off
        target:
          label_id: topology_environment_outdoor
```

### Never announce on speakers in public or shared areas

```yaml
script:
  announce_private_only:
    alias: "Announce in private areas only"
    fields:
      message:
        selector:
          text:
    sequence:
      - variables:
          exposed_areas: >-
            {{ (label_areas('topology:trust:public') | list)
               + (label_areas('topology:trust:shared') | list) }}
          speakers: >-
            {{ states.media_player
               | rejectattr('entity_id', 'in',
                            exposed_areas | map('area_entities') | sum(start=[]) | list)
               | map(attribute='entity_id') | list }}
      - action: tts.speak
        target:
          entity_id: "{{ speakers }}"
        data:
          message: "{{ message }}"
          media_player_entity_id: "{{ speakers }}"
```

### Bedroom-only night mode

With the `type` projection enabled, every bedroom is a target without naming a single entity:

```yaml
automation:
  - alias: "Bedrooms to night mode"
    triggers:
      - trigger: time
        at: "22:30:00"
    actions:
      - action: light.turn_on
        target:
          label_id: topology_type_bedroom
        data:
          brightness_pct: 10
          kelvin: 2200
```

### List the areas behind a label

```jinja
{{ label_areas('topology:environment:semi_outdoor') | map('area_name') | list }}
```

## Model-completeness automations

### Remind me which areas are still unannotated

```yaml
automation:
  - alias: "Weekly topology completeness report"
    triggers:
      - trigger: time
        at: "09:00:00"
    conditions:
      - condition: time
        weekday:
          - sun
      - condition: numeric_state
        entity_id: sensor.topology_house
        below: 100
    actions:
      - action: persistent_notification.create
        data:
          title: "Topology is {{ states('sensor.topology_house') }}% complete"
          message: >-
            {% set missing = state_attr('sensor.topology_house', 'unannotated_areas') %}
            Still unannotated ({{ missing | count }} of
            {{ state_attr('sensor.topology_house', 'area_count') }}):
            {{ missing | map('area_name') | join(', ') }}
```

### A dashboard-friendly summary sensor

```yaml
template:
  - sensor:
      - name: "Topology summary"
        unique_id: topology_summary
        state: >-
          {{ state_attr('sensor.topology_house', 'annotated_count') }}/{{
             state_attr('sensor.topology_house', 'area_count') }} areas
        attributes:
          floors: "{{ state_attr('sensor.topology_house', 'floor_count') }}"
          outdoor_areas: "{{ state_attr('sensor.topology_house', 'outdoor_area_count') }}"
          perimeter_connections: >-
            {{ state_attr('sensor.topology_house', 'perimeter_connection_count') }}
          occupancy_extent: "{{ state_attr('sensor.topology_house', 'occupancy_extent') }}"
```

### React to a per-area annotation

The per-area diagnostic sensors are disabled by default; enable the ones you want first. Their state is the
annotation value, and they carry the stable `area_id` as an attribute.

```yaml
automation:
  - alias: "Skip humidity control in outdoor areas"
    triggers:
      - trigger: state
        entity_id: sensor.topology_balcony_environment
    conditions:
      - condition: template
        value_template: "{{ states('sensor.topology_balcony_environment') != 'indoor' }}"
    actions:
      - action: humidifier.turn_off
        target:
          area_id: "{{ state_attr('sensor.topology_balcony_environment', 'area_id') }}"
```

## Driving Topology from automations

Every panel edit is also a service action, so bulk setup and re-setup can be scripted.

### Annotate several areas at once

```yaml
script:
  annotate_ground_floor:
    alias: "Annotate the ground floor"
    sequence:
      - repeat:
          for_each:
            - { area: hallway, type: hallway, environment: indoor, trust: private }
            - { area: living_room, type: living, environment: indoor, trust: private }
            - { area: kitchen, type: kitchen, environment: indoor, trust: private }
            - { area: front_yard, type: outdoor, environment: outdoor, trust: public }
          sequence:
            - action: topology.annotate_area
              data:
                area_id: "{{ repeat.item.area }}"
                type: "{{ repeat.item.type }}"
                environment: "{{ repeat.item.environment }}"
                trust: "{{ repeat.item.trust }}"
```

### Declare the ground-floor graph

```yaml
script:
  connect_ground_floor:
    alias: "Connect the ground floor"
    sequence:
      - action: topology.declare_connection
        data:
          area_a: hallway
          area_b: living_room
          preset: interior_door
      - action: topology.declare_connection
        data:
          area_a: hallway
          area_b: kitchen
          preset: open_passage
      - action: topology.declare_connection
        data:
          area_a: hallway
          area_b: upstairs_landing
          preset: open_stair
      - action: topology.declare_connection
        data:
          area_a: hallway
          area_b: front_yard
          preset: outside_door
          side: N
          sensor: binary_sensor.front_door
```

The last one is a perimeter connection the moment `hallway` is `private` and `front_yard` is `public` — no flag
to set.

> [!IMPORTANT]
> `topology.declare_connection` writes a **single-connection** bundle and replaces whatever the edge held
> before. To model a landing served by both a stair and a lift, edit the bundle in the panel.

### Declare outer walls and windows

```yaml
script:
  describe_living_room_shell:
    alias: "Describe the living room's shell"
    sequence:
      - action: topology.set_beyond
        data:
          area_id: living_room
          side: W
          beyond: outdoor
      - action: topology.set_beyond
        data:
          area_id: living_room
          side: E
          beyond: neighbor
      - action: topology.set_exterior
        data:
          area_id: living_room
          connections:
            - passage: none
              barrier: door
              side: W
              glazed: true
              sensor_entity_id: binary_sensor.living_room_window
```

Set `beyond` first: an exterior opening is only valid on a side that faces open air.

### Give an unlevelled basement a level

```yaml
action: topology.set_floor_level
data:
  floor_id: basement
  level: -1
```

The floor registry's own level always wins — this only fills a gap where none is set. `0` and negative numbers
are both legal, and Topology uses the number only for ordering.

### Enable and run the label projection

```yaml
script:
  refresh_topology_labels:
    alias: "Refresh Topology labels"
    sequence:
      - action: topology.project_labels
        data:
          scope: all
```

`scope: all` projects every dimension whose toggle is enabled. Naming a specific dimension whose toggle is off
raises a validation error instead of silently doing nothing.

### Seed annotations from what Core already knows

```yaml
action: topology.import_from_core
data:
  source: aliases
```

Fill-empty-only, and it never creates connections. Run it once; the panel's first-run card does the same thing.

## Dashboard cards

### Household overview

```yaml
type: entities
title: Topology
entities:
  - entity: sensor.topology_house
    name: Model completeness
  - entity: binary_sensor.topology_perimeter_open
    name: Perimeter
```

### What is open right now

```yaml
type: markdown
title: Open perimeter openings
content: |
  {% set open = state_attr('binary_sensor.topology_perimeter_open', 'open_connections') %}
  {% if open %}
  {% for connection in open %}
  - **{{ area_name(connection.area_id) }}** — `{{ connection.source_entity }}`
  {% endfor %}
  {% else %}
  Everything closed
  ({{ state_attr('binary_sensor.topology_perimeter_open', 'monitored_count') }} openings monitored).
  {% endif %}
```

### What still needs annotating

```yaml
type: markdown
title: Topology to-do
content: |
  {{ states('sensor.topology_house') }}% annotated
  ({{ state_attr('sensor.topology_house', 'annotated_count') }} of
  {{ state_attr('sensor.topology_house', 'area_count') }} areas).
  {% for area_id in state_attr('sensor.topology_house', 'unannotated_areas') %}
  - {{ area_name(area_id) }}
  {% endfor %}
```

### Areas grouped by trust

```yaml
type: markdown
title: Exposure
content: |
  {% for value in ['private', 'shared', 'public'] %}
  **{{ value | capitalize }}:**
  {{ label_areas('topology:trust:' ~ value) | map('area_name') | list | join(', ') or '—' }}
  {% endfor %}
```

Requires the trust projection to be enabled.

## Reading the model from an automation

Six actions return their answer instead of changing anything. They are what makes the graph, a connection's
cardinal side, the full perimeter set, and the health lists usable from YAML — none of that is an entity
attribute, and an automation cannot open a WebSocket. Call one with `response_variable:` and the result is an
ordinary variable for the rest of the automation.

They need no admin rights and write nothing, so they are safe to call from any automation, script, or template
sensor.

| Action                                    | Takes                                      | Returns                                                                                           |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `topology.get_neighbors`                  | `area_id`                                  | `neighbors[]` with `edge_id`, `axis`, `level_delta`, `is_perimeter`, `traversable`                |
| `topology.get_path`                       | `from_area`, `to_area`, `traversable_only` | `path[]`, `hops` (`-1` when unreachable), `distance` (hops plus every storey change)              |
| `topology.get_perimeter`                  | —                                          | Every perimeter connection open or not, plus `count` and `monitored_count`                        |
| `topology.get_connections_facing_outdoor` | optional `side[]`, `glazed_only`           | Openings proven to face open air with `side`, `passage`, `barrier`, `glazed`; plus `area_ids`     |
| `topology.get_health`                     | —                                          | The completeness/consistency signal with every list behind the repair cards                       |
| `topology.get_model`                      | —                                          | The whole readable model — areas with `beyond` and exterior connections, edges with their bundles |

> [!NOTE]
> `get_path` calls its endpoints `from_area` / `to_area`, not `from` / `to` like the WebSocket command:
> `from` is a Jinja keyword, so `{{ result.from }}` would not parse.

### Close the covers on the sunny side

The query that used to require the browser console. `area_ids` is the deduplicated area list, ready to target:

```yaml
actions:
  - action: topology.get_connections_facing_outdoor
    data:
      side: [W]
      glazed_only: true
    response_variable: west
  - action: cover.close_cover
    target:
      area_id: "{{ west.area_ids }}"
```

The shipped `sun_side_covers.yaml` blueprint is this, plus a guard that skips any area with an opening standing
open.

### Refuse to arm while part of the envelope is unobservable

`get_perimeter` returns the whole perimeter, not just what is open, so an automation can tell "everything is
closed" from "I cannot see everything":

```yaml
actions:
  - action: topology.get_perimeter
    response_variable: perimeter
  - condition: template
    value_template: "{{ perimeter.count == perimeter.monitored_count }}"
  - action: alarm_control_panel.alarm_arm_away
    target:
      entity_id: alarm_control_panel.house
```

The same numbers are on `binary_sensor.topology_perimeter_open` as `monitored_connections` and
`monitored_count` when you want them without a service call.

### Warn when the model has drifted

```yaml
triggers:
  - trigger: time
    at: "09:00:00"
actions:
  - action: topology.get_health
    response_variable: health
  - condition: template
    value_template: "{{ health.status != 'ok' }}"
  - action: notify.persistent_notification
    data:
      message: >-
        Topology needs a look: {{ health.isolated_areas | count }} isolated area(s),
        {{ health.contradictory_bearings | count }} contradictory bearing(s),
        {{ health.unannotated_areas | count }} unannotated.
```

### How far is the nursery from the front door

```yaml
actions:
  - action: topology.get_path
    data:
      from_area: nursery
      to_area: hallway
      traversable_only: true
    response_variable: route
  - condition: template
    value_template: "{{ route.path is not none and route.distance <= 3 }}"
```

`distance` counts every storey the route changes on top of the hops, so a landing two floors up does not look
as near as the room next door.

## Reading the model over the WebSocket API

Everything the panel shows is available to consumers over Home Assistant's WebSocket connection. All commands
need an authenticated connection; the read commands below need no admin rights.

| Command                               | Payload                                   | Returns                                                                                                |
| ------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `topology/read_hook`                  | —                                         | `api_version`, `home` (extent + floors), `areas`, `edges`, `perimeter`, `health`                       |
| `topology/health`                     | —                                         | Just the completeness/consistency signal                                                               |
| `topology/neighbors`                  | `area_id`                                 | `neighbors[]` with `edge_id`, `axis`, `level_delta`, `is_perimeter`, `traversable`                     |
| `topology/path`                       | `from`, `to`, optional `traversable_only` | `path[]` of area ids and `hops` (`-1` when unreachable)                                                |
| `topology/connections_facing_outdoor` | —                                         | Every opening proven to face open air, with `side`, `passage`, `barrier`, `glazed`, `sensor_entity_id` |
| `topology/subscribe_updates`          | —                                         | Change events, so a consumer re-fetches instead of polling                                             |

### Try it from the browser console

With the Home Assistant UI open, this runs against your live instance:

```js
const conn = (await window.hassConnection).conn;

// The whole model
console.log(await conn.sendMessagePromise({ type: "topology/read_hook" }));

// Which openings face open air, and which way
console.log(await conn.sendMessagePromise({ type: "topology/connections_facing_outdoor" }));

// Who borders the hallway
console.log(await conn.sendMessagePromise({ type: "topology/neighbors", area_id: "hallway" }));

// How far is the garage from the nursery, walking only
console.log(
  await conn.sendMessagePromise({
    type: "topology/path",
    from: "nursery",
    to: "garage",
    traversable_only: true
  })
);
```

### West-facing openings before sunset

The consumer-side form of the query. Inside Home Assistant, prefer
[`topology.get_connections_facing_outdoor`](#close-the-covers-on-the-sunny-side) — it does the filtering and
the deduplication for you.

```js
const conn = (await window.hassConnection).conn;
const { connections } = await conn.sendMessagePromise({
  type: "topology/connections_facing_outdoor"
});

const westGlazed = connections.filter((c) => c.side === "W" && c.glazed);
console.log(westGlazed.map((c) => c.area_id));
```

### A consumer script

```python
"""Print every area that borders an outdoor area, plus the health signal."""

import asyncio
import json

import aiohttp

HA_URL = "ws://homeassistant.local:8123/api/websocket"
TOKEN = "<long-lived access token>"


async def main() -> None:
    async with aiohttp.ClientSession() as session, session.ws_connect(HA_URL) as ws:
        await ws.receive_json()  # auth_required
        await ws.send_json({"type": "auth", "access_token": TOKEN})
        await ws.receive_json()  # auth_ok

        await ws.send_json({"id": 1, "type": "topology/read_hook"})
        result = (await ws.receive_json())["result"]

        print("api_version:", result["api_version"])
        print("health:", json.dumps(result["health"], indent=2))

        outdoor = {
            area["area_id"] for area in result["areas"] if area["environment"] == "outdoor"
        }
        for edge in result["edges"]:
            if (edge["area_a"] in outdoor) != (edge["area_b"] in outdoor):
                print("borders outdoor:", edge["edge_id"], edge["axis"])


asyncio.run(main())
```

Points worth knowing when writing a consumer:

- An unannotated dimension is returned as `null`, never as a default. Treat `null` as "unknown".
- `axis` is `horizontal`, `vertical`, or `unknown` (at least one side has no resolvable floor level).
  `level_delta` adds direction: positive means the far side is above.
- `perimeter` entries carry `source` (`edge` or `exterior`), `area_id`, `connection_index`, and
  `sensor_entity_id` — which may be `null` when nothing is bound yet.
- `health.status` is `ok` or `warning`; the lists beside it (`unannotated_areas`, `isolated_areas`,
  `orphaned_edges`, `contradictory_bearings`, …) say what is incomplete, so a consumer can degrade gracefully
  without re-implementing Topology's checks.
- Subscribe to `topology/subscribe_updates` and re-fetch on each event instead of polling.

## Shipped blueprints

Four automation blueprints ship in the repository under `blueprints/automation/topology/`. Copy the folder into
your own `config/blueprints/automation/topology/` and reload automations, then create an automation from the
blueprint as usual.

| Blueprint                       | What it does                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `perimeter_open_at_night.yaml`  | Notifies when the derived perimeter opens inside a time window, with a grace delay and a dead-sensor guard.              |
| `perimeter_arming.yaml`         | Arms an alarm panel once everybody has left and the perimeter is closed; names the rooms holding it open when it is not. |
| `sun_side_covers.yaml`          | Closes covers in the areas facing the setting sun — resolved live via `topology.get_connections_facing_outdoor`.         |
| `ventilation_coordination.yaml` | Pauses mechanical ventilation while the envelope is open and resumes it once closed.                                     |

None of them needs the per-area sensors or the label projection turned on: three read only the two
always-enabled entities, and `sun_side_covers.yaml` additionally calls `topology.get_connections_facing_outdoor`,
which is available to everyone. Every one refuses to act — and says so — when `monitored_count` is `0`, because
nothing is bound yet.

### What a blueprint can and cannot see

Several things Topology models are deliberately **not** on any entity, to keep the entity registry small: a
connection's cardinal `side` and `glazed` flag, its `passage`/`barrier` pair, the adjacency graph, and every
health list except `unannotated_areas`. That is a decision about the entity registry, not about access — all
of it is reachable from a blueprint through the [read actions](#reading-the-model-from-an-automation), which is
how `sun_side_covers.yaml` resolves the sun-facing areas on every run instead of asking you to paste a list in.

What is still out of a blueprint's reach:

| Not reachable                                | Why                                                                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Per-connection detail as a **trigger**       | The read actions are pull-only. Trigger on `binary_sensor.topology_perimeter_open` or a time, then query.                          |
| A per-area annotation as an **entity state** | Only if you enable the per-area sensors or the label projection, both off by default — so a shipped blueprint cannot depend on it. |
| Live change notifications                    | `topology/subscribe_updates` is WebSocket-only; from YAML, re-query when you need the answer.                                      |

None of the four shipped blueprints depends on an opt-in surface. `sun_side_covers.yaml` is the only one that
calls a read action; the other three work from the perimeter entity's attributes alone.

## Related documentation

- [Getting Started](./GETTING_STARTED.md) — install, set up, and annotate your first room
- [Configuration Reference](./CONFIGURATION.md) — every dimension, the preset table, and every repair issue
- [GitHub Issues](https://github.com/jpawlowski/hass.topology/issues) — report problems
