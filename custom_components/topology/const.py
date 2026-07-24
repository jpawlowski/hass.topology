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
