"""
Config flow for topology.

Topology is a single-instance hub. It reads the Home Assistant area
and floor registries (and, later, door/window binary sensors) — there
is no per-instance credential or endpoint to configure, and no reason
to have more than one hub entry. The `user` step therefore takes no
input: it aborts if an entry already exists and creates the hub entry
otherwise.

For more information:
https://developers.home-assistant.io/docs/config_entries_config_flow_handler
"""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries

from custom_components.topology.const import DOMAIN


class TopologyConfigFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the single-instance hub config flow for topology."""

    VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Create the hub entry (single instance)."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        return self.async_create_entry(title="Topology", data={})


__all__ = ["TopologyConfigFlowHandler"]
