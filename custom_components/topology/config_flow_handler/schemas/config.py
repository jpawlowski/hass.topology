"""
Config-flow schemas for topology (PLAN-topology-phase2.md §5.1).

The ``user`` step collects the home-level configuration; ``reconfigure`` is the
same schema minus the two one-shot import flags (an import that already ran
must not silently re-run — re-import stays a Phase-6 service call, §5.2).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import voluptuous as vol

from custom_components.topology.const import (
    CONF_IMPORT_ALIASES,
    CONF_IMPORT_LABELS,
    CONF_OCCUPANCY_EXTENT,
    CONF_PROJECT_ENVIRONMENT,
    CONF_PROJECT_TRUST,
    CONF_PROJECT_TYPE,
    CONF_UNANNOTATED_REPAIR_THRESHOLD,
    DEFAULT_UNANNOTATED_REPAIR_THRESHOLD,
)
from custom_components.topology.data import OccupancyExtent
from homeassistant.helpers import selector

if TYPE_CHECKING:
    from collections.abc import Mapping
    from typing import Any

_OCCUPANCY_SELECTOR = selector.SelectSelector(
    selector.SelectSelectorConfig(
        options=[OccupancyExtent.WHOLE_PROPERTY.value, OccupancyExtent.UNIT_WITHIN_BUILDING.value],
        mode=selector.SelectSelectorMode.DROPDOWN,
        translation_key=CONF_OCCUPANCY_EXTENT,
    )
)
_THRESHOLD_SELECTOR = selector.NumberSelector(
    selector.NumberSelectorConfig(min=1, max=100, step=1, mode=selector.NumberSelectorMode.BOX)
)


def _occupancy_default(defaults: Mapping[str, Any]) -> str:
    return defaults.get(CONF_OCCUPANCY_EXTENT, OccupancyExtent.WHOLE_PROPERTY.value)


def _projection_fields(defaults: Mapping[str, Any]) -> dict[Any, Any]:
    """Return the projection-toggle + threshold schema fields (shared by both steps)."""
    return {
        vol.Optional(
            CONF_PROJECT_ENVIRONMENT,
            default=defaults.get(CONF_PROJECT_ENVIRONMENT, False),
        ): selector.BooleanSelector(),
        vol.Optional(
            CONF_PROJECT_TYPE,
            default=defaults.get(CONF_PROJECT_TYPE, False),
        ): selector.BooleanSelector(),
        vol.Optional(
            CONF_PROJECT_TRUST,
            default=defaults.get(CONF_PROJECT_TRUST, False),
        ): selector.BooleanSelector(),
        vol.Optional(
            CONF_UNANNOTATED_REPAIR_THRESHOLD,
            default=defaults.get(CONF_UNANNOTATED_REPAIR_THRESHOLD, DEFAULT_UNANNOTATED_REPAIR_THRESHOLD),
        ): _THRESHOLD_SELECTOR,
    }


def get_user_schema(defaults: Mapping[str, Any] | None = None) -> vol.Schema:
    """Return the ``user`` step schema (includes the one-shot import flags)."""
    defaults = defaults or {}
    return vol.Schema(
        {
            vol.Required(CONF_OCCUPANCY_EXTENT, default=_occupancy_default(defaults)): _OCCUPANCY_SELECTOR,
            vol.Optional(
                CONF_IMPORT_ALIASES,
                default=defaults.get(CONF_IMPORT_ALIASES, False),
            ): selector.BooleanSelector(),
            vol.Optional(
                CONF_IMPORT_LABELS,
                default=defaults.get(CONF_IMPORT_LABELS, False),
            ): selector.BooleanSelector(),
            **_projection_fields(defaults),
        }
    )


def get_reconfigure_schema(defaults: Mapping[str, Any] | None = None) -> vol.Schema:
    """Return the ``reconfigure`` step schema (no one-shot import flags, §5.2)."""
    defaults = defaults or {}
    return vol.Schema(
        {
            vol.Required(CONF_OCCUPANCY_EXTENT, default=_occupancy_default(defaults)): _OCCUPANCY_SELECTOR,
            **_projection_fields(defaults),
        }
    )


__all__ = ["get_reconfigure_schema", "get_user_schema"]
