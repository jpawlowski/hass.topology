"""Repairs platform for topology.

Phase 1 stub: topology raises no repair issues yet. Phase 2 adds two
non-fixable issues (``store_future_version``, ``unknown_enum_after_downgrade``,
§2.4) that surface information only, so no fix flow is needed for them. This
module keeps a valid ``async_create_fix_flow`` entry point for any future
confirm-style repair.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.components.repairs import ConfirmRepairFlow

if TYPE_CHECKING:
    from homeassistant.components.repairs import RepairsFlow
    from homeassistant.core import HomeAssistant


async def async_create_fix_flow(
    hass: HomeAssistant,
    issue_id: str,
    data: dict[str, str | int | float | None] | None,
) -> RepairsFlow:
    """Create a repair flow for a fixable issue (none defined yet)."""
    return ConfirmRepairFlow()
