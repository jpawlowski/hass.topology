"""Diagnostics support for topology.

Phase 1 stub returning an empty payload. Phase 6 exports the store snapshot
and health signal (with ``async_redact_data`` where needed).

Learn more about diagnostics:
https://developers.home-assistant.io/docs/core/integration_diagnostics
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import TopologyConfigEntry


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for a config entry (empty until Phase 6)."""
    return {}
