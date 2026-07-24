"""
Area/floor registry watcher for topology (ADR "Registry-Driven State").

Subscribes to the area and floor registry update events and applies the ADR
reactions: orphan-mark on removal (areas, their edges, and floor overrides
alike — keeping the data for the 72 h undo window), snapshot fanout on
create/update/reorder, and a startup plus daily purge of entries whose undo
window has elapsed.

Event constants and payload shapes are verified against HA 2026.7.0
(PLAN-topology-phase2.md Appendix A.2/A.3); the floor ``reorder`` action
carries no ``floor_id``, so the handler branches on ``action`` first.
"""

from __future__ import annotations

from datetime import timedelta
from typing import TYPE_CHECKING

from custom_components.topology.const import ORPHAN_UNDO_WINDOW
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers.area_registry import EVENT_AREA_REGISTRY_UPDATED
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.floor_registry import EVENT_FLOOR_REGISTRY_UPDATED
from homeassistant.util import dt as dt_util

if TYPE_CHECKING:
    from collections.abc import Callable
    from datetime import datetime

    from homeassistant.core import Event, HomeAssistant
    from homeassistant.helpers.area_registry import EventAreaRegistryUpdatedData
    from homeassistant.helpers.floor_registry import EventFloorRegistryUpdatedData

    from .base import TopologyCoordinator

# Orphaned entries are purged by a once-a-day sweep (plus a startup sweep).
_PURGE_INTERVAL = timedelta(days=1)


class TopologyRegistryWatcher:
    """React to area/floor registry changes and run the orphan purge timer."""

    def __init__(self, hass: HomeAssistant, coordinator: TopologyCoordinator) -> None:
        """Bind the watcher to the coordinator and its store."""
        self._hass = hass
        self._coordinator = coordinator
        self._store = coordinator.store
        self._unsubs: list[Callable[[], None]] = []

    def async_start(self) -> None:
        """Subscribe to registry events and start the daily purge timer."""
        self._unsubs.append(self._hass.bus.async_listen(EVENT_AREA_REGISTRY_UPDATED, self._async_handle_area_event))
        self._unsubs.append(self._hass.bus.async_listen(EVENT_FLOOR_REGISTRY_UPDATED, self._async_handle_floor_event))
        self._unsubs.append(async_track_time_interval(self._hass, self._async_handle_purge_timer, _PURGE_INTERVAL))

    def async_stop(self) -> None:
        """Remove all registry listeners and cancel the purge timer."""
        while self._unsubs:
            self._unsubs.pop()()

    async def async_startup_purge(self) -> None:
        """Purge entries already past their undo window at setup time."""
        await self._async_purge()

    async def _async_handle_area_event(self, event: Event[EventAreaRegistryUpdatedData]) -> None:
        """Handle an area registry update (create/update/remove/reorder)."""
        action = event.data["action"]
        area_id = event.data.get("area_id")

        if action == "remove" and area_id is not None:
            snapshot, affected = await self._store.async_mark_area_orphaned(area_id)
            if affected:
                self._coordinator.async_publish(snapshot, "orphan", affected)
            else:
                self._coordinator.async_publish(snapshot, "area", [area_id])
        elif action in ("create", "update") and area_id is not None:
            # A removed area that reappears with the same id must lose its orphan
            # flag (and its now-complete edges), else the undo window purges data
            # the user got back. For all other create/update events this is a
            # no-op that just fans out the merged registry view.
            present = {area.id for area in ar.async_get(self._hass).async_list_areas()}
            snapshot, affected = await self._store.async_restore_area(area_id, present)
            self._coordinator.async_publish(snapshot, "area", affected or [area_id])
        elif action in ("create", "update"):
            self._coordinator.async_publish(self._store.snapshot(), "area", [])

    async def _async_handle_floor_event(self, event: Event[EventFloorRegistryUpdatedData]) -> None:
        """Handle a floor registry update; branch on action before floor_id."""
        action = event.data["action"]
        if action == "reorder":
            self._coordinator.async_publish(self._store.snapshot(), "floor", [])
            return

        floor_id = event.data.get("floor_id")
        if action == "remove" and floor_id is not None:
            snapshot, affected = await self._store.async_mark_floor_orphaned(floor_id)
            if affected:
                self._coordinator.async_publish(snapshot, "orphan", affected)
            else:
                self._coordinator.async_publish(snapshot, "floor", [floor_id])
        elif floor_id is not None:
            self._coordinator.async_publish(self._store.snapshot(), "floor", [floor_id])

    async def _async_handle_purge_timer(self, _now: datetime) -> None:
        """Daily purge callback."""
        await self._async_purge()

    async def _async_purge(self) -> None:
        """Purge orphaned entries older than the undo window, fanning out purges."""
        cutoff = (dt_util.utcnow() - ORPHAN_UNDO_WINDOW).isoformat()
        snapshot, purged = await self._store.async_purge_orphans(cutoff)
        if purged:
            self._coordinator.async_publish(snapshot, "purge", purged)
