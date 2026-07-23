"""
Core coordinator implementation for topology.

Topology is registry-driven and calculated (ADR "Coordinator Role"): the
coordinator does not poll an external service. It owns the in-memory snapshot
and fans changes out to entities and consumers. Phase 1 keeps only the
skeleton; Phase 2 adds the store-backed snapshot, mutation application, and
the ``topology_updated`` bus event (PLAN-topology-phase2.md §6).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.const import DOMAIN, LOGGER
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator

if TYPE_CHECKING:
    from custom_components.topology.data import TopologyConfigEntry
    from homeassistant.core import HomeAssistant


class TopologyCoordinator(DataUpdateCoordinator[Any]):
    """Manage the topology snapshot and fan changes out to entities.

    No ``update_interval`` and no ``_async_update_data``: topology is not
    polled. Updates are pushed via ``async_set_updated_data`` when the store
    mutates or a registry event fires (Phase 2).
    """

    config_entry: TopologyConfigEntry

    def __init__(
        self,
        hass: HomeAssistant,
        config_entry: TopologyConfigEntry,
    ) -> None:
        """Initialize the coordinator without a polling interval."""
        super().__init__(
            hass,
            LOGGER,
            name=DOMAIN,
            config_entry=config_entry,
            update_interval=None,
        )
