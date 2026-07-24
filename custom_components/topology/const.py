"""Constants for topology."""

from __future__ import annotations

from datetime import timedelta
from logging import Logger, getLogger

LOGGER: Logger = getLogger(__package__)

# Integration metadata
DOMAIN = "topology"

# Platform parallel updates - applied to all platforms
PARALLEL_UPDATES = 0

# --- storage (PLAN-topology-phase2.md §2.1) --------------------------------
STORAGE_KEY = f"{DOMAIN}.storage"  # -> .storage/topology.storage
STORAGE_VERSION = 1  # major, mirrored as schema_version in the payload
STORAGE_VERSION_MINOR = 1

# Orphaned registry-derived data is kept this long before purge (ADR
# "Registry-Driven State"): a registry restore within the window keeps the
# annotation instead of losing it.
ORPHAN_UNDO_WINDOW = timedelta(hours=72)

# Unannotated-area count at which the repair issue fires. Default per ADR;
# user-configurable via the config flow (§5, decision D10).
DEFAULT_UNANNOTATED_REPAIR_THRESHOLD = 3

# --- repair issues (Phase 5, PLAN-topology-phase5.md §2) --------------------
# Shared learn-more target for every topology repair card. Per-issue doc
# anchors are deferred to the Phase 8 user docs (decision D11); until then all
# cards point at the repository.
LEARN_MORE_URL = "https://github.com/jpawlowski/hass.topology"

# One issue id per issue class (§2); ``translation_key == issue_id`` throughout
# (HA convention). Two are pre-existing (kept, now reconciled through the single
# path in ``repairs.py``), six are new.
ISSUE_STORE_FUTURE_VERSION = "store_future_version"
ISSUE_UNKNOWN_ENUM = "unknown_enum_after_downgrade"
ISSUE_UNANNOTATED_THRESHOLD = "unannotated_areas_threshold"
ISSUE_ORPHANED_ENTRIES = "orphaned_registry_entries"
ISSUE_ISOLATED_AREAS = "isolated_areas"
ISSUE_INDOOR_WITHOUT_FLOOR = "indoor_areas_without_floor"
ISSUE_CONTRADICTORY_BEARINGS = "contradictory_bearings"
ISSUE_EXTERIOR_NON_OUTDOOR = "exterior_on_non_outdoor_side"

# --- events (§4.13) --------------------------------------------------------
# Fired on every store mutation and registry-driven change; payload mirrors the
# WebSocket subscription event (§4.12).
EVENT_TOPOLOGY_UPDATED = "topology_updated"

# --- custom panel (Phase 7, PLAN-topology-phase7.md §2/§4) ------------------
# The admin sidebar panel is a Lit web-component built from ``frontend/`` and
# shipped as static assets under ``panel/``. Registration lives in
# ``__init__`` (D4); these constants are the single source of the URLs/labels.
#
# ``PANEL_URL_PATH`` is the sidebar route (``/topology``); ``PANEL_STATIC_URL``
# is a distinct public prefix the built bundle is served from (§4.4, D5).
PANEL_URL_PATH = DOMAIN  # "topology"
PANEL_STATIC_URL = f"/{DOMAIN}_static"  # "/topology_static"
# Directory (relative to the integration package) holding the built bundle +
# ``build.json``; served via ``StaticPathConfig`` and read for the module hash.
PANEL_DIR = "panel"
# The bundle filename is fixed; cache-busting is a ``?<hash>`` query (D5).
PANEL_WEBCOMPONENT = "topology-panel"
PANEL_MODULE = "topology-panel.js"
PANEL_BUILD_MANIFEST = "build.json"
PANEL_TITLE = "Topology"
PANEL_ICON = "mdi:home-floor-g"

# --- repair deep-links (Phase 7, PLAN-topology-phase7.md §3.1) --------------
# Per-issue ``learn_more_url`` overrides that open the panel focused on the
# matching view. The HA frontend renders a ``learn_more_url`` beginning with
# the ``homeassistant://`` scheme as in-app navigation (stripping the scheme to
# an absolute same-origin path and closing the repairs dialog); any other URL
# opens in a new tab. Verified against the frontend pinned by HA 2026.7.0
# (``home-assistant-frontend==20260624.3``,
# ``panels/config/repairs/dialog-repairs-issue.ts``), so the deep-links use the
# ``homeassistant://`` form to land in-app on the panel (§3.3, D9).
#
# Only the five reactive informational cards and the fixable orphan card appear
# here; ids absent from this map keep the shared ``LEARN_MORE_URL`` (repo). No
# issue id, severity, placeholder, or fixability flag changes — this varies the
# ``learn_more_url`` string only (D9).
_PANEL_DEEP_LINK = f"homeassistant://{PANEL_URL_PATH}"
ISSUE_DEEP_LINKS: dict[str, str] = {
    ISSUE_UNANNOTATED_THRESHOLD: f"{_PANEL_DEEP_LINK}?focus=unannotated",
    ISSUE_ISOLATED_AREAS: f"{_PANEL_DEEP_LINK}?focus=isolated",
    ISSUE_INDOOR_WITHOUT_FLOOR: f"{_PANEL_DEEP_LINK}?focus=floors",
    ISSUE_CONTRADICTORY_BEARINGS: f"{_PANEL_DEEP_LINK}?focus=bearings",
    ISSUE_EXTERIOR_NON_OUTDOOR: f"{_PANEL_DEEP_LINK}?focus=exterior",
    ISSUE_ORPHANED_ENTRIES: f"{_PANEL_DEEP_LINK}?focus=orphans",
}

# --- service actions (Phase 6, PLAN-topology-phase6.md §2) ------------------
# The seven v1 services, all ``topology.<name>``, registered in
# ``service_actions.async_setup_services`` from ``async_setup`` (§2, D2).
SERVICE_ANNOTATE_AREA = "annotate_area"
SERVICE_DECLARE_CONNECTION = "declare_connection"
SERVICE_SET_BEYOND = "set_beyond"
SERVICE_SET_EXTERIOR = "set_exterior"
SERVICE_SET_FLOOR_LEVEL = "set_floor_level"
SERVICE_PROJECT_LABELS = "project_labels"
SERVICE_IMPORT_FROM_CORE = "import_from_core"

# --- label projection (Phase 6, PLAN-topology-phase6.md §2.6) ---------------
# Projected area labels are named ``topology:<dim>:<value>`` (frozen format,
# D10). Ownership is asserted solely by the ``description`` sentinel below — the
# ``topology:`` name prefix alone never makes a label ours (§2.6.1, D10).
LABEL_NAMESPACE = "topology"
LABEL_OWNED_DESCRIPTION = "Managed by the Topology integration — do not edit"

# --- one-shot imports (Phase 6, PLAN-topology-phase6.md §2.7) ---------------
# The two import sources; also the ``imports_done_at`` sub-keys they stamp (§7).
IMPORT_SOURCE_ALIASES = "aliases"
IMPORT_SOURCE_LABELS = "labels"
IMPORT_SOURCES: tuple[str, ...] = (IMPORT_SOURCE_ALIASES, IMPORT_SOURCE_LABELS)

# --- config-flow field keys (§5.1) ----------------------------------------
CONF_OCCUPANCY_EXTENT = "occupancy_extent"
CONF_IMPORT_ALIASES = "import_aliases"
CONF_IMPORT_LABELS = "import_labels"
CONF_PROJECT_ENVIRONMENT = "project_environment"
CONF_PROJECT_TYPE = "project_type"
CONF_PROJECT_TRUST = "project_trust"
CONF_UNANNOTATED_REPAIR_THRESHOLD = "unannotated_repair_threshold"

# --- entities (Phase 3, PLAN-topology-phase3.md §3–§5) ---------------------
# The integration domain is not auto-prefixed into an entity_id and topology
# has no device to supply the prefix, so entity object_ids embed it explicitly
# (§4.3).
ENTITY_ID_PREFIX = DOMAIN  # "topology"

# Per-area annotation dimensions surfaced as diagnostic sensors (§3.3). The
# value is the literal store field name and the unique_id/object_id suffix
# (§4.2/§4.3, decision D4).
DIMENSION_TYPE = "type"
DIMENSION_ENVIRONMENT = "environment"
DIMENSION_TRUST = "trust"
AREA_DIMENSIONS: tuple[str, ...] = (DIMENSION_TYPE, DIMENSION_ENVIRONMENT, DIMENSION_TRUST)

# unique_id / object_id suffixes for the singleton entities (§4).
SUFFIX_HOUSE = "house"
SUFFIX_PERIMETER_OPEN = "perimeter_open"

# Entity translation keys (§5). Per-area keys are ``area_{dimension}``.
TRANSLATION_KEY_HOUSE = "house"
TRANSLATION_KEY_PERIMETER_OPEN = "perimeter_open"

# --- perimeter binary sensor (Phase 4, PLAN-topology-phase4.md §2) ----------
# Debounce for coalescing bound-sensor state changes into one state write
# (§2.3, decision D5). 0.0 = effectively immediate; raise here (no logic change)
# if HA-startup / bulk-recovery churn proves noisy.
PERIMETER_DEBOUNCE_SECONDS = 0.0
