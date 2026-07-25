"""
Service actions package for topology (PLAN-topology-phase6.md §2).

``async_setup_services`` registers the thirteen services from ``async_setup``
(Quality-Scale ``action-setup``). The seven **write** actions are admin-gated via
``async_register_admin_service`` — automations/scripts without a user context are
allowed, a non-admin UI user is rejected (Appendix A.1, D4). The six **read**
actions declare ``SupportsResponse.ONLY`` and carry no admin gate, mirroring the
WebSocket read commands, which require an authenticated connection but not admin
(ADR "Editing Surface"); gating a read behind admin would put the graph out of
reach of exactly the automations it exists for. Each service resolves the loaded
singleton runtime at call time and raises translated exceptions (§3).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import (
    DOMAIN,
    SERVICE_ANNOTATE_AREA,
    SERVICE_DECLARE_CONNECTION,
    SERVICE_GET_CONNECTIONS_FACING_OUTDOOR,
    SERVICE_GET_HEALTH,
    SERVICE_GET_MODEL,
    SERVICE_GET_NEIGHBORS,
    SERVICE_GET_PATH,
    SERVICE_GET_PERIMETER,
    SERVICE_IMPORT_FROM_CORE,
    SERVICE_PROJECT_LABELS,
    SERVICE_SET_BEYOND,
    SERVICE_SET_EXTERIOR,
    SERVICE_SET_FLOOR_LEVEL,
)
from homeassistant.core import SupportsResponse
from homeassistant.helpers.service import async_register_admin_service

from .handlers import (
    async_annotate_area,
    async_declare_connection,
    async_import_from_core,
    async_project_labels,
    async_set_beyond,
    async_set_exterior,
    async_set_floor_level,
)
from .read import (
    async_get_connections_facing_outdoor,
    async_get_health,
    async_get_model,
    async_get_neighbors,
    async_get_path,
    async_get_perimeter,
)
from .schemas import (
    ANNOTATE_AREA_SCHEMA,
    DECLARE_CONNECTION_SCHEMA,
    GET_CONNECTIONS_FACING_OUTDOOR_SCHEMA,
    GET_HEALTH_SCHEMA,
    GET_MODEL_SCHEMA,
    GET_NEIGHBORS_SCHEMA,
    GET_PATH_SCHEMA,
    GET_PERIMETER_SCHEMA,
    IMPORT_FROM_CORE_SCHEMA,
    PROJECT_LABELS_SCHEMA,
    SET_BEYOND_SCHEMA,
    SET_EXTERIOR_SCHEMA,
    SET_FLOOR_LEVEL_SCHEMA,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Coroutine
    from typing import Any

    import voluptuous as vol

    from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse

# The six read actions, as ``(name, handler, schema)``. Registered in one loop
# because they differ in nothing else — same response mode, same absence of a
# gate; spelling that out seven lines at a time invites one of them to drift.
_READ_SERVICES: tuple[tuple[str, Any, Any], ...] = (
    (SERVICE_GET_NEIGHBORS, async_get_neighbors, GET_NEIGHBORS_SCHEMA),
    (SERVICE_GET_PATH, async_get_path, GET_PATH_SCHEMA),
    (SERVICE_GET_PERIMETER, async_get_perimeter, GET_PERIMETER_SCHEMA),
    (
        SERVICE_GET_CONNECTIONS_FACING_OUTDOOR,
        async_get_connections_facing_outdoor,
        GET_CONNECTIONS_FACING_OUTDOOR_SCHEMA,
    ),
    (SERVICE_GET_HEALTH, async_get_health, GET_HEALTH_SCHEMA),
    (SERVICE_GET_MODEL, async_get_model, GET_MODEL_SCHEMA),
)


def _register_read_services(hass: HomeAssistant) -> None:
    """Register the response-only read actions (no admin gate — reads)."""
    for name, handler, schema in _READ_SERVICES:
        handler_typed: Callable[[ServiceCall], Coroutine[Any, Any, ServiceResponse]] = handler
        schema_typed: vol.Schema = schema
        hass.services.async_register(
            DOMAIN,
            name,
            handler_typed,
            schema=schema_typed,
            supports_response=SupportsResponse.ONLY,
        )


async def async_setup_services(hass: HomeAssistant) -> None:
    """Register the thirteen topology service actions (§2, D2)."""
    async_register_admin_service(hass, DOMAIN, SERVICE_ANNOTATE_AREA, async_annotate_area, schema=ANNOTATE_AREA_SCHEMA)
    async_register_admin_service(
        hass, DOMAIN, SERVICE_DECLARE_CONNECTION, async_declare_connection, schema=DECLARE_CONNECTION_SCHEMA
    )
    async_register_admin_service(hass, DOMAIN, SERVICE_SET_BEYOND, async_set_beyond, schema=SET_BEYOND_SCHEMA)
    async_register_admin_service(hass, DOMAIN, SERVICE_SET_EXTERIOR, async_set_exterior, schema=SET_EXTERIOR_SCHEMA)
    async_register_admin_service(
        hass, DOMAIN, SERVICE_SET_FLOOR_LEVEL, async_set_floor_level, schema=SET_FLOOR_LEVEL_SCHEMA
    )
    async_register_admin_service(
        hass, DOMAIN, SERVICE_PROJECT_LABELS, async_project_labels, schema=PROJECT_LABELS_SCHEMA
    )
    async_register_admin_service(
        hass, DOMAIN, SERVICE_IMPORT_FROM_CORE, async_import_from_core, schema=IMPORT_FROM_CORE_SCHEMA
    )
    _register_read_services(hass)
