"""
Service actions package for topology (PLAN-topology-phase6.md §2).

``async_setup_services`` registers the seven v1 services from ``async_setup``
(Quality-Scale ``action-setup``), all admin-gated via
``async_register_admin_service`` — automations/scripts without a user context are
allowed, a non-admin UI user is rejected (Appendix A.1, D4). Each service
resolves the loaded singleton runtime at call time and raises translated
exceptions (§3).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import (
    DOMAIN,
    SERVICE_ANNOTATE_AREA,
    SERVICE_DECLARE_CONNECTION,
    SERVICE_IMPORT_FROM_CORE,
    SERVICE_PROJECT_LABELS,
    SERVICE_SET_BEYOND,
    SERVICE_SET_EXTERIOR,
    SERVICE_SET_FLOOR_LEVEL,
)
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
from .schemas import (
    ANNOTATE_AREA_SCHEMA,
    DECLARE_CONNECTION_SCHEMA,
    IMPORT_FROM_CORE_SCHEMA,
    PROJECT_LABELS_SCHEMA,
    SET_BEYOND_SCHEMA,
    SET_EXTERIOR_SCHEMA,
    SET_FLOOR_LEVEL_SCHEMA,
)

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


async def async_setup_services(hass: HomeAssistant) -> None:
    """Register the seven topology service actions (§2, D2)."""
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
