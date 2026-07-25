"""
Response-returning read service actions for topology.

The six ``SupportsResponse.ONLY`` actions that open the WebSocket read contract
to YAML: automations, scripts, and blueprints cannot call a WebSocket command, so
until these existed a template's entire view of Topology was the two always-enabled
entities' attributes. Everything else — a connection's cardinal ``side`` and
``glazed`` flag, its ``passage``/``barrier`` pair, the adjacency graph, the full
perimeter set, and every health list but ``unannotated_areas`` — was unreachable
from YAML.

Every payload comes from ``read_contract``, the same module the WebSocket handlers
use, so the two transports serialize one model. The one deliberate divergence is
``get_path``, whose endpoint keys are ``from_area``/``to_area`` instead of the
command's ``from``/``to``: ``from`` is a Jinja keyword, so ``response.from`` is a
template syntax error and the WebSocket spelling would be unusable in the very
place these services exist to serve.

These are reads, so — unlike the seven write actions — they are registered without
the admin gate, mirroring the WebSocket read commands, which require an
authenticated connection but not admin (ADR "Editing Surface").
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.read_contract import (
    connections_facing_outdoor_payload,
    neighbors_payload,
    path_payload,
    perimeter_payload,
    read_hook_payload,
)
from homeassistant.helpers import area_registry as ar, floor_registry as fr

from .handlers import require_runtime
from .schemas import FIELD_AREA_ID, FIELD_FROM_AREA, FIELD_GLAZED_ONLY, FIELD_SIDE, FIELD_TO_AREA, FIELD_TRAVERSABLE
from .validation import require_area

if TYPE_CHECKING:
    from homeassistant.core import ServiceCall, ServiceResponse


async def async_get_neighbors(call: ServiceCall) -> ServiceResponse:
    """``topology.get_neighbors`` — the areas adjacent to one area."""
    runtime = require_runtime(call.hass)
    area_id = call.data[FIELD_AREA_ID]
    require_area(call.hass, area_id)
    return neighbors_payload(runtime.coordinator.derived.graph, area_id)


async def async_get_path(call: ServiceCall) -> ServiceResponse:
    """``topology.get_path`` — the shortest route between two areas."""
    runtime = require_runtime(call.hass)
    src = call.data[FIELD_FROM_AREA]
    dst = call.data[FIELD_TO_AREA]
    require_area(call.hass, src)
    require_area(call.hass, dst)
    return path_payload(
        runtime.coordinator.derived.graph,
        src,
        dst,
        traversable_only=call.data[FIELD_TRAVERSABLE],
    )


async def async_get_perimeter(call: ServiceCall) -> ServiceResponse:
    """``topology.get_perimeter`` — the whole derived perimeter set, open or not."""
    runtime = require_runtime(call.hass)
    return perimeter_payload(runtime.coordinator.data, ar.async_get(call.hass))


async def async_get_connections_facing_outdoor(call: ServiceCall) -> ServiceResponse:
    """``topology.get_connections_facing_outdoor`` — every proven open-air opening."""
    runtime = require_runtime(call.hass)
    return connections_facing_outdoor_payload(
        runtime.coordinator.data,
        ar.async_get(call.hass),
        sides=call.data.get(FIELD_SIDE),
        glazed_only=call.data[FIELD_GLAZED_ONLY],
    )


async def async_get_health(call: ServiceCall) -> ServiceResponse:
    """``topology.get_health`` — the consistency signal with all its lists."""
    runtime = require_runtime(call.hass)
    # Reuse the read hook's health block rather than calling ``build_health``
    # again, so the service can never answer differently from ``topology/health``.
    return read_hook_payload(
        runtime.coordinator.data,
        ar.async_get(call.hass),
        fr.async_get(call.hass),
    )["health"]


async def async_get_model(call: ServiceCall) -> ServiceResponse:
    """``topology.get_model`` — the whole readable model (the ``read_hook`` payload).

    The escape hatch for anything the five narrow actions do not cover: interior
    connection bundles, ``beyond`` classes, per-area ``environment``/``trust``
    without enabling the opt-in diagnostic sensors. It is also the largest
    response by far, and a ``response_variable`` is recorded in the automation
    trace — prefer a narrow action when one fits.
    """
    runtime = require_runtime(call.hass)
    return read_hook_payload(
        runtime.coordinator.data,
        ar.async_get(call.hass),
        fr.async_get(call.hass),
    )
