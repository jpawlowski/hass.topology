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
