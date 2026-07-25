"""
Config flow for topology (PLAN-topology-phase2-followup-configflow.md §2).

Topology is a singleton helper (manifest ``single_config_entry: true``), so Core
aborts a second flow with ``single_instance_allowed`` before this code runs.

The flow is **confirm-only**: it collects no data and creates the entry with
``data={}``. Home-level settings live in the store and are edited in the
Topology panel (ADR "Editing Surface"; the tile's "Configure" action routes
there via ``config_panel_domain``). What the flow still does — and why it must
keep existing — is run the three frozen test-before-configure checks on submit
(Bronze ``config-flow`` / ``test-before-configure``); the form is what makes a
*recoverable* check failure displayable at all (D2).

For more information:
https://developers.home-assistant.io/docs/config_entries_config_flow_handler
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.config_flow_handler.schemas.config import get_confirm_schema
from custom_components.topology.const import CONFIG_ENTRY_MINOR_VERSION, CONFIG_ENTRY_VERSION, DOMAIN
from custom_components.topology.store import StoreFutureVersionError, TopologyStore, TopologyStoreError
from homeassistant import config_entries

if TYPE_CHECKING:
    from homeassistant.helpers.area_registry import AreaRegistry

CONFIG_ENTRY_UNIQUE_ID = DOMAIN


class TopologyConfigFlowHandler(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle the config flow for topology (single instance)."""

    # Decoupled from STORAGE_VERSION on purpose (§3.1, D5): the entry version
    # and the store schema version are unrelated numbers.
    VERSION = CONFIG_ENTRY_VERSION
    MINOR_VERSION = CONFIG_ENTRY_MINOR_VERSION

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Handle the initial user step — confirm-only (§2.1)."""
        await self.async_set_unique_id(CONFIG_ENTRY_UNIQUE_ID)
        self._abort_if_unique_id_configured()

        errors: dict[str, str] = {}
        if user_input is not None:
            abort = await self._async_run_checks(errors)
            if abort is not None:
                return self.async_abort(reason=abort)
            if not errors:
                # The home config comes from ``store.default_store_data()``,
                # which is byte-identical to the old flow defaults (§2.1).
                return self.async_create_entry(title="Topology", data={})

        return self.async_show_form(
            step_id="user",
            data_schema=get_confirm_schema(),
            errors=errors,
        )

    async def async_step_reconfigure(
        self,
        user_input: dict[str, Any] | None = None,
    ) -> config_entries.ConfigFlowResult:
        """Reconfigure the singleton entry — re-validate and reload (§2.2).

        The step configures nothing (it kept only the Gold ``reconfiguration-flow``
        affordance): it re-runs the same checks and reloads the entry, which is
        the one user-reachable way to re-validate without removing and re-adding
        the integration. It writes neither ``entry.data`` nor ``home_config``.
        """
        entry = self._get_reconfigure_entry()

        errors: dict[str, str] = {}
        if user_input is not None:
            abort = await self._async_run_checks(errors)
            if abort is not None:
                return self.async_abort(reason=abort)
            if not errors:
                return self.async_update_reload_and_abort(
                    entry,
                    data_updates={},
                    reason="reconfigure_successful",
                )

        return self.async_show_form(
            step_id="reconfigure",
            data_schema=get_confirm_schema(),
            errors=errors,
        )

    async def _async_run_checks(self, errors: dict[str, str]) -> str | None:
        """Run the test-before-configure checks (Phase-2 §5.1, unchanged).

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


__all__ = ["TopologyConfigFlowHandler"]
