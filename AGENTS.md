# AI Agent Instructions

This document provides guidance for AI coding agents working on this Home Assistant custom integration project.

## Project Overview

Topology is a Home Assistant custom integration that adds a **metadata layer over the HA area and floor registries**. It consumes, never rebuilds, those registries: it does not define areas or floors, it annotates the ones Core already knows about and makes the house machine-readable for automations.

**What it provides:**

- **Area annotations** — `type` (open catalog: bedroom, kitchen, hallway, garage, terrace, …), `environment` (`indoor` · `outdoor` · `semi_outdoor`), `trust` / exposure class (`private` < `shared` < `public`), plus per-floor level numbers.
- **Adjacency graph** — user-maintained edges between areas with named connection presets (doors, windows, passages) and `beyond` classifications for edges that leave the house.
- **Derived data** — the **perimeter** (which connections face the outside), neighbor and shortest-path queries, and a health/consistency signal. All derivations are computed on read (`entity_utils/derivations.py`, `entity_utils/graph.py`), never persisted.
- **Admin panel** — a Lit web component written in TypeScript under `frontend/`, bundled by esbuild into `custom_components/topology/panel/`. The panel is the primary editing surface for annotations and the graph.
- **WebSocket API** — the frozen `topology/*` command contract in `websocket_api.py`, used by the panel and by external consumers (e.g. the sister project Residents).
- **Entities** — a household summary sensor, a perimeter binary sensor, and opt-in per-area diagnostic sensors (see the ADR "Entity Model").

**What topology deliberately is _not_ — do not reintroduce these patterns:**

- ❌ **No external service, no API client.** There is no `api/` package, no HTTP client, and no runtime dependency. `iot_class: calculated`.
- ❌ **No polling.** The coordinator is a thin event-fanout coordinator over `area_registry_updated` / `floor_registry_updated`; it has no `_async_update_data`, no update interval, no retry logic. See ADR "Coordinator Role: Event Fanout, Not Polling".
- ❌ **No devices.** Entities are registry-driven and provide no `device_info` (Quality-Scale `devices` rule is N/A).
- ❌ **No discovery, no reauth.** The config flow is a confirm-only singleton (`single_config_entry: true`) with no credentials and no settings fields.

**Integration details:**

- **Domain:** `topology`
- **Title:** Topology
- **Repository:** jpawlowski/hass.topology
- **Manifest:** `integration_type: helper`, `iot_class: calculated`, `single_config_entry: true`, `quality_scale: platinum` (self-declared goal)

**Key directories:**

- `custom_components/topology/` - Main integration code
- `custom_components/topology/panel/` - **Generated** panel bundle — never hand-edit; rebuild with `script/frontend`
- `frontend/` - Panel source (TypeScript + Lit, esbuild config, Vitest tests)
- `config/` - Home Assistant configuration for local testing
- `tests/` - Unit and integration tests (pytest)
- `script/` - Development and validation scripts
- `docs/development/` - Plans and decisions: `PLAN-topology.md` is the interface contract, `DECISIONS.md` the ADR log

**Local Home Assistant instance:**

**Always use the project's scripts** — do NOT craft your own `hass`, `pip`, `pytest`, or similar commands. The scripts handle environment setup, virtual environments, port management, and cleanup that raw commands miss. Agents that bypass scripts frequently break.

**Devcontainer CLI tools:** The devcontainer provides common agent-facing CLI tools including `bat`, `delta`/`git-delta`, `eza`, `fd`/`fdfind`, `fzf`, `http`/`httpie`, `hyperfine`, `ipython`, `jq`, `jo`, `mlr`/`miller`, `rg`/`ripgrep`, `shellcheck`, `shfmt`, `sponge`, `sqlite3`, `tree`, `yq`, and `yamllint`. Prefer these explicit container tools over assuming a VS Code extension exposes an equivalent CLI on `PATH`.

**CLI compatibility notes:** Some commands are available via compatibility aliases because Debian package names differ from what agents often expect. Prefer `bat`, `fd`, `git-delta`, `httpie`, `ipython`, `miller`, and `ripgrep` as stable spellings. `yq` is installed as the Mike Farah variant, so standard `yq eval`/`yq e` syntax is expected.

**Claude Code cloud sandboxes:** `.claude/hooks/session-start.sh` automatically brings a Claude Code on the web / cloud sandbox session as close to the devcontainer as practical (apt package parity, then `script/setup/setup`) before the first turn starts. It only runs when `CLAUDE_CODE_REMOTE=true` — local usage (CLI, VS Code extension, devcontainer) is unaffected. Don't re-solve environment setup ad hoc in a cloud session; if something is still missing, fix the hook instead.

The hook re-runs on every resume, not just fresh sessions, so it fingerprints the files that would change its outcome (`pyproject.toml`, `hacs.json`, `.devcontainer/.env*`, `requirements*.txt`, `package*.json`, itself) and skips straight past apt/uv/bootstrap when nothing changed and the venv is still intact — see the marker check near the top of the script. If you're debugging "the hook didn't pick up my change," check whether the changed file is in that fingerprint list.

For a cloud environment's **Setup script** field (configured in the Claude Code web UI, not in this repo — see [docs](https://code.claude.com/docs/en/claude-code-on-the-web#setup-scripts)), point it at the same hook so its filesystem cache and the hook's own marker agree: `CLAUDE_CODE_REMOTE=true bash .claude/hooks/session-start.sh`. This is optional — the hook alone is sufficient — but it moves the first, slowest run out of session startup and into the cached environment build.

**Start Home Assistant:**

```bash
./script/develop
```

**Force restart (when HA is unresponsive or port conflicts):**

```bash
pkill -f "hass --config" || true && pkill -f "debugpy.*5678" || true && ./script/develop
```

- Kills any existing instance (hass + debugpy on port 5678) and starts fresh
- Avoids state confusion and port conflicts

**When to restart:** After modifying Python files, `manifest.json`, `services.yaml`, translations, or config flow changes

**Reading logs:**

- Live: Terminal where `./script/develop` runs
- File: `config/home-assistant.log` (most recent), `config/home-assistant.log.1` (previous)

**Adjusting log levels:**

- Integration logs: `custom_components.topology: debug` in `config/configuration.yaml`
- You can modify log levels when debugging - just restart HA after changes

**Context-specific instructions:**

If you're using GitHub Copilot, path-specific instructions in `.github/instructions/*.instructions.md` provide additional guidance for specific file types (Python, YAML, JSON, etc.). This document serves as the primary reference for all agents.

**Other agent entry points:**

- **Claude Code:** See [`CLAUDE.md`](CLAUDE.md) (pointer to this file)
- **ChatGPT Codex:** See [`CODEX.md`](CODEX.md) (pointer to this file)
- **Gemini:** See [`GEMINI.md`](GEMINI.md) (pointer to this file)
- **GitHub Copilot:** See [`.github/copilot-instructions.md`](.github/copilot-instructions.md) (compact version of this file)

## Working With Developers

**For workflow basics (small changes, translations, tests, session management):** See `.github/copilot-instructions.md` for quick-reference guidance.

### When Instructions Conflict With Requests

If a developer requests something that contradicts these instructions:

1. **Clarify the intent** - Ask if they want you to deviate from the documented guidelines
2. **Confirm understanding** - Restate what you understood to avoid misinterpretation
3. **Suggest instruction updates** - If this represents a permanent change in approach, offer to update these instructions
4. **Proceed once confirmed** - Follow the developer's explicit direction after clarification

### Maintaining These Instructions

**Parts of this file still originate from the blueprint template it was generated from.** Instructions should evolve as the project matures — when you hit generic blueprint guidance that contradicts the real code, fix it here instead of working around it:

- Refine guidelines based on actual project needs
- Remove outdated rules that no longer apply
- Consolidate redundant sections to prevent bloat
- Keep files focused - Move architectural decisions to `docs/development/`

**Propose updates when:**

- You notice repeated deviations from documented patterns
- Instructions become outdated or contradict actual code
- New patterns emerge that should be standardized

### Documentation vs. Instructions

**Three types of content with clear separation:**

1. **Agent Instructions** - How AI should write code (`.github/instructions/`, `AGENTS.md`)
2. **Developer Documentation** - Architecture and design decisions (`docs/development/`)
3. **User Documentation** - End-user guides (`docs/user/`)

**AI Planning:** Use `.ai-scratch/` for temporary notes (never committed)

**Rules:**

- ❌ **NEVER** create random markdown files in code directories
- ❌ **NEVER** create documentation in `.github/` unless it's a GitHub-specified file
- ✅ **ALWAYS ask first** before creating permanent documentation
- ✅ **Prefer module docstrings** over separate markdown files

See `.github/copilot-instructions.md` for detailed documentation strategy.

### Session and Context Management

**Commit suggestions:**

When a task completes and the developer moves to a new topic, suggest committing changes. Offer a commit message based on the work done.

**Commit rules (CRITICAL):**

- **Never commit automatically** — only commit when the developer explicitly requests it
- A previous commit request is NOT a standing permission; each commit requires a fresh explicit instruction
- **Never ask about pushing** — the developer always handles `git push` themselves; do not offer or suggest it

**Commit message format:** Follow [Conventional Commits](https://www.conventionalcommits.org/) — see `.github/instructions/blueprint.commit-message.instructions.md` for full conventions, types, scopes, and examples.

## Custom Integration Flexibility

**This is a CUSTOM integration, not a Home Assistant Core integration.** While we follow Core patterns for quality and maintainability, we have more flexibility in implementation decisions:

**Third-party libraries (PyPI):**

> **Status for topology:** the integration has **zero runtime dependencies** and talks to no external service (`dependency-transparency` is satisfied by having nothing to declare). The guidance below applies only if a future feature genuinely needs an external service — adding a dependency requires an ADR in `docs/development/DECISIONS.md` first.

- ✅ Prefer existing PyPI libraries when maintained and fit the use case
- ✅ Build a custom client only when:
  - The service uses a simple REST API or GraphQL (HTTP, JSON)
  - Available libraries are unmaintained, bloated, or poorly designed
  - Using aiohttp + json is more maintainable than a framework

**Decision process:**

1. Research available libraries (PyPI, GitHub)
2. Evaluate: Maintained? Async? Well-documented? Dependency footprint?
3. Consider protocol: Simple REST → aiohttp; Complex OAuth2 → library; Standard (MQTT) → industry library
4. Document decision in `docs/development/DECISIONS.md`

**Quality Scale expectations:**

topology targets **Platinum-conformant** code (ADR "Quality Target: Platinum-Conformant, Core Merge as v2+ Path"). The full rule mapping with per-rule status lives in `docs/development/PLAN-topology.md` §8 — check it before claiming a rule is N/A.

- ✅ **Always implement:** Type hints, async patterns, proper error handling, service registration in `async_setup()`, diagnostics with `async_redact_data()`, entity translations and unique IDs, tests for new behavior
- 🎯 **When applicable:** Repair flows, config-entry migrations, options/reconfigure handling
- 🚫 **Legitimately N/A here (do not add):** device info, discovery, reauth, polling intervals, multiple config entries

**Developer expectation:** Generate production-ready code. Implement HA standards with reasonable effort.

**Other flexibility:** Discovery can be added later; breaking changes allowed with documentation; experimental features acceptable.

## Code Style and Quality

**Python:** 4 spaces, 120 char lines, double quotes, full type hints, async for all I/O

**YAML:** 2 spaces, modern HA syntax (no legacy `platform:` style)

**JSON:** 2 spaces, no trailing commas, no comments

**Validation:** Run `script/check` before committing (runs type-check + lint + spell)

**hassfest validation:** Run `script/hassfest` to validate against Home Assistant standards

- Validates manifest.json, translations, services.yaml, and integration structure
- Uses official Home Assistant Core validation scripts locally
- First run downloads ~27 MB, subsequent runs are fast with `--no-update`

**For comprehensive standards, see:**

- `.github/instructions/blueprint.python.instructions.md` - Python patterns, imports, type hints
- `.github/instructions/blueprint.yaml.instructions.md` - YAML structure and HA-specific patterns
- `.github/instructions/blueprint.json.instructions.md` - JSON formatting and schema validation
- `.github/instructions/blueprint.shell.instructions.md` - Shell script style, shfmt, shellcheck

**GitHub Copilot users:** These instruction files are automatically provided based on file type.

## Project-Specific Rules

### Integration Identifiers

This integration uses the following identifiers consistently:

- **Domain:** `topology`
- **Title:** Topology
- **Class prefix:** `Topology`

**When creating new files:**

- Use the domain `topology` for all DOMAIN references
- Prefix all integration-specific classes with `Topology`
- Use "Topology" as the display title
- Never hardcode different values

### Integration Structure

**Package organization inside `custom_components/topology/` (DO NOT create other packages):**

- `coordinator/` - Event-fanout coordinator (`base.py`) and the registry watcher (`registry_watcher.py`)
- `config_flow_handler/` - Confirm-only config flow (`config_flow.py`) and its setup checks (`handler.py`)
- `entity/` - Base entity class (`base.py`, no device info)
- `entity_utils/` - Derivations (`derivations.py`), graph algorithms (`graph.py`), frozen entity/unique-ID helpers (`entity_ids.py`)
- `sensor/`, `binary_sensor/` - Entity platforms, one entity class per file
- `service_actions/` - Service action handlers, schemas, validation, import and label-projection logic
- `utils/` - Integration-wide utilities (string helpers, general validators)
- `panel/` - **Generated** panel assets built from `frontend/` by `script/frontend`; never edit by hand
- `translations/` - Translation files (`en.json` is authoritative)

Root modules: `__init__.py` (setup, panel registration, migrations), `const.py`, `data.py` (dataclasses, enums, presets), `store.py` (persisted state), `websocket_api.py` (frozen `topology/*` contract), `diagnostics.py`, `repairs.py`, `config_flow.py` (thin re-export).

Panel source lives outside the integration in `frontend/src/` (`api/`, `editors/`, `map/`, `state/`, `i18n/`, `test/`).

**Do NOT create:**

- `api/` - there is no external service to talk to (see Project Overview)
- `helpers/`, `ha_helpers/`, or similar packages - use `utils/` or `entity_utils/` instead
- `common/`, `shared/`, `lib/` - use existing packages above
- New top-level packages without explicit approval

**Key patterns:**

- Entities → Coordinator → Store (never skip layers). Entities read `coordinator.data` (the store snapshot) and `coordinator.derived` (the registry-merged projection) — never the store, area registry, or floor registry directly
- Each platform in own directory with `__init__.py`
- One entity class per file for clarity
- Use `EntityDescription` dataclasses for static entity metadata (see `sensor/area.py`)
- Unique IDs and entity IDs are **frozen** contracts — build them only through `entity_utils/entity_ids.py`

**Code organization principles:**

- Keep files focused (200-400 lines per file)
- One class per file for entity implementations
- Split large modules into smaller ones when needed

**For detailed patterns, see:**

- `.github/instructions/blueprint.entities.instructions.md` - Entity platform patterns
- `.github/instructions/blueprint.coordinator.instructions.md` - Coordinator implementation (read with the "no polling" caveat above)

> `.github/instructions/blueprint.api.instructions.md` describes API-client patterns and does **not** apply to this integration.

### Device Info

**topology creates no devices.** Entities are registry-driven annotations of areas the user already owns; inventing a service device for them would add a meaningless entry to the device registry. `TopologyEntity` (`entity/base.py`) therefore sets no `_attr_device_info`, and the Quality-Scale `devices` rule is declared N/A. Do not add device info to an entity.

### Integration Manifest

> **topology's values are ratified** — `integration_type: helper`, `iot_class: calculated`, `single_config_entry: true`, `quality_scale: platinum` (ADR "Manifest Declaration"). Do not change them without a new ADR. The reference below explains the field space for context.

**Key fields in `manifest.json`:**

**integration_type** (CRITICAL):

- `hub` - Gateway to multiple devices/services (e.g., Philips Hue bridge)
- `device` - Single device per config entry (e.g., ESPHome device)
- `service` - Single service per config entry (e.g., DuckDNS)
- `helper` - Helper entity (e.g., input_boolean, group)
- `virtual` - Points to another integration/IoT standard (not for custom integrations)

**Rule:** Hub vs Service/Device is defined by nature: Hub = gateway to multiple devices/services; Service/Device = one per config entry.

**quality_scale:**

- Required for Core integrations (minimum `bronze`)
- Optional for custom integrations (not displayed in HA UI)
- Levels: `bronze`, `silver`, `gold`, `platinum`, `internal`
- If included, serves as self-documentation of code quality goals
- See [Integration Quality Scale](https://developers.home-assistant.io/docs/core/integration-quality-scale)

**iot_class:**

- `cloud_polling`, `cloud_push`, `local_polling`, `local_push`, `assumed_state`, `calculated`

**dependencies vs after_dependencies:**

- `dependencies` - Required, integration won't load without them
- `after_dependencies` - Optional, waits if configured

**Discovery methods:** `bluetooth`, `dhcp`, `homekit`, `mqtt`, `ssdp`, `usb`, `zeroconf`

- Define matchers in manifest
- Requires corresponding `async_step_<method>()` in config flow
- Unique ID required for discovery

**single_config_entry:** Set `true` to allow only one config entry per integration

See `.github/instructions/blueprint.manifest.instructions.md` for comprehensive manifest documentation.

### Config Flow Best Practices

> **topology's flow is a confirm-only singleton** (ADR "Editing Surface: Config Flow for Setup, Panel for Data", amended 2026-07-25): the user step and the reconfigure step run the setup checks and create/reload the entry with `data == {}`. There are no credentials, no discovery, and no settings fields — those live in the store and are edited from the panel. Discovery/reauth guidance below is therefore N/A here; keep it for the migration rules, which do apply (`CONFIG_ENTRY_VERSION` / `CONFIG_ENTRY_MINOR_VERSION` in `const.py`).

**Reserved step names:**

- Discovery: `bluetooth`, `dhcp`, `homekit`, `mqtt`, `ssdp`, `usb`, `zeroconf`
- System: `user`, `reauth`, `reconfigure`, `import`

**Unique ID requirements (CRITICAL):**

- Acceptable: Serial number, MAC address, device ID, account ID
- Unacceptable: IP address, device name, hostname, URL

**Reconfigure vs Reauth:**

- `reconfigure` - Change config data (host, settings)
- `reauth` - Handle expired credentials

**Config entry migration:**

- Define `VERSION` and `MINOR_VERSION` in ConfigFlow
- Implement `async_migrate_entry()` in `__init__.py`
- Update entry with `hass.config_entries.async_update_entry()`
- Return `False` to reject downgrades

**Scaffold commands:**

```bash
python3 -m script.scaffold config_flow_discovery  # Discoverable, no auth
python3 -m script.scaffold config_flow_oauth2     # OAuth2 flow
```

## Home Assistant Patterns

**Config flow:**

- Implement in `config_flow_handler/` package
- Confirm-only user + reconfigure steps; the singleton is enforced by a fixed unique ID plus `single_config_entry: true`
- Run the test-before-configure / test-before-setup checks in `handler.py`; never add settings fields (see the note above)

See `.github/instructions/blueprint.config_flow.instructions.md` for comprehensive patterns.

**Service actions:**

- Define in `services.yaml` with full descriptions (legacy filename)
- Implement handlers in `service_actions/` directory
- **Register in `async_setup()`** - NOT in `async_setup_entry()` (Quality Scale!)
- Format: `<integration_domain>.<action_name>`

See `.github/instructions/blueprint.service_actions.instructions.md` for service patterns.

**Coordinator (event fanout, not polling):**

- Entities → Coordinator → Store (never skip layers)
- `TopologyCoordinator` owns the loaded store snapshot and the derived projection; it has **no** `_async_update_data`, no `update_interval`, and no retry logic
- Registry events (`area_registry_updated`, `floor_registry_updated`) are subscribed in `coordinator/registry_watcher.py` and fanned out via `async_update_listeners()`
- `PARALLEL_UPDATES = 0` on every platform
- Setup failures raise `ConfigEntryNotReady` / `ConfigEntryError`; there is nothing to authenticate, so never `ConfigEntryAuthFailed`

See `.github/instructions/blueprint.coordinator.instructions.md` for the generic `DataUpdateCoordinator` API, and the ADR "Coordinator Role: Event Fanout, Not Polling" for what this project does differently.

**Entities:**

- Inherit from platform base + `TopologyEntity`
- Read from `coordinator.data` / `coordinator.derived`, never from the store or the registries directly
- Use `EntityDescription` for static metadata

See `.github/instructions/blueprint.entities.instructions.md` for entity patterns.

**Repairs:**

- Create `repairs.py` in integration root (Gold Quality Scale)
- Use `async_create_issue()` with severity levels (WARNING, ERROR, CRITICAL)
- Implement `RepairsFlow` for guided user fixes
- Delete issues after successful repair

See `.github/instructions/blueprint.repairs.instructions.md` for comprehensive patterns.

**Entity availability:**

- Entities are available whenever the store snapshot is loaded — there is no remote endpoint that can go offline
- Don't raise exceptions from `@property` methods

**State updates:**

- Use `self.async_write_ha_state()` for immediate updates
- Let the coordinator fan out registry and store changes; entities never schedule their own refresh

**Setup failure handling:**

- `ConfigEntryNotReady` - Transient setup problem (store not loadable yet), auto-retry, don't log manually (HA logs at debug)
- `ConfigEntryError` - Permanent setup problem (e.g. a store written by a newer version)
- `ConfigEntryAuthFailed` - N/A, there are no credentials

**Diagnostics:**

- **CRITICAL:** Use `async_redact_data()` from `homeassistant.helpers.redact` to remove sensitive data
- Redact: Passwords, API keys, tokens, location data, personal information

**YAML Configuration:**

⚠️ **DEPRECATED** for integrations communicating with devices/services (ADR-0010)

- New integrations MUST use config flow
- Existing YAML integrations should migrate to config flow
- Only helpers and system integrations may use YAML

## Validation Scripts

**Before committing, always run the full suite:**

```bash
script/check      # Full validation: type-check + lint-check + spell-check
```

**After editing specific file types, use the targeted script — it is faster:**

| Changed files                          | Run this                              | Why faster                                        |
| -------------------------------------- | ------------------------------------- | ------------------------------------------------- |
| `*.py` only                            | `script/python` + `script/type-check` | Fixes + reports ruff; skips yaml, shell, markdown |
| `*.yaml` / `*.yml` only                | `script/yaml-check`                   | Skips Python, Shell, Markdown, types              |
| `*.md` only                            | `script/markdown`                     | Prettier + markdownlint only                      |
| `script/` or `.devcontainer/*.sh` only | `script/shell` + `script/shell-check` | Fixes shfmt, then checks shellcheck               |
| `frontend/**` (panel source)           | `script/frontend-check`               | tsc + Vitest only; run `script/frontend` to build |
| Multiple types or unsure               | `script/lint` + `script/type-check`   | Safe default for agents                           |

**Recommended agent workflow — fix scripts already show what they couldn't fix:**

Fix-mode scripts auto-heal files **and** print remaining unfixable errors in their output.
No separate check-run is needed after a fix-mode script — its exit code and output tell you
what still needs manual attention.

```bash
# Run this loop until both commands exit 0:
script/lint         # Fixes Python + shell + markdown formatting; checks yaml + shellcheck; shows all remaining
script/type-check   # Pyright type errors — no auto-fix ever, always a manual loop
# Then fix remaining issues from the output above and repeat.
```

> **Note:** `script/lint-check`, `script/python-check`, and `script/check` are **check-only**
> (read-only, no file writes). Use them in CI/CD pipelines where side effects are not desirable.
> AI agents should always use the fix-mode scripts to benefit from auto-healing.

**Fix / format scripts (apply changes automatically):**

```bash
script/lint         # Format + fix all types (Python, Shell, Markdown)
script/python       # Ruff format + ruff check --fix  (Python only)
script/shell        # shfmt -w                        (Shell only)
script/spell        # codespell --write-changes        (spelling)
script/markdown     # Prettier --write + markdownlint  (Markdown only)
```

**Check-only scripts (never modify files):**

```bash
script/lint-check   # Check all types without changes
script/python-check # Ruff format --check + ruff check  (Python only)
script/yaml-check   # yamllint                           (YAML only)
script/shell-check  # shfmt -d + shellcheck              (Shell only)
script/markdown-check # Prettier --check + markdownlint  (Markdown only)
script/type-check   # Pyright                            (types only)
script/spell-check  # codespell                          (spelling only)
script/test         # pytest                             (tests only)
```

**Configured tools:**

| Tool                  | Scope                        | Fixes?               |
| --------------------- | ---------------------------- | -------------------- |
| **Ruff**              | Python lint + format         | ✅ `script/python`   |
| **Pyright**           | Python type checking         | ❌ manual            |
| **yamllint**          | YAML structure + style       | ❌ manual            |
| **shfmt**             | Shell script formatting      | ✅ `script/shell`    |
| **shellcheck**        | Shell script static analysis | ❌ manual            |
| **Prettier**          | Markdown formatting          | ✅ `script/markdown` |
| **markdownlint-cli2** | Markdown structure + style   | ✅ `script/markdown` |
| **codespell**         | Spelling in code + docs      | ✅ `script/spell`    |
| **pytest**            | Unit + integration tests     | ❌ n/a               |

References: [Ruff rules](https://docs.astral.sh/ruff/rules/) · [Pyright docs](https://microsoft.github.io/pyright/)

**Generate code that passes these checks on first run.** As an AI agent, you should produce higher quality code than manual development:

- Type hints are trivial for you to generate
- Async patterns are well-known to you
- Import management is automatic for you
- Naming conventions can be applied consistently

Aim for zero validation errors in generated code. The developer expects production-ready output.

See `.github/instructions/blueprint.python.instructions.md` for linter overrides and error recovery strategies.

- You may use `# noqa: CODE` or `# type: ignore` when genuinely necessary
- Use sparingly and only with good reason (e.g., false positives, external library issues)

### Error Recovery Strategy

**When validation fails, run `script/lint` first** — it auto-fixes Python and shell formatting,
and its output already shows everything it could not fix automatically (yamllint, shellcheck,
unfixable ruff errors). No separate check-run is needed on top.

For Pyright type errors run `script/type-check` — there is no auto-fix for type errors ever.

After auto-fixes are applied, only manually edit files for errors that **remain in the output**.

**Iteration strategy for remaining errors:**

1. **First attempt** — Fix the specific error reported by the tool
2. **Second attempt** — If it fails again, reconsider your approach (maybe your understanding was wrong)
3. **Third attempt** — If still failing, ask for clarification rather than looping indefinitely
4. **After 3 failed attempts** — Stop and explain what you tried and why it's not working

**When tool operations fail:**

- **File read/write errors** - Verify path exists, check for typos, try once more
- **Terminal timeouts** - Don't retry automatically; inform the user and suggest manual intervention
- **API/network timeouts in tests** - Mention in response, don't silently ignore
- **Git operations fail** - Report the error immediately; don't attempt to work around it

**When gathering context:**

- Start with semantic_search (1-2 queries maximum)
- Read 3-5 most relevant files based on search results
- If still unclear, read 2-3 more specific files
- **After ~10 file reads, you should have enough context** - make a decision or ask for clarification
- Don't fall into infinite research loops

**Context gathering strategy:**

1. **First pass** - semantic_search to find relevant areas (1-2 queries)
2. **Second pass** - Read the 3-5 most relevant files identified
3. **Evaluate** - Do you have enough context to proceed? If yes, start implementation
4. **Third pass (if needed)** - Read 2-3 additional specific files for missing details
5. **Decision point** - After ~10 file reads total, you must either:
   - Proceed with implementation based on available context
   - Ask the developer specific questions about what's unclear
   - Never continue searching indefinitely without making progress

## Testing

**Test structure:**

- `tests/` mirrors `custom_components/topology/` structure
- Use fixtures for common setup (`hass`, config entry, store snapshot, coordinator)
- There is no external API to mock — set up the area/floor registries and the store instead
- Panel tests are Vitest specs under `frontend/src/test/`, run by `script/frontend-check`

**Running tests:**

```bash
script/test                           # All tests
script/test --cov                     # With terminal coverage report
script/test --cov-html                # With HTML coverage report
script/test --snapshot-update         # Update Syrupy snapshots
```

**CI:** `.github/workflows/test.yml` runs `script/test --cov` (report only, no coverage gate) and `script/type-check` on every push and pull request against `main`. `lint.yml`, `validate.yml`, and `frontend.yml` cover linting, hassfest/HACS, and the panel bundle.

See `.github/instructions/blueprint.tests.instructions.md` for comprehensive testing patterns.

## Breaking Changes

**Always warn the developer before making changes that:**

- Change entity IDs or unique IDs (users' automations will break)
- Modify config entry data structure (existing installations will fail)
- Change state values or attributes format (dashboards and automations affected)
- Alter service call signatures (user scripts will break)
- Remove or rename config options (users must reconfigure)

**Never do without explicit approval:**

- Removing config options (even if "unused")
- Changing service parameters or return values
- Modifying how data is stored in config entries
- Renaming entities or changing their device classes
- Changing unique_id generation logic

**How to warn:**

> "⚠️ This change will modify the entity ID format from `sensor.device_name` to `sensor.device_name_sensor`. Existing users' automations and dashboards will break. Should I proceed, or would you prefer a migration path?"

**When breaking changes are necessary:**

- Document the breaking change in commit message (`BREAKING CHANGE:` footer)
- Consider providing migration instructions
- Suggest version bump (major version change)
- Update documentation if it exists

## File Changes

**Scope Management:**

**Single logical feature or fix:**

- Implement completely even if it spans 5-8 files
- Example: New sensor needs entity class + platform init + code → implement all together
- Example: Bug fix requires changes in coordinator + entity + error handling → do all at once

**Multiple independent features:**

- Implement one at a time
- After completing each feature, suggest committing before proceeding to the next

**Large refactoring (>10 files or architectural changes):**

- Propose a plan first before starting implementation
- Get explicit confirmation from developer

**Tests:** topology targets the Silver `test-coverage` rule (≥ 95 %, ADR "Quality Target"), and CI runs the suite on every push — so a behavior change belongs together with the tests that cover it. Do **not** go beyond that: no unrelated test refactors, no rewriting existing tests to make a change pass, and no new test infrastructure without asking.

**Translation strategy:**

- Use placeholders in code (e.g., `"config.step.user.title"`) - functionality works without translations
- Update `en.json` only when asked or at major feature completion
- NEVER update other language files automatically - extremely time-consuming
- Ask before updating multiple translation files
- Priority: Business logic first, translations later

See `.github/copilot-instructions.md` for detailed workflow guidance.

## Research and Validation

**When uncertain, consult official documentation:**

- **Always check current patterns** in [Home Assistant Developer Docs](https://developers.home-assistant.io/)
- **Read the blog** at [Home Assistant Developer Blog](https://developers.home-assistant.io/blog/) for recent changes and best practices
- **Search for examples** using Google: `site:developers.home-assistant.io [your topic]`
- **Verify with tools** before assuming - run `script/check` to catch issues early

**Don't rely on assumptions:**

- Home Assistant APIs and patterns evolve frequently
- What worked in older versions may be deprecated
- Use official docs and working examples over guesswork
- When in doubt, search for recent integration examples in Home Assistant Core

**Tool documentation:**

- [Ruff Rules](https://docs.astral.sh/ruff/rules/) - Understand what each rule checks
- [Pyright Configuration](https://microsoft.github.io/pyright/#/configuration) - Type checking options
- Don't hesitate to look up specific error codes when validation fails

## Tool Parallelization

**Safe to call in parallel:**

- Multiple `read_file` operations (different files or different sections of same file)
- `file_search` + `read_file` + `grep_search` (independent read-only operations)
- `semantic_search` followed by parallel `read_file` of results (but only 1 semantic_search at a time)

**Never call in parallel:**

- Multiple `run_in_terminal` commands (execute sequentially, wait for output)
- Multiple `replace_string_in_file` on the same file (use `multi_replace_string_in_file` instead)
- `semantic_search` with other `semantic_search` (execute one at a time)

**Best practices:**

- Batch independent read operations together in one parallel call
- After gathering context in parallel, provide brief progress update before proceeding
- For file edits, use `multi_replace_string_in_file` when making multiple changes
- Terminal commands must always be sequential to see output before next command

## Additional Resources

- [Home Assistant Developer Docs](https://developers.home-assistant.io/) - Primary reference
- [Integration Quality Scale](https://developers.home-assistant.io/docs/integration_quality_scale_index)
- [Architecture Docs](https://developers.home-assistant.io/docs/architecture_index)
- [Ruff Rules](https://docs.astral.sh/ruff/rules/) - Linter documentation
- [Pyright Configuration](https://microsoft.github.io/pyright/#/configuration) - Type checker documentation
- [pytest Documentation](https://docs.pytest.org/) - Testing framework
- See `CONTRIBUTING.md` for contribution guidelines
