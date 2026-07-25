# Topology

[![GitHub Activity][commits-shield]][commits]
[![License][license-shield]](LICENSE)

[![hacs][hacsbadge]][hacs]
![Project Maintenance][maintenance-shield]

> [!IMPORTANT]
> **Pre-release.** `manifest.json` is at version `0.1.0`, there is no tagged release yet, and the repository is
> not listed in the HACS default store. Install it as a HACS **custom repository** (or manually) and expect
> breaking changes until `1.0.0`. See [`docs/development/DECISIONS.md`](docs/development/DECISIONS.md)
> ("Release Strategy") for the release plan.

## What Topology is

Home Assistant knows _which_ areas and floors exist, but nothing _about_ them. An area has no type, no
indoor/outdoor flag, and no notion of which areas border each other — so every spatial automation ends up
hard-coding entity lists by hand.

Topology is a thin, machine-readable metadata layer on top of Home Assistant's **own area and floor
registries**. It makes the home describable to automations: **a floorplan for automations, not for humans.**

- It **consumes, never rebuilds** the registries. It never creates areas or floors — it only annotates the
  ones you already have, keyed on Core's `area_id` and `floor_id`.
- It is a **helper** integration (`integration_type: helper`, `iot_class: calculated`). It polls nothing,
  talks to no device, and contacts no cloud service. All data stays in Home Assistant's own storage.
- There is **one config entry** and **nothing to fill in** when adding it. Everything is edited afterwards in
  the **Topology** panel in the sidebar.

## What you can build with it

Topology is not an end in itself — it is the data layer that removes hard-coded entity lists from automations:

- **Perimeter alerting.** `binary_sensor.topology_perimeter_open` turns on when any door or window on the
  boundary of your private space is open. Point a night-time or away-mode notification at that one entity
  instead of maintaining a list of every door sensor.
- **Orientation-aware covers and lighting.** Ask Topology which openings face west and close those covers
  before sunset — no per-room entity list, no renaming discipline.
- **Room-adjacency logic.** "Is the hallway next to the bedroom?", "how many hops from the kitchen to the
  garage?", "which areas are on the floor above the nursery?" — answered from the adjacency graph.
- **Outdoor-aware automations.** Target every `outdoor` area as a first-class group (retract awnings, skip
  indoor-only occupancy logic, throttle ventilation while a door to the outside is open).
- **Feeding other integrations.** The perimeter set is a drop-in replacement for hand-maintained sensor lists
  in alarm panels; sister projects (Residents, courier) read the model over a versioned WebSocket contract.

Runnable versions of these live in [`docs/user/EXAMPLES.md`](docs/user/EXAMPLES.md).

## Concepts at a glance

| Concept                  | What it records                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Area type**            | What a room is for — `bedroom`, `kitchen`, `hallway`, … 13 shipped defaults, and any other string you like. A descriptive hint.          |
| **Environment**          | `indoor` · `outdoor` · `semi_outdoor`. A balcony is a real area but a fundamentally different kind of space than a room.                 |
| **Trust**                | How exposed a space is: `private` < `shared` < `public`. Ordered, and orthogonal to environment (a back garden is outdoor + private).    |
| **Beyond**               | Per outer-wall side (N/E/S/W): what lies on the other side — `outdoor` (open air), `neighbor` (party wall), `earth` (buried wall).       |
| **Exterior connections** | The windows and outside doors of an area, optionally with a bound `binary_sensor`.                                                       |
| **Edge**                 | An undirected adjacency between two of your areas. An edge is a **bundle**: a landing can hold both a stair and a lift.                  |
| **Connection**           | One physical way across a boundary: a `passage` (none/level/stairs/ramp/elevator/ladder/hatch) × a `barrier` (open/door/solid).          |
| **Preset**               | The friendly name you actually pick — "Interior door", "Open stair", "Lift" … — which expands to a passage + barrier pair.               |
| **Floor level**          | The storey number Home Assistant already stores on each floor. Topology only uses it for ordering, and can supply one where it is unset. |

Everything below is **derived on the fly and never stored**:

- whether a wall is interior (it borders another of your areas) or exterior (it has a `beyond` class);
- whether a connection is **horizontal or vertical** — from the floor levels of the two areas;
- the **perimeter**: every boundary where the trust class changes. This is the security hook, and it falls out
  of the model instead of being a list you maintain;
- the adjacency graph, neighbor lists, and shortest paths between areas.

## Installation

**Requirements:** Home Assistant **2026.7.0** or newer. No Python dependencies, no external service.

### Via HACS (custom repository)

Topology is not in the HACS default store yet, so add it as a custom repository:

1. Open **HACS** → **Integrations**.
2. Three-dot menu → **Custom repositories**.
3. Repository: `https://github.com/jpawlowski/hass.topology`, Category: **Integration** → **Add**.
4. Find **Topology** in the list and click **Download**.
5. **Restart Home Assistant.**

The button below opens the repository dialog in your own instance:

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=jpawlowski&repository=hass.topology&category=integration)

<details>
<summary><strong>Manual installation</strong></summary>

1. Copy the `custom_components/topology/` folder from this repository into your Home Assistant
   configuration's `custom_components/` directory.
2. Restart Home Assistant.

</details>

## Setting it up

1. Go to **Settings** → **Devices & Services** → **+ Add Integration** → **Topology**.
2. Click **Submit**. There are **no fields**: the step only verifies that the area registry is readable and
   the Topology store loads, then creates the single config entry.
3. Open **Topology** in the sidebar (admin only). The integration tile's **Configure** button opens the same
   panel — there is no options dialog.
4. On first run the panel offers a **one-shot import** from your existing area aliases or labels. It only
   fills in annotations that are still empty and never overwrites anything. Skipping it costs nothing.
5. Annotate your areas, then declare the connections between them.

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=topology)

Step-by-step, end to end: [`docs/user/GETTING_STARTED.md`](docs/user/GETTING_STARTED.md).

## Entities

| Entity                                  | Kind          | Enabled by default | What it tells you                                                             |
| --------------------------------------- | ------------- | ------------------ | ----------------------------------------------------------------------------- |
| `sensor.topology_house`                 | sensor        | Yes                | How complete the model is: percent of registry areas that carry an annotation |
| `binary_sensor.topology_perimeter_open` | binary sensor | Yes                | `on` when any **bound** perimeter door/window sensor reads open (`opening`)   |
| `sensor.topology_<area>_type`           | sensor        | No (diagnostic)    | That area's `type` annotation                                                 |
| `sensor.topology_<area>_environment`    | sensor        | No (diagnostic)    | That area's `environment` annotation                                          |
| `sensor.topology_<area>_trust`          | sensor        | No (diagnostic)    | That area's `trust` annotation                                                |

`sensor.topology_house` carries the household counts as attributes: `occupancy_extent`, `area_count`,
`annotated_count`, `unannotated_areas`, `perimeter_connection_count`, `outdoor_area_count`, `floor_count`.

`binary_sensor.topology_perimeter_open` carries `open_connections`, `open_count`, `monitored_count` and
`unavailable_sensors`. It only sees connections that have a `binary_sensor` bound to them, so it stays `off`
until you bind at least one door or window.

The per-area sensors are **disabled by default** — enable the ones you want to target from a dashboard or
automation. Individual connections and outer walls deliberately get no entities: they are read through the
WebSocket API and the panel instead, so the entity registry does not grow with every door.

## Service actions

| Action                        | What it does                                                               |
| ----------------------------- | -------------------------------------------------------------------------- |
| `topology.annotate_area`      | Set an area's `type`, `environment`, and/or `trust`                        |
| `topology.declare_connection` | Create or replace the connection between two areas from a named preset     |
| `topology.set_beyond`         | Record what lies beyond one outer-wall side of an area                     |
| `topology.set_exterior`       | Replace an area's list of windows and outside doors                        |
| `topology.set_floor_level`    | Supply (or clear) a level for a floor whose registry level is unset        |
| `topology.project_labels`     | Run the opt-in label projection now                                        |
| `topology.import_from_core`   | One-shot seed of annotations from area aliases or labels (fill-empty-only) |

Field-by-field reference: [`docs/user/CONFIGURATION.md`](docs/user/CONFIGURATION.md).

## Label projection (opt-in)

With a dimension enabled in the panel's home configuration, Topology writes `topology:<dimension>:<value>`
labels onto your areas in Home Assistant Core — `topology:trust:public`, `topology:environment:outdoor`,
`topology:type:bedroom`. Core label features (automation targets, UI filters, voice) can then use the model
without going through Topology at all. The projection is one-way, only touches labels Topology created, and
is fully reversible while the integration is installed.

## Health, repairs, and diagnostics

Topology checks its own data and raises Home Assistant **repair issues** when something is inconsistent —
too many unannotated areas, an area with no connection at all, an indoor area with no floor, contradictory
wall bearings, an exterior opening that cannot physically be where it is, orphaned entries left behind by a
deleted area, and store-version problems. Each card deep-links into the matching panel view. The same data is
available machine-readably over the WebSocket API, and the full model ships in
**Download diagnostics** (with area, floor, and sensor ids pseudonymized).

## For consumers

Automations, templates, and other integrations read the model over a versioned WebSocket API (`api_version: 1`):

| Command                               | Returns                                                                |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `topology/read_hook`                  | The whole model: home, floors, areas, edges, derived perimeter, health |
| `topology/health`                     | Just the completeness/consistency signal                               |
| `topology/neighbors`                  | An area's neighbors, with axis, level delta, and perimeter flag        |
| `topology/path`                       | Shortest hop path between two areas                                    |
| `topology/connections_facing_outdoor` | Every opening proven to face open air, with its side and bound sensor  |
| `topology/subscribe_updates`          | Change notifications, so a consumer re-fetches instead of polling      |

All commands need an authenticated connection; every write command additionally requires an admin user.

## Known limitations

- **Connections are declared by hand.** Nothing is discovered or inferred: you tell Topology which areas
  border each other. The one-shot import seeds annotations only, never the graph.
- **No 3D house view yet.** The panel renders one schematic 2D map per floor. Stacking the floors into one
  orbitable house is planned, not shipped.
- **No Lovelace card yet.** The map lives in the admin panel; a read-only dashboard card for non-admin
  household members is planned.
- **`barrier` does not drive sound or air propagation yet.** The `open`/`door`/`solid` distinction is stored
  and exposed, but Topology itself derives no quiet grading or ventilation model from it — consumers do.
- **No coordinate geometry.** No room shapes, sizes, or x/y/z positions, by design. A cardinal side is a
  rough direction label, not a measurement.
- **One config entry per Home Assistant instance**, and no YAML configuration.
- **Projected labels survive uninstalling** Topology, by design (they live in the Core registry). Delete them
  manually if you do not want them left behind.

## Troubleshooting

- **Panel missing from the sidebar?** It is admin-only. Confirm your user is an administrator, then reload
  the integration.
- **`binary_sensor.topology_perimeter_open` never turns on?** It only watches connections that have a
  `binary_sensor` bound. Open a connection in the panel and bind the door or window sensor.
- **Something looks inconsistent?** Check **Settings** → **System** → **Repairs**; Topology explains the
  problem there and links to the view where you fix it.
- **Debug logging:**

  ```yaml
  logger:
    default: info
    logs:
      custom_components.topology: debug
  ```

More: the troubleshooting section of [`docs/user/CONFIGURATION.md`](docs/user/CONFIGURATION.md).

## Documentation

- [Getting Started](docs/user/GETTING_STARTED.md) — install, set up, annotate your first room, connect two rooms
- [Configuration Reference](docs/user/CONFIGURATION.md) — every annotation dimension, the preset table, label
  projection, and every repair issue
- [Examples](docs/user/EXAMPLES.md) — runnable automations, templates, and scripts
- [Development docs](docs/development/) — architecture, decisions, and the plans that define the model

## Contributing

Contributions are welcome! Please open an issue or pull request if you have suggestions or improvements.

You have two options to set up a development environment — expand below for full details.

<details>
<summary><strong>Development Setup</strong></summary>

Both options provide the same fully-configured environment with Home Assistant, Python 3.14, Node.js LTS, and all necessary tools.

### Option 1: GitHub Codespaces (Recommended) ☁️

Develop directly in your browser without installing anything locally!

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/jpawlowski/hass.topology?quickstart=1)

1. Click the green **"Code"** button in this repository
2. Switch to the **"Codespaces"** tab
3. Click **"Create codespace on main"**
4. **Wait for setup** (2-3 minutes first time) — everything installs automatically
5. **Review and commit** your changes in the Source Control panel (`Ctrl+Shift+G`)

> [!TIP]
> Codespaces gives you **60 hours/month free** for personal accounts. When you start Home Assistant (`script/develop`), port 8123 forwards automatically.

### Option 2: Local Development with VS Code 💻

#### Prerequisites

You'll need these installed locally:

- **A Docker-compatible container engine** — see options by platform:

  | Option                                                                                                                   | 🍎 macOS | 🐧 Linux | 🪟 Windows | Notes                                                                                                                                                                                                                                     |
  | ------------------------------------------------------------------------------------------------------------------------ | :------: | :------: | :--------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | [Docker Desktop](https://www.docker.com/products/docker-desktop/)                                                        |    ✅    |    ✅    |     ✅     | **Easiest starting point for all platforms.** GUI-based, well-documented, one installer. Uses WSL2 as default backend on Windows (Hyper-V also available). Installation requires admin rights; daily use does not. Free for personal use. |
  | [OrbStack](https://orbstack.dev/) ⭐                                                                                     |    ✅    |    —     |     —      | **Recommended for macOS** once Docker Desktop feels slow. Starts in ~2s, much lighter on RAM/CPU, full Docker API compatibility. Free for personal use.                                                                                   |
  | [Docker CE](https://docs.docker.com/engine/install/) (native) ⭐                                                         |    —     |    ✅    |     —      | **Recommended for Linux.** Install directly via your package manager — no VM, no GUI, no overhead. Free.                                                                                                                                  |
  | [WSL2](https://learn.microsoft.com/windows/wsl/install) + [Docker CE](https://docs.docker.com/engine/install/ubuntu/) ⭐ |    —     |    —     |     ✅     | **Recommended for Windows** once you're comfortable with WSL2. Docker runs natively inside WSL2 — no GUI overhead. Requires one-time WSL2 setup. Free.                                                                                    |
  | [Rancher Desktop](https://rancherdesktop.io/)                                                                            |    ✅    |    ✅    |     ✅     | Open source by SUSE. GUI-based, uses WSL2 on Windows. Good alternative to Docker Desktop. Free.                                                                                                                                           |
  | [Colima](https://github.com/abiosoft/colima)                                                                             |    ✅    |    ✅    |     —      | CLI-only, very lightweight. Good for terminal-focused workflows. Free.                                                                                                                                                                    |

- **VS Code** with the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
- **Git** — macOS and Linux usually have it already; see below if not, or to get a newer version:
  - **🍎 macOS:** The system Git (`xcode-select --install`) works fine. Recommended: `brew install git` ([Homebrew](https://brew.sh/)) for a current version.
  - **🐧 Linux:** Usually pre-installed. If not: `sudo apt install git` (or your distro's equivalent).
  - **🪟 Windows + WSL2 ⭐:** Install Git _inside WSL2_ with `sudo apt install git`. Git on Windows itself is not needed — VS Code clones and operates entirely within WSL2.
  - **🪟 Windows + Docker Desktop:** Install via `winget install Git.Git` or download [Git for Windows](https://git-scm.com/download/win).
- **Hardware** — the devcontainer runs a full Home Assistant instance including Python tooling:

  |          | Minimum    | Recommended                           |
  | -------- | ---------- | ------------------------------------- |
  | **RAM**  | 8 GB       | 16 GB or more                         |
  | **CPU**  | 4 cores    | 8 cores or more                       |
  | **Disk** | 10 GB free | 20 GB free (SSD strongly recommended) |

> [!TIP]
> **Not sure which Docker option to pick?** Start with [Docker Desktop](https://www.docker.com/products/docker-desktop/) — it works on all platforms, has a GUI, and needs no extra setup. The ⭐ options are faster alternatives once you're comfortable. macOS and Linux offer the best devcontainer experience — containers run with no extra VM layer and file I/O is fast. Windows works well too; this integration uses named container volumes (files live inside WSL2, not on the Windows drive) to keep performance acceptable.

> [!NOTE]
> **New to Dev Containers?** See the [VS Code Dev Containers documentation](https://code.visualstudio.com/docs/devcontainers/containers#_system-requirements) for system requirements and how to install the extension. **Once the extension is installed, you're done** — this repository already ships a complete devcontainer configuration. You don't need to follow the rest of the VS Code guide; the setup steps below are all that's needed.

#### Setup Steps

1. **Clone in a Dev Container:**

   **🍎 macOS / 🐧 Linux:** Clone the repository and open the folder in VS Code → click **"Reopen in Container"** when prompted (or `F1` → **"Dev Containers: Reopen in Container"**).

   **🪟 Windows:** In VS Code, press `F1` → **"Dev Containers: Clone Repository in Named Container Volume..."** and enter the repository URL. This keeps files inside WSL2 for best I/O performance.

2. Wait for the container to build (2-3 minutes first time)

3. **Review and commit** changes in Source Control (`Ctrl+Shift+G`)

4. **Start developing**:

   ```bash
   script/develop  # Home Assistant runs at http://localhost:8123
   ```

> [!NOTE]
> Both Codespaces and local DevContainer provide the exact same experience. The only difference is where the container runs (GitHub's cloud vs. your machine).

</details>

---

## 🤖 AI-Assisted Development

> [!NOTE]
> **Transparency Notice:** This integration was developed with assistance from AI coding agents (GitHub Copilot, Claude, and others). While the codebase follows Home Assistant Core standards, AI-generated code may not be reviewed or tested to the same extent as manually written code. AI tools were used to generate boilerplate code, implement standard integration features (config flow, coordinator, entities), ensure code quality and type safety, and write documentation. If you encounter unexpected behavior, please [open an issue](../../issues) on GitHub.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ by [@jpawlowski][user_profile]**

---

[commits-shield]: https://img.shields.io/github/commit-activity/y/jpawlowski/hass.topology.svg?style=for-the-badge
[commits]: https://github.com/jpawlowski/hass.topology/commits/main
[hacs]: https://github.com/hacs/integration
[hacsbadge]: https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge
[license-shield]: https://img.shields.io/github/license/jpawlowski/hass.topology.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-%40jpawlowski-blue.svg?style=for-the-badge
[user_profile]: https://github.com/jpawlowski
