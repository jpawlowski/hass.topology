"""
Config flow for topology (PLAN-topology-phase2.md §5).

Topology is a singleton helper (manifest ``single_config_entry: true``), so Core
aborts a second flow with ``single_instance_allowed`` before this code runs. The
flow collects the home-level configuration (occupancy extent, projection
toggles, unannotated-repair threshold, and the one-shot import opt-ins) and runs
the test-before-configure checks on submit.

For more information:
https://developers.home-assistant.io/docs/config_entries_config_flow_handler
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.config_flow_handler.schemas.config import get_reconfigure_schema, get_user_schema
from custom_components.topology.const import CONF_UNANNOTATED_REPAIR_THRESHOLD, DOMAIN, STORAGE_VERSION
from custom_components.topology.store import StoreFutureVersionError, TopologyStore, TopologyStoreError
from homeassistant import config_entries

if TYPE_CHECKING:
    from homeassistant.helpers.area_registry import AreaRegistry

CONFIG_ENTRY_UNIQUE_ID = DOMAIN


class TopologyConfigFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the config flow for topology (single instance)."""

    VERSION = STORAGE_VERSION
    MINOR_VERSION = 1

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle the initial user step (§5.1)."""
        await self.async_set_unique_id(CONFIG_ENTRY_UNIQUE_ID)
        self._abort_if_unique_id_configured()

        errors: dict[str, str] = {}
        if user_input is not None:
            abort = await self._async_run_checks(errors)
            if abort is not None:
                return self.async_abort(reason=abort)
            if not errors:
                return self.async_create_entry(title="Topology", data=_normalize(user_input))

        return self.async_show_form(
            step_id="user",
            data_schema=get_user_schema(user_input),
            errors=errors,
        )

    async def async_step_reconfigure(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle reconfiguration of the singleton entry (§5.2)."""
        entry = self._get_reconfigure_entry()

        errors: dict[str, str] = {}
        if user_input is not None:
            abort = await self._async_run_checks(errors)
            if abort is not None:
                return self.async_abort(reason=abort)
            if not errors:
                return self.async_update_reload_and_abort(entry, data_updates=_normalize(user_input))

        defaults = user_input if user_input is not None else dict(entry.data)
        return self.async_show_form(
            step_id="reconfigure",
            data_schema=get_reconfigure_schema(defaults),
            errors=errors,
        )

    async def _async_run_checks(self, errors: dict[str, str]) -> str | None:
        """Run the test-before-configure checks (§5.1).

        Populates ``errors`` with a form error and returns ``None``, or returns
        an abort reason (a form retry cannot fix a store downgrade).
        """
        from homeassistant.helpers import area_registry as ar  # noqa: PLC0415

        try:
            area_reg: AreaRegistry = ar.async_get(self.hass)
            list(area_reg.async_list_areas())
        except Exception:  # noqa: BLE001 — any registry failure blocks setup
            errors["base"] = "area_registry_unavailable"
            return None

        store = TopologyStore(self.hass)
        try:
            await store.async_load()
        except StoreFutureVersionError:
            return "store_future_version"
        except TopologyStoreError:
            # StoreCorruptError is a TopologyStoreError, so the base catches both
            # a corrupt store and any transient store error. A single-type except
            # also avoids the `ruff format` tuple-stripping that produced the
            # original Python-2 `except A, B:` SyntaxError on main.
            errors["base"] = "store_corrupt"
        return None


def _normalize(user_input: dict[str, Any]) -> dict[str, Any]:
    """Coerce flow input into stored entry data (threshold as int)."""
    data = dict(user_input)
    if CONF_UNANNOTATED_REPAIR_THRESHOLD in data:
        data[CONF_UNANNOTATED_REPAIR_THRESHOLD] = int(data[CONF_UNANNOTATED_REPAIR_THRESHOLD])
    return data


__all__ = ["TopologyConfigFlowHandler"]
