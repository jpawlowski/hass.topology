"""
Config flow for topology.

Topology is a singleton helper (manifest ``single_config_entry: true``). The
flow collects the home-level configuration; Phase 2 fills the schema,
test-before-configure checks, and the reconfigure step (PLAN-topology-phase2.md
§5).

For more information:
https://developers.home-assistant.io/docs/config_entries_config_flow_handler
"""

from __future__ import annotations

from typing import Any

from custom_components.topology.const import DOMAIN
from homeassistant import config_entries

CONFIG_ENTRY_UNIQUE_ID = DOMAIN


class TopologyConfigFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the config flow for topology (single instance)."""

    VERSION = 1
    MINOR_VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle the initial user step.

        Phase 1 stub: creates the singleton entry with no data. Phase 2 adds
        the schema and checks (§5.1).
        """
        await self.async_set_unique_id(CONFIG_ENTRY_UNIQUE_ID)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title="Topology", data=user_input)

        return self.async_show_form(step_id="user")


__all__ = ["TopologyConfigFlowHandler"]
