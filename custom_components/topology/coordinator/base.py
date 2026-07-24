"""
Core coordinator implementation for topology.

Topology is registry-driven and calculated (ADR "Coordinator Role"): the
coordinator does not poll. It owns the immutable ``TopologySnapshot`` (as
``DataUpdateCoordinator`` data), publishes new snapshots to entities, fires the
``topology_updated`` bus event on every change (§4.13), and keeps the
unknown-enum repair issue in sync with the loaded payload (§2.4 rule 2).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import DOMAIN, EVENT_TOPOLOGY_UPDATED, LOGGER
from custom_components.topology.entity_utils.derivations import derive
from homeassistant.core import callback
from homeassistant.helpers import area_registry as ar, floor_registry as fr, issue_registry as ir
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

if TYPE_CHECKING:
    from collections.abc import Iterable

    from custom_components.topology.data import TopologyConfigEntry, TopologyDerived, TopologySnapshot
    from custom_components.topology.store import TopologyStore
    from homeassistant.core import HomeAssistant

_UNKNOWN_ENUM_ISSUE = "unknown_enum_after_downgrade"


class TopologyCoordinator(DataUpdateCoordinator["TopologySnapshot"]):
    """Own the topology snapshot and fan changes out to entities and consumers.

    No ``update_interval`` and no ``_async_update_data``: topology is not
    polled. Snapshots are pushed via ``async_set_updated_data`` when the store
    mutates or a registry event fires.
    """

    config_entry: TopologyConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: TopologyConfigEntry,
        store: TopologyStore,
    ) -> None:
        """Initialize the coordinator without a polling interval."""
        super().__init__(
            hass,
            LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=None,
        )
        self.store = store
        # Registry-merged projection consumed by entities (§7.3). Recomputed on
        # every seed/publish; initialized now so the attribute is always set.
        self.derived: TopologyDerived = self._derive(store.snapshot())

    def _derive(self, snapshot: TopologySnapshot) -> TopologyDerived:
        """Merge the registries into the entity-facing projection (§7.3)."""
        return derive(snapshot, ar.async_get(self.hass), fr.async_get(self.hass))

    @callback
    def async_seed(self, snapshot: TopologySnapshot) -> None:
        """Seed the initial snapshot at setup (no bus event fired)."""
        self.derived = self._derive(snapshot)
        self.async_set_updated_data(snapshot)
        self._async_reconcile_unknown_enum_issue(snapshot)

    @callback
    def async_publish(
        self,
        snapshot: TopologySnapshot,
        change: str,
        ids: Iterable[str],
    ) -> None:
        """Push a new snapshot, fire the bus event, and reconcile repairs.

        ``change`` and ``ids`` mirror the WebSocket subscription event (§4.12);
        the bus event (§4.13) is what in-process consumers listen to. The
        registry-merged projection (§7.3) is refreshed before entities are
        notified so ``coordinator.derived`` is consistent with the new snapshot.
        """
        self.derived = self._derive(snapshot)
        self.async_set_updated_data(snapshot)
        self.hass.bus.async_fire(EVENT_TOPOLOGY_UPDATED, {"change": change, "ids": list(ids)})
        self._async_reconcile_unknown_enum_issue(snapshot)

    @callback
    def _async_reconcile_unknown_enum_issue(self, snapshot: TopologySnapshot) -> None:
        """Create or clear the unknown-enum repair issue for this snapshot (§2.4)."""
        unknowns = snapshot.unknown_enum_values
        if not unknowns:
            ir.async_delete_issue(self.hass, DOMAIN, _UNKNOWN_ENUM_ISSUE)
            return
        first = unknowns[0]
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            _UNKNOWN_ENUM_ISSUE,
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key=_UNKNOWN_ENUM_ISSUE,
            translation_placeholders={
                "field": first.field_name,
                "value": first.value,
                "count": str(len(unknowns)),
            },
        )
