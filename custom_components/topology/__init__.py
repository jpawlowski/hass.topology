"""
Custom integration to model the topology of a Home Assistant home.

Topology is a registry-driven, calculated helper: it annotates the area and
floor registries with a spatial model (types, environment, trust, adjacency)
and serves that model to consumers over a WebSocket contract. It talks to no
external service.

Phase 2 wires the store, coordinator snapshot, registry watcher, and the
WebSocket API. The entity platforms stay empty until Phase 3.

For more details about this integration, please refer to:
https://github.com/jpawlowski/hass.topology
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.exceptions import ConfigEntryError, ConfigEntryNotReady, HomeAssistantError
from homeassistant.helpers import config_validation as cv, issue_registry as ir
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_OCCUPANCY_EXTENT,
    CONF_PROJECT_ENVIRONMENT,
    CONF_PROJECT_TRUST,
    CONF_PROJECT_TYPE,
    CONF_UNANNOTATED_REPAIR_THRESHOLD,
    CONFIG_ENTRY_MINOR_VERSION,
    CONFIG_ENTRY_VERSION,
    DOMAIN,
    ISSUE_STORE_FUTURE_VERSION,
    LEARN_MORE_URL,
    LEGACY_CONF_KEYS,
    LOGGER,
    PANEL_BUILD_MANIFEST,
    PANEL_DIR,
    PANEL_ICON,
    PANEL_MODULE,
    PANEL_STATIC_URL,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_WEBCOMPONENT,
)
from .coordinator import TopologyCoordinator, TopologyRegistryWatcher
from .data import TopologyRuntimeData
from .service_actions import async_setup_services
from .service_actions.label_projection import async_reconcile_labels
from .store import StoreCorruptError, StoreFutureVersionError, TopologyStore, TopologyStoreError
from .websocket_api import async_register_websocket_api

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import TopologyConfigEntry

PLATFORMS: list[Platform] = [
    Platform.SENSOR,
    Platform.BINARY_SENSOR,
]

# Topology is configured via config entries only (no YAML configuration).
# The helper is unannotated in Home Assistant, so its schema type is opaque here.
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)  # pyright: ignore[reportUnknownVariableType, reportUnknownMemberType]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the integration.

    Called once at Home Assistant startup. WebSocket commands (cluster e) and
    (from Phase 6) service actions are registered here — not per config entry —
    so they exist even before an entry is loaded (§4).

    The custom panel's static asset directory is registered here too (Phase 7
    §2.1/§4.4): static-path registration is process-global and may only run once
    per ``url_path``, so it belongs in ``async_setup``, not per entry.
    """
    await async_setup_services(hass)
    async_register_websocket_api(hass)
    await hass.http.async_register_static_paths([StaticPathConfig(PANEL_STATIC_URL, str(_panel_dir()), True)])
    return True


def _panel_dir() -> Path:
    """Return the on-disk directory holding the built panel bundle (§4.3)."""
    return Path(__file__).parent / PANEL_DIR


def _read_build_manifest() -> dict[str, str]:
    """Read the committed ``panel/build.json`` ({module, hash}) from disk (§2.1).

    A missing/corrupt manifest degrades to the fixed filename with no cache bust
    rather than blocking setup — the bundle is committed beside it. The two error
    branches are separate ``except`` clauses (not a tuple) so ``ruff format`` can
    never strip the parentheses into an invalid Python-2 ``except A, B:`` form.
    """
    fallback = {"module": PANEL_MODULE, "hash": ""}
    manifest_path = _panel_dir() / PANEL_BUILD_MANIFEST
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except OSError:
        return fallback
    except ValueError:
        return fallback


async def _async_register_panel(hass: HomeAssistant, entry: TopologyConfigEntry) -> None:
    """Register the admin sidebar panel and wire its removal on unload (§2.1).

    ``config_panel_domain=DOMAIN`` routes the integration tile's "Configure"
    action to the panel (§2.1, D14 Phase-7-local half). ``require_admin=True`` is
    the UI gate aligned with the write commands' ``@require_admin`` boundary (D8).
    ``module_url`` carries a ``?<hash>`` cache-bust from ``build.json`` (§4.3/D5).
    """
    build = await hass.async_add_executor_job(_read_build_manifest)
    module = build.get("module", PANEL_MODULE)
    build_hash = build.get("hash", "")
    module_url = f"{PANEL_STATIC_URL}/{module}"
    if build_hash:
        module_url = f"{module_url}?{build_hash}"

    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_WEBCOMPONENT,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        module_url=module_url,
        require_admin=True,
        config_panel_domain=DOMAIN,
        config={"url_path": PANEL_URL_PATH},
    )
    entry.async_on_unload(lambda: frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False))


async def async_migrate_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Migrate a config entry to ``CONFIG_ENTRY_VERSION.CONFIG_ENTRY_MINOR_VERSION``.

    1.1 -> 1.2 transfers the legacy flow fields into the store — the single
    source of truth for home config — and then empties ``entry.data``. Core calls
    this immediately before ``async_setup_entry``.

    The order is load-bearing: the store is written, flushed **and read back**
    before any key is considered migrated, and ``entry.data`` is only reduced
    once that verification passed, so every failure path simply retries on the
    next load.
    """
    if entry.version > CONFIG_ENTRY_VERSION or (
        entry.version == CONFIG_ENTRY_VERSION and entry.minor_version > CONFIG_ENTRY_MINOR_VERSION
    ):
        # Core already rejects a higher *major* before reaching us; a higher
        # minor does arrive here and must be refused explicitly — after the
        # migration the legacy keys are gone, so tolerating it would mean older
        # code silently reconfiguring the store from an empty entry (D11).
        LOGGER.error(
            "Config entry version %s.%s is newer than the supported %s.%s — restore a backup or upgrade again",
            entry.version,
            entry.minor_version,
            CONFIG_ENTRY_VERSION,
            CONFIG_ENTRY_MINOR_VERSION,
        )
        return False

    if entry.minor_version >= CONFIG_ENTRY_MINOR_VERSION:
        return True

    store = TopologyStore(hass)
    try:
        await store.async_load()
    except TopologyStoreError as err:
        # Do NOT return False here: a migration failure parks the entry in the
        # non-recoverable MIGRATION_ERROR state and hides the real cause.
        # Returning True *without* bumping leaves the entry at 1.1 (so the next
        # load retries) while ``async_setup_entry`` — which runs right after —
        # raises the proper ConfigEntryError/ConfigEntryNotReady and creates the
        # store_future_version repair issue (§3.2 step 3).
        LOGGER.warning("Deferring config entry migration: the topology store could not be read (%s)", err)
        return True

    # ``entry.data`` wins, once (D7): today's setup applies it over the store on
    # every load, so these are the values the user currently sees. Absent keys
    # stay None and are skipped by the store, so a hand-trimmed entry cannot
    # blank a stored value.
    data = entry.data
    await store.async_apply_home_config(
        occupancy_extent=data.get(CONF_OCCUPANCY_EXTENT),
        project_environment=data.get(CONF_PROJECT_ENVIRONMENT),
        project_type=data.get(CONF_PROJECT_TYPE),
        project_trust=data.get(CONF_PROJECT_TRUST),
        unannotated_repair_threshold=data.get(CONF_UNANNOTATED_REPAIR_THRESHOLD),
    )
    if not await _async_flush_and_verify(hass, store):
        # Same deferral as a load error, for the same reason: the entry keeps its
        # legacy keys at 1.1 and the next load retries.
        return True

    # Only now: drop the legacy keys and bump, in one update (§3.2 step 6).
    hass.config_entries.async_update_entry(
        entry,
        data={key: value for key, value in data.items() if key not in LEGACY_CONF_KEYS},
        minor_version=CONFIG_ENTRY_MINOR_VERSION,
    )
    return True


async def _async_flush_and_verify(hass: HomeAssistant, store: TopologyStore) -> bool:
    """Flush the migrated store and confirm it really reached disk (§3.2 step 5).

    "The save did not raise" is not the same as "the save succeeded": HA's
    ``Store._async_handle_write_data`` **catches** ``WriteError`` (what a full or
    read-only disk produces) and only logs it, while an ``OSError`` from creating
    the storage directory escapes instead. Trusting either outcome blindly would
    let the caller empty ``entry.data`` after a write that never happened — the
    one way this migration could lose data.

    So the payload is loaded back exactly the way ``async_setup_entry`` will load
    it, and the home config is compared. Returns ``False`` on any doubt, which
    the caller turns into a deferral: nothing is bumped, nothing is cleared, and
    the next load simply retries (§3.3). This is one extra read on the single
    boot that migrates.
    """
    try:
        await store.async_save_now()
        verify = TopologyStore(hass)
        await verify.async_load()
    except (OSError, HomeAssistantError) as err:
        LOGGER.warning("Deferring config entry migration: the topology store could not be written (%s)", err)
        return False

    if verify.data["home_config"] != store.data["home_config"]:
        LOGGER.warning(
            "Deferring config entry migration: the topology store did not persist the transferred home config"
        )
        return False
    return True


async def async_setup_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Set up topology from a config entry.

    Runs the test-before-setup checks (§5.3): a transient I/O failure raises
    ``ConfigEntryNotReady``; corrupt JSON raises ``ConfigEntryError``; a future
    store version raises ``ConfigEntryError`` and creates a repair issue.

    Setup never writes ``home_config``: the store is the source of truth and
    ``entry.data`` is never read back as configuration, so a reload leaves the
    panel's edits alone (§2.5 — the regression this change removes).
    """
    store = TopologyStore(hass)
    try:
        await store.async_load()
    except StoreFutureVersionError as err:
        ir.async_create_issue(
            hass,
            DOMAIN,
            ISSUE_STORE_FUTURE_VERSION,
            is_fixable=False,
            severity=ir.IssueSeverity.ERROR,
            translation_key=ISSUE_STORE_FUTURE_VERSION,
            learn_more_url=LEARN_MORE_URL,
            translation_placeholders={"version": str(err.version)},
        )
        raise ConfigEntryError("topology store was written by a newer version") from err
    except StoreCorruptError as err:
        raise ConfigEntryError("topology store is corrupt") from err
    except TopologyStoreError as err:  # transient I/O error
        raise ConfigEntryNotReady("topology store could not be read") from err

    # A successful load clears any stale future-version repair.
    ir.async_delete_issue(hass, DOMAIN, ISSUE_STORE_FUTURE_VERSION)

    coordinator = TopologyCoordinator(hass, entry, store)

    coordinator.async_seed(store.snapshot())

    entry.runtime_data = TopologyRuntimeData(store=store, coordinator=coordinator)

    # Label projection (§2.8 site 2): reconcile once after seed so the current
    # toggle state is reflected in area labels at every load (a reconfigure that
    # flips a toggle reloads and re-runs this).
    await async_reconcile_labels(hass, store.snapshot())

    watcher = TopologyRegistryWatcher(hass, coordinator)
    await watcher.async_startup_purge()
    watcher.async_start()
    entry.async_on_unload(watcher.async_stop)

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Register the admin sidebar panel last, after the platforms forward (§2.1).
    await _async_register_panel(hass, entry)

    return True


async def async_unload_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> bool:
    """Unload a config entry and its platforms (registry listeners via on_unload)."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_reload_entry(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> None:
    """Reload the config entry."""
    await hass.config_entries.async_reload(entry.entry_id)
