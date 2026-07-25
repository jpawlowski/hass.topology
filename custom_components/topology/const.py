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

# --- config entry versioning (PLAN-topology-phase2-followup-configflow.md §3.1)
# Deliberately *decoupled* from ``STORAGE_VERSION``: the config flow used to
# declare ``VERSION = STORAGE_VERSION``, so bumping the entry would have bumped
# the store schema too — every store would be treated as outdated, rewritten,
# and a rollback would hit ``StoreFutureVersionError``. These two numbers are
# semantically unrelated and must stay independent (D5).
#
# 1.1 -> 1.2: the config flow no longer collects home settings; ``entry.data``
# is transferred into the store by ``async_migrate_entry`` and then emptied. The
# major stays 1 — the change is backwards-compatible, so a *minor* bump is the
# correct HA semantics.
CONFIG_ENTRY_VERSION = 1
CONFIG_ENTRY_MINOR_VERSION = 2

# Orphaned registry-derived data is kept this long before purge (ADR
# "Registry-Driven State"): a registry restore within the window keeps the
# annotation instead of losing it.
ORPHAN_UNDO_WINDOW = timedelta(hours=72)

# Unannotated-area count at which the repair issue fires. Default per ADR;
# user-configurable from the panel's home-config editor (§4.9).
DEFAULT_UNANNOTATED_REPAIR_THRESHOLD = 3

# --- repair issues (Phase 5, PLAN-topology-phase5.md §2) --------------------
# Fallback learn-more target. After Phase 8 this is no card's actual target —
# every issue has both a documentation anchor (``ISSUE_DOC_ANCHORS``) and, where
# the panel can fix it, a deep link (``ISSUE_DEEP_LINKS``). It stays as the
# default of ``repairs._toggle`` so a future issue id added without an entry in
# either map still produces a working link instead of a dead one.
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
# Edge-geometry advisories. Both are prompts to check the model, never errors:
# a void or an atrium legitimately spans storeys, and the panel deliberately
# still lets such an edge be created.
ISSUE_EDGES_SPANNING_FLOORS = "edges_spanning_multiple_floors"
ISSUE_VERTICAL_WITHOUT_PASSAGE = "vertical_edges_without_vertical_passage"

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
    # Both geometry advisories land on the same scope: it lists the flagged
    # edges, and either one is fixed by opening the edge or by correcting a
    # floor assignment.
    ISSUE_EDGES_SPANNING_FLOORS: f"{_PANEL_DEEP_LINK}?focus=geometry",
    ISSUE_VERTICAL_WITHOUT_PASSAGE: f"{_PANEL_DEEP_LINK}?focus=geometry",
}

# --- per-issue documentation anchors (Phase 8 §4.2, D11) -------------------
# The IOU the comment above ``LEARN_MORE_URL`` carried since Phase 5, paid.
#
# A repair card has exactly one link *field*, and Phase-7 D9 spent it on
# remediation for the eight cards the panel can fix — walking the user to the
# fix beats walking them to prose. So the documentation link is not a second
# ``learn_more_url``; it is rendered *inside the description*, which the repairs
# dialog passes through ``<ha-markdown>`` (verified against the frontend pinned
# by HA 2026.7.0). ``repairs._toggle`` injects the anchor as the ``docs``
# placeholder, and every ``issues.*.description`` in ``translations/en.json``
# ends with a markdown link to it. Both links therefore coexist on every card:
# the button remediates, the text explains.
#
# Absolute URLs, not repository-relative paths: a repair card renders in the
# frontend, which has no notion of this repository's layout. The fragments must
# match the headings GitHub generates in CONFIGURATION.md — asserted in
# ``tests/test_repairs_doc_anchors.py``, so a heading rename breaks CI instead
# of shipping a dead link.
_DOCS_BASE = f"{LEARN_MORE_URL}/blob/main/docs/user/CONFIGURATION.md"
ISSUE_DOC_ANCHORS: dict[str, str] = {
    ISSUE_UNANNOTATED_THRESHOLD: f"{_DOCS_BASE}#several-areas-are-not-annotated",
    ISSUE_ISOLATED_AREAS: f"{_DOCS_BASE}#some-areas-are-not-connected",
    ISSUE_INDOOR_WITHOUT_FLOOR: f"{_DOCS_BASE}#indoor-areas-have-no-floor",
    ISSUE_CONTRADICTORY_BEARINGS: f"{_DOCS_BASE}#contradictory-wall-bearings",
    ISSUE_EXTERIOR_NON_OUTDOOR: f"{_DOCS_BASE}#exterior-opening-on-a-non-outdoor-side",
    ISSUE_EDGES_SPANNING_FLOORS: f"{_DOCS_BASE}#an-edge-spans-more-than-one-storey",
    ISSUE_VERTICAL_WITHOUT_PASSAGE: f"{_DOCS_BASE}#a-vertical-edge-has-no-vertical-passage",
    ISSUE_ORPHANED_ENTRIES: f"{_DOCS_BASE}#topology-has-orphaned-entries",
    ISSUE_UNKNOWN_ENUM: f"{_DOCS_BASE}#topology-store-has-unrecognized-values",
    ISSUE_STORE_FUTURE_VERSION: f"{_DOCS_BASE}#topology-store-is-from-a-newer-version",
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

# The six response-returning read actions. They carry no admin gate (reads,
# mirroring the WebSocket read commands) and are the only way YAML, a template,
# or a blueprint can reach the graph, the cardinal ``side``/``glazed`` detail,
# the full perimeter set, and the health lists — none of which is an entity
# attribute by design (master §1a).
SERVICE_GET_NEIGHBORS = "get_neighbors"
SERVICE_GET_PATH = "get_path"
SERVICE_GET_PERIMETER = "get_perimeter"
SERVICE_GET_CONNECTIONS_FACING_OUTDOOR = "get_connections_facing_outdoor"
SERVICE_GET_HEALTH = "get_health"
SERVICE_GET_MODEL = "get_model"

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

# --- legacy config-flow field keys (Phase-2 §5.1) --------------------------
# The seven keys the pre-slim flow wrote into ``entry.data``. The flow no longer
# collects any of them (the panel edits the store instead), but the constants
# stay: ``async_migrate_entry`` reads them once to transfer an existing entry's
# values into the store, and ``LEGACY_CONF_KEYS`` is what it strips afterwards.
CONF_OCCUPANCY_EXTENT = "occupancy_extent"
CONF_IMPORT_ALIASES = "import_aliases"
CONF_IMPORT_LABELS = "import_labels"
CONF_PROJECT_ENVIRONMENT = "project_environment"
CONF_PROJECT_TYPE = "project_type"
CONF_PROJECT_TRUST = "project_trust"
CONF_UNANNOTATED_REPAIR_THRESHOLD = "unannotated_repair_threshold"

# Removed from ``entry.data`` by the 1.1 -> 1.2 migration, which leaves the entry
# with ``data == {}`` (§3.2 step 6).
LEGACY_CONF_KEYS: tuple[str, ...] = (
    CONF_OCCUPANCY_EXTENT,
    CONF_IMPORT_ALIASES,
    CONF_IMPORT_LABELS,
    CONF_PROJECT_ENVIRONMENT,
    CONF_PROJECT_TYPE,
    CONF_PROJECT_TRUST,
    CONF_UNANNOTATED_REPAIR_THRESHOLD,
)

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
