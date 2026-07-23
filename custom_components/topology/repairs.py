"""Repairs platform for topology.

Phase 1 skeleton: no repair issues are raised yet. Phase 6 adds
issues for broken sensor links, contradictory bearings, exterior
windows on non-`outdoor` sides, and isolated indoor areas (see
`docs/development/PLAN.md` §6).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from homeassistant.components.repairs import RepairsFlow

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


async def async_create_fix_flow(
    hass: HomeAssistant,
    issue_id: str,
    data: dict[str, str | int | float | None] | None,
) -> RepairsFlow:
    """Create a repair flow based on the issue_id (placeholder)."""
    return _UnknownIssueRepairFlow()


class _UnknownIssueRepairFlow(RepairsFlow):
    """Fallback flow — acknowledges and closes any unknown issue."""

    async def async_step_init(
        self,
        user_input: dict[str, str] | None = None,
    ):
        """Show a confirmation form and close on submit."""
        if user_input is not None:
            return self.async_create_entry(data={})
        return self.async_show_form(step_id="init")
