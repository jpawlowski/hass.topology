"""
Voluptuous call schemas for the topology services (PLAN-topology-phase6.md §2).

The seven service schemas plus the shared exterior-connection sub-schema, built
from the frozen enum value sets in ``data.py``. Closed enums are ``vol.In`` so a
bad value fails schema validation; existence and semantic rules live in
``validation.py`` (D5). ``type`` and free-text ids stay ``cv.string`` (open
catalog, §2.4 rule 5). This package does not reuse the WebSocket layer's
validators — it is self-contained (D5).
"""

from __future__ import annotations

import voluptuous as vol

from custom_components.topology.data import (
    Barrier,
    BeyondClass,
    CardinalSide,
    ConnectionPreset,
    Environment,
    Passage,
    Trust,
)
from homeassistant.helpers import config_validation as cv

# Frozen enum value sets (the schema's closed-enum domains, §2).
_ENVIRONMENT_VALUES = tuple(member.value for member in Environment)
_TRUST_VALUES = tuple(member.value for member in Trust)
_SIDE_VALUES = tuple(member.value for member in CardinalSide)
_BEYOND_VALUES = tuple(member.value for member in BeyondClass)
_PASSAGE_VALUES = tuple(member.value for member in Passage)
_BARRIER_VALUES = tuple(member.value for member in Barrier)
_PRESET_VALUES = tuple(member.value for member in ConnectionPreset)

# Service field names (data keys) — kept here so handlers and schemas agree.
FIELD_AREA_ID = "area_id"
FIELD_AREA_A = "area_a"
FIELD_AREA_B = "area_b"
FIELD_FLOOR_ID = "floor_id"
FIELD_TYPE = "type"
FIELD_ENVIRONMENT = "environment"
FIELD_TRUST = "trust"
FIELD_PRESET = "preset"
FIELD_SIDE = "side"
FIELD_GLAZED = "glazed"
FIELD_SENSOR = "sensor"
FIELD_BEYOND = "beyond"
FIELD_CONNECTIONS = "connections"
FIELD_LEVEL = "level"
FIELD_SCOPE = "scope"
FIELD_SOURCE = "source"
# Read-action field names. ``from``/``to`` would mirror the WebSocket command,
# but ``from`` is a Jinja keyword and these fields exist to be used from
# templates, so both ends are spelled ``*_area``.
FIELD_FROM_AREA = "from_area"
FIELD_TO_AREA = "to_area"
FIELD_TRAVERSABLE = "traversable_only"
FIELD_GLAZED_ONLY = "glazed_only"

# Projection scope + import source domains (§2.6/§2.7).
PROJECTION_SCOPES = ("all", "environment", "type", "trust")
IMPORT_SOURCE_VALUES = ("aliases", "labels")


# --- shared connection sub-schema (set_exterior, §2.4) ---------------------
# One exterior connection object; the cross-field ``sensor`` rule is enforced in
# ``validation.py`` (mirrors WS ``_validate_connection`` with inline trust).
CONNECTION_SCHEMA = vol.Schema(
    {
        vol.Required("passage"): vol.In(_PASSAGE_VALUES),
        vol.Required("barrier"): vol.In(_BARRIER_VALUES),
        vol.Optional("side"): vol.In(_SIDE_VALUES),
        vol.Optional("sensor_entity_id"): cv.string,
        vol.Optional("glazed"): cv.boolean,
        vol.Optional("inline_trust"): vol.In(_TRUST_VALUES),
        vol.Optional("perimeter_override"): cv.boolean,
        vol.Optional("preset_name"): cv.string,
    }
)


# --- the seven service schemas (§2.1–§2.7) ---------------------------------

ANNOTATE_AREA_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_AREA_ID): cv.string,
        vol.Optional(FIELD_TYPE): cv.string,
        vol.Optional(FIELD_ENVIRONMENT): vol.In(_ENVIRONMENT_VALUES),
        vol.Optional(FIELD_TRUST): vol.In(_TRUST_VALUES),
    }
)

DECLARE_CONNECTION_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_AREA_A): cv.string,
        vol.Required(FIELD_AREA_B): cv.string,
        vol.Required(FIELD_PRESET): vol.In(_PRESET_VALUES),
        vol.Optional(FIELD_SIDE): vol.In(_SIDE_VALUES),
        vol.Optional(FIELD_GLAZED): cv.boolean,
        vol.Optional(FIELD_SENSOR): cv.string,
    }
)

SET_BEYOND_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_AREA_ID): cv.string,
        vol.Required(FIELD_SIDE): vol.In(_SIDE_VALUES),
        vol.Optional(FIELD_BEYOND): vol.Any(vol.In(_BEYOND_VALUES), None),
    }
)

SET_EXTERIOR_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_AREA_ID): cv.string,
        vol.Required(FIELD_CONNECTIONS): [CONNECTION_SCHEMA],
    }
)

SET_FLOOR_LEVEL_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_FLOOR_ID): cv.string,
        vol.Optional(FIELD_LEVEL): vol.Any(vol.Coerce(int), None),
    }
)

PROJECT_LABELS_SCHEMA = vol.Schema(
    {
        vol.Optional(FIELD_SCOPE, default="all"): vol.In(PROJECTION_SCOPES),
    }
)

IMPORT_FROM_CORE_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_SOURCE): vol.In(IMPORT_SOURCE_VALUES),
    }
)


# --- the six read schemas (SupportsResponse.ONLY) --------------------------
# Deliberately permissive: a read cannot corrupt anything, so only the shape is
# validated here and area existence stays with ``validation.require_area``,
# which produces the translated ``area_not_found`` a caller can act on.

GET_NEIGHBORS_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_AREA_ID): cv.string,
    }
)

GET_PATH_SCHEMA = vol.Schema(
    {
        vol.Required(FIELD_FROM_AREA): cv.string,
        vol.Required(FIELD_TO_AREA): cv.string,
        vol.Optional(FIELD_TRAVERSABLE, default=False): cv.boolean,
    }
)

GET_PERIMETER_SCHEMA = vol.Schema({})

GET_CONNECTIONS_FACING_OUTDOOR_SCHEMA = vol.Schema(
    {
        # A list, so "the east and south facades" is one call. Omitted = no filter.
        vol.Optional(FIELD_SIDE): vol.All(cv.ensure_list, [vol.In(_SIDE_VALUES)]),
        vol.Optional(FIELD_GLAZED_ONLY, default=False): cv.boolean,
    }
)

GET_HEALTH_SCHEMA = vol.Schema({})

GET_MODEL_SCHEMA = vol.Schema({})
