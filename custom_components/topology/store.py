"""
Persistent store for topology (PLAN-topology-phase2.md §2, §6).

``TopologyStore`` wraps ``homeassistant.helpers.storage.Store`` for the v1
payload: it loads and validates (raising on corrupt JSON or a future version
without touching the file), migrates old versions through
``async_migrate_store``, debounces saves, and exposes the mutation methods the
WebSocket handlers and registry watcher call. Every mutation returns a fresh
``TopologySnapshot`` (the immutable read model).

The store operates on the raw ``TopologyStoreData`` dict as source of truth and
derives snapshots from it, so unknown-enum raw values in untouched entries are
never rewritten or dropped (§2.4 rule 3).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DEFAULT_UNANNOTATED_REPAIR_THRESHOLD, STORAGE_KEY, STORAGE_VERSION, STORAGE_VERSION_MINOR
from .data import OccupancyExtent, TopologySnapshot, TopologyStoreData, edge_id_for, snapshot_from_store

if TYPE_CHECKING:
    from collections.abc import Mapping

    from homeassistant.core import HomeAssistant

    from .data import AreaAnnotationDict, ConnectionDict, EdgeDict, FloorOverrideDict, HomeConfigDict

# Debounce window for store writes: two mutations within this window coalesce
# into a single disk write (§7 test_store_save_debounced).
_SAVE_DELAY_SECONDS = 1.0


class TopologyStoreError(HomeAssistantError):
    """Base error for the topology store."""


class StoreCorruptError(TopologyStoreError):
    """The on-disk payload is not valid JSON and cannot be loaded."""


class StoreFutureVersionError(TopologyStoreError):
    """The on-disk payload was written by a newer, unsupported schema version."""

    def __init__(self, version: int) -> None:
        """Record the offending on-disk version."""
        super().__init__(f"topology store version {version} is newer than {STORAGE_VERSION}")
        self.version = version


async def async_migrate_store(
    hass: HomeAssistant,
    data: dict[str, Any],
    old_version: int,
) -> dict[str, Any]:
    """Migrate a stored payload to STORAGE_VERSION (§2.3).

    For v1 this is an identity that returns a NEW dict without mutating the
    input. The signature (and its tests) are frozen now so future versions
    extend a total migration chain.
    """
    return dict(data)


def default_store_data() -> TopologyStoreData:
    """Return the default (empty) store payload for a fresh install (§2.5)."""
    return {
        "schema_version": STORAGE_VERSION,
        "home_config": {
            "occupancy_extent": OccupancyExtent.WHOLE_PROPERTY.value,
            "projection_toggles": {"environment": False, "type": False, "trust": False},
            "imports_done_at": {"aliases": None, "labels": None},
            "unannotated_repair_threshold": DEFAULT_UNANNOTATED_REPAIR_THRESHOLD,
        },
        "areas": {},
        "edges": {},
        "floors": {},
    }


def _utcnow_iso() -> str:
    """Return the current time as an aware UTC ISO 8601 string (§2.1)."""
    return dt_util.utcnow().isoformat()


class _TopologyStoreBackend(Store[TopologyStoreData]):
    """Store subclass whose migration hook delegates to async_migrate_store."""

    async def _async_migrate_func(
        self,
        old_major_version: int,
        old_minor_version: int,
        old_data: dict[str, Any],
    ) -> TopologyStoreData:
        """Delegate migration to the module-level hook (§2.3)."""
        return cast("TopologyStoreData", await async_migrate_store(self.hass, old_data, old_major_version))


class TopologyStore:
    """Load, validate, migrate, and mutate the topology store payload."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Create the store wrapper (does not read from disk yet)."""
        self._hass = hass
        self._store = _TopologyStoreBackend(
            hass,
            STORAGE_VERSION,
            STORAGE_KEY,
            private=False,
            atomic_writes=True,
            minor_version=STORAGE_VERSION_MINOR,
        )
        self._data: TopologyStoreData = default_store_data()

    @property
    def data(self) -> TopologyStoreData:
        """Return the current raw store payload."""
        return self._data

    def snapshot(self) -> TopologySnapshot:
        """Return an immutable snapshot of the current payload."""
        return snapshot_from_store(self._data)

    async def async_load(self) -> TopologySnapshot:
        """Load and validate the payload, migrating older versions.

        The on-disk envelope is read directly so corruption and a future
        version can be rejected without the HA Store renaming or rewriting the
        file (§5.1, §5.3 test-before-setup). Migration is routed through the
        frozen ``_async_migrate_func`` hook (§2.3).

        Raises ``StoreCorruptError`` on invalid JSON, ``StoreFutureVersionError``
        on a newer schema version, and ``TopologyStoreError`` on transient I/O.
        """
        envelope = await self._hass.async_add_executor_job(self._read_envelope, self._store.path)
        if envelope is None:
            self._data = default_store_data()
            return self.snapshot()

        version = int(envelope.get("version", STORAGE_VERSION))
        if version > STORAGE_VERSION:
            raise StoreFutureVersionError(version)

        data = envelope.get("data")
        if not isinstance(data, dict):
            raise StoreCorruptError("topology store envelope has no data object")

        if version < STORAGE_VERSION:
            minor = int(envelope.get("minor_version", 1))
            migrated = await self._store._async_migrate_func(version, minor, data)  # noqa: SLF001
            self._data = migrated
            await self._store.async_save(self._data)
        else:
            self._data = cast("TopologyStoreData", data)
        return self.snapshot()

    @staticmethod
    def _read_envelope(path: str) -> dict[str, Any] | None:
        """Read the raw storage envelope, or None for a missing/empty file.

        Raises ``StoreCorruptError`` on invalid JSON, leaving the file in place.
        """
        file_path = Path(path)
        if not file_path.exists():
            return None
        try:
            content = file_path.read_text(encoding="utf-8")
        except OSError as err:  # transient I/O — surfaces as ConfigEntryNotReady
            raise TopologyStoreError(str(err)) from err
        if not content.strip():
            return None
        try:
            envelope = json.loads(content)
        except (json.JSONDecodeError, ValueError) as err:
            raise StoreCorruptError(f"topology store at {path} is not valid JSON") from err
        if not isinstance(envelope, dict):
            raise StoreCorruptError(f"topology store at {path} is not an object")
        return envelope

    # --- persistence -------------------------------------------------------

    def _schedule_save(self) -> None:
        """Debounce a write of the current payload (§2.1)."""
        self._store.async_delay_save(lambda: self._data, _SAVE_DELAY_SECONDS)

    # --- home config -------------------------------------------------------

    def _home_config(self) -> HomeConfigDict:
        return self._data["home_config"]

    async def async_apply_home_config(
        self,
        *,
        occupancy_extent: str | None = None,
        project_environment: bool | None = None,
        project_type: bool | None = None,
        project_trust: bool | None = None,
        unannotated_repair_threshold: int | None = None,
    ) -> TopologySnapshot:
        """Merge home-level config fields into the store (config-flow sync, §5)."""
        home = self._home_config()
        if occupancy_extent is not None:
            home["occupancy_extent"] = occupancy_extent
        toggles = home["projection_toggles"]
        if project_environment is not None:
            toggles["environment"] = project_environment
        if project_type is not None:
            toggles["type"] = project_type
        if project_trust is not None:
            toggles["trust"] = project_trust
        if unannotated_repair_threshold is not None:
            home["unannotated_repair_threshold"] = unannotated_repair_threshold
        self._schedule_save()
        return self.snapshot()

    async def async_update_home_config(
        self,
        *,
        occupancy_extent: str | None = None,
        projection_toggles: Mapping[str, bool] | None = None,
        unannotated_repair_threshold: int | None = None,
    ) -> TopologySnapshot:
        """Apply a partial home-config update from the panel (§4.9)."""
        toggles = projection_toggles or {}
        return await self.async_apply_home_config(
            occupancy_extent=occupancy_extent,
            project_environment=toggles.get("environment"),
            project_type=toggles.get("type"),
            project_trust=toggles.get("trust"),
            unannotated_repair_threshold=unannotated_repair_threshold,
        )

    # --- areas -------------------------------------------------------------

    def _area(self, area_id: str) -> AreaAnnotationDict:
        area = self._data["areas"].get(area_id)
        if area is None:
            new_area: AreaAnnotationDict = {"updated_at": _utcnow_iso()}
            self._data["areas"][area_id] = new_area
            return new_area
        return area

    async def async_update_area(
        self,
        area_id: str,
        updates: Mapping[str, str | None],
    ) -> TopologySnapshot:
        """Partially update an area annotation; explicit None clears a field (§4.2)."""
        area = self._area(area_id)
        for key in ("type", "environment", "trust"):
            if key in updates:
                value = updates[key]
                if value is None:
                    area.pop(key, None)  # type: ignore[misc]
                else:
                    area[key] = value  # type: ignore[literal-required]
        area["updated_at"] = _utcnow_iso()
        self._schedule_save()
        return self.snapshot()

    async def async_set_beyond(
        self,
        area_id: str,
        side: str,
        beyond: str | None,
    ) -> TopologySnapshot:
        """Set or clear one ``beyond`` side of an area (§4.6)."""
        area = self._area(area_id)
        current = dict(area.get("beyond", {}))
        if beyond is None:
            current.pop(side, None)
        else:
            current[side] = beyond
        if current:
            area["beyond"] = current
        else:
            area.pop("beyond", None)
        area["updated_at"] = _utcnow_iso()
        self._schedule_save()
        return self.snapshot()

    async def async_set_exterior_connections(
        self,
        area_id: str,
        connections: list[ConnectionDict],
    ) -> TopologySnapshot:
        """Replace an area's exterior-connection list atomically (§4.7)."""
        area = self._area(area_id)
        if connections:
            area["exterior_connections"] = connections
        else:
            area.pop("exterior_connections", None)
        area["updated_at"] = _utcnow_iso()
        self._schedule_save()
        return self.snapshot()

    def area_exists(self, area_id: str) -> bool:
        """Return whether the store already holds an annotation for the area."""
        return area_id in self._data["areas"]

    # --- edges -------------------------------------------------------------

    def edge_exists(self, edge_id: str) -> bool:
        """Return whether an edge id is present in the store."""
        return edge_id in self._data["edges"]

    def edge(self, edge_id: str) -> EdgeDict | None:
        """Return the raw edge for an id, or None."""
        return self._data["edges"].get(edge_id)

    async def async_upsert_edge(
        self,
        area_a: str,
        area_b: str,
        connections: list[ConnectionDict],
    ) -> tuple[TopologySnapshot, str]:
        """Create or replace the connection bundle for an area pair (§4.3)."""
        edge_id = edge_id_for(area_a, area_b)
        lo, hi = sorted((area_a, area_b))
        existing = self._data["edges"].get(edge_id)
        created_at = existing["created_at"] if existing is not None else _utcnow_iso()
        edge: EdgeDict = {
            "area_a": lo,
            "area_b": hi,
            "connections": connections,
            "created_at": created_at,
        }
        # An explicit upsert clears any orphan flag (user edit = restore, §4.3).
        self._data["edges"][edge_id] = edge
        self._schedule_save()
        return self.snapshot(), edge_id

    async def async_delete_edge(self, edge_id: str) -> TopologySnapshot:
        """Delete an edge immediately (admin action, no orphan window, §4.4)."""
        self._data["edges"].pop(edge_id, None)
        self._schedule_save()
        return self.snapshot()

    async def async_restore_edge(self, edge_id: str) -> TopologySnapshot:
        """Clear an edge's ``orphaned_at`` flag (§4.5)."""
        edge = self._data["edges"].get(edge_id)
        if edge is not None:
            edge.pop("orphaned_at", None)
        self._schedule_save()
        return self.snapshot()

    # --- floors ------------------------------------------------------------

    def floor_exists(self, floor_id: str) -> bool:
        """Return whether a floor override is present in the store."""
        return floor_id in self._data["floors"]

    async def async_set_floor_level(
        self,
        floor_id: str,
        level: int | None,
    ) -> TopologySnapshot:
        """Store or clear a floor-level override (§4.8)."""
        if level is None:
            self._data["floors"].pop(floor_id, None)
        else:
            override: FloorOverrideDict = {
                "level_override": level,
                "updated_at": _utcnow_iso(),
            }
            self._data["floors"][floor_id] = override
        self._schedule_save()
        return self.snapshot()

    # --- registry-driven orphaning + purge (ADR "Registry-Driven State") ---

    async def async_mark_area_orphaned(self, area_id: str) -> tuple[TopologySnapshot, list[str]]:
        """Flag an area annotation and its edges as orphaned; keep the data."""
        now = _utcnow_iso()
        affected: list[str] = []
        area = self._data["areas"].get(area_id)
        if area is not None and "orphaned_at" not in area:
            area["orphaned_at"] = now
            affected.append(area_id)
        for edge_id, edge in self._data["edges"].items():
            if area_id in (edge["area_a"], edge["area_b"]) and "orphaned_at" not in edge:
                edge["orphaned_at"] = now
                affected.append(edge_id)
        if affected:
            self._schedule_save()
        return self.snapshot(), affected

    def area_orphaned(self, area_id: str) -> bool:
        """Return whether the store holds an orphaned annotation for the area."""
        area = self._data["areas"].get(area_id)
        return area is not None and "orphaned_at" in area

    async def async_restore_area(
        self,
        area_id: str,
        present_area_ids: set[str],
    ) -> tuple[TopologySnapshot, list[str]]:
        """Clear orphan flags for a returned area and its now-complete edges.

        Called when a removed area reappears in the registry (same area_id): the
        annotation's ``orphaned_at`` is cleared, and every touching edge whose
        both endpoints exist again is un-orphaned too — so the undo window does
        not purge data the user got back.
        """
        affected: list[str] = []
        area = self._data["areas"].get(area_id)
        if area is not None and "orphaned_at" in area:
            del area["orphaned_at"]
            affected.append(area_id)
        for edge_id, edge in self._data["edges"].items():
            if (
                area_id in (edge["area_a"], edge["area_b"])
                and "orphaned_at" in edge
                and edge["area_a"] in present_area_ids
                and edge["area_b"] in present_area_ids
            ):
                del edge["orphaned_at"]
                affected.append(edge_id)
        if affected:
            self._schedule_save()
        return self.snapshot(), affected

    async def async_mark_floor_orphaned(self, floor_id: str) -> tuple[TopologySnapshot, list[str]]:
        """Flag a floor override as orphaned; keep the data (72 h window)."""
        floor = self._data["floors"].get(floor_id)
        affected: list[str] = []
        if floor is not None and "orphaned_at" not in floor:
            floor["orphaned_at"] = _utcnow_iso()
            affected.append(floor_id)
            self._schedule_save()
        return self.snapshot(), affected

    async def async_purge_orphans(self, cutoff_iso: str) -> tuple[TopologySnapshot, list[str]]:
        """Remove orphaned entries older than the cutoff timestamp (§4.12 purge)."""
        purged: list[str] = []

        for area_id in list(self._data["areas"]):
            orphaned = self._data["areas"][area_id].get("orphaned_at")
            if orphaned is not None and orphaned < cutoff_iso:
                del self._data["areas"][area_id]
                purged.append(area_id)

        for edge_id in list(self._data["edges"]):
            orphaned = self._data["edges"][edge_id].get("orphaned_at")
            if orphaned is not None and orphaned < cutoff_iso:
                del self._data["edges"][edge_id]
                purged.append(edge_id)

        for floor_id in list(self._data["floors"]):
            orphaned = self._data["floors"][floor_id].get("orphaned_at")
            if orphaned is not None and orphaned < cutoff_iso:
                del self._data["floors"][floor_id]
                purged.append(floor_id)

        if purged:
            self._schedule_save()
        return self.snapshot(), purged

    async def async_save_now(self) -> None:
        """Force any pending debounced write to disk immediately."""
        await self._store.async_save(self._data)
