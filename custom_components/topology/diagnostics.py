"""Diagnostics support for topology.

Phase 1 skeleton: returns bare config-entry and integration metadata.
Later phases add the annotation store, adjacency graph, and health
signal (see `docs/development/PLAN.md` §5 / §8).

https://developers.home-assistant.io/docs/core/integration_diagnostics
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.helpers.redact import async_redact_data

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import TopologyConfigEntry


# No credentials or tokens live in this integration today; kept for
# forward compatibility so future fields cannot accidentally leak.
TO_REDACT: set[str] = set()


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for the topology hub config entry."""
    integration = entry.runtime_data.integration

    return {
        "entry": {
            "entry_id": entry.entry_id,
            "version": entry.version,
            "minor_version": entry.minor_version,
            "domain": entry.domain,
            "title": entry.title,
            "state": str(entry.state),
            "unique_id": entry.unique_id,
            "data": async_redact_data(entry.data, TO_REDACT),
            "options": async_redact_data(entry.options, TO_REDACT),
        },
        "integration": {
            "name": integration.name,
            "version": integration.version,
            "domain": integration.domain,
            "documentation": integration.documentation,
            "issue_tracker": integration.issue_tracker,
        },
    }
