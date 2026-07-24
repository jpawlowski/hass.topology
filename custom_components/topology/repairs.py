"""Repairs platform for topology (Phase 5, PLAN-topology-phase5.md §2–§4).

This module owns the whole issue-registry surface of the integration:

- ``async_reconcile_issues`` is the single reactive reconciler for every
  snapshot-derived issue (§4). The coordinator calls it on every seed and
  publish, right after ``coordinator.derived`` is refreshed, so the issue set
  is always consistent with the live snapshot without any extra scheduling.
- ``TopologyOrphanPurgeRepairFlow`` is the one guided fix flow (§3.1): a
  confirm-then-purge that clears orphaned entries immediately instead of
  waiting for the daily sweep.
- ``async_create_fix_flow`` routes a fixable ``issue_id`` to its flow (§3.3).

The ``store_future_version`` issue is *not* reconciled here — it is raised
before any snapshot exists (setup aborts), so it stays in ``__init__`` (§2.3).

Import discipline (§4.3): this module must not import the coordinator at load
time, or ``coordinator/base.py`` (which imports ``async_reconcile_issues``)
would form a cycle. The coordinator/store are referenced only inside the fix
flow at runtime and typed under ``TYPE_CHECKING``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import voluptuous as vol

from homeassistant import data_entry_flow
from homeassistant.components.repairs import ConfirmRepairFlow, RepairsFlow
from homeassistant.core import callback
from homeassistant.helpers import issue_registry as ir
from homeassistant.util import dt as dt_util

from .const import (
    DOMAIN,
    ISSUE_CONTRADICTORY_BEARINGS,
    ISSUE_EXTERIOR_NON_OUTDOOR,
    ISSUE_INDOOR_WITHOUT_FLOOR,
    ISSUE_ISOLATED_AREAS,
    ISSUE_ORPHANED_ENTRIES,
    ISSUE_UNANNOTATED_THRESHOLD,
    ISSUE_UNKNOWN_ENUM,
    LEARN_MORE_URL,
)

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import TopologyDerived, TopologySnapshot


@callback
def _toggle(
    hass: HomeAssistant,
    issue_id: str,
    *,
    active: bool,
    severity: ir.IssueSeverity = ir.IssueSeverity.WARNING,
    is_fixable: bool = False,
    data: dict[str, str | int | float | None] | None = None,
    placeholders: dict[str, str] | None = None,
) -> None:
    """Create the issue when ``active``, else delete it (idempotent, §4.1).

    ``async_create_issue`` updates an existing issue in place, so repeated
    publishes never stack cards; ``async_delete_issue`` is a no-op when the
    issue is absent, so the delete branch is always safe to call.
    """
    if not active:
        ir.async_delete_issue(hass, DOMAIN, issue_id)
        return
    ir.async_create_issue(
        hass,
        DOMAIN,
        issue_id,
        is_fixable=is_fixable,
        severity=severity,
        translation_key=issue_id,
        learn_more_url=LEARN_MORE_URL,
        data=data,
        translation_placeholders=placeholders,
    )


@callback
def _singleton_entry_id(hass: HomeAssistant) -> str | None:
    """Return the singleton config entry's id (``single_config_entry: true``)."""
    entries = hass.config_entries.async_entries(DOMAIN)
    return entries[0].entry_id if entries else None


@callback
def async_reconcile_issues(
    hass: HomeAssistant,
    snapshot: TopologySnapshot,
    derived: TopologyDerived,
) -> None:
    """Reconcile every snapshot-derived repair issue in one pass (§4.1).

    Called from ``coordinator.async_seed``/``async_publish`` after
    ``coordinator.derived`` is refreshed. Placeholders carry counts and enum
    field names only — never raw ids or names (§2, decision D9).
    """
    threshold = snapshot.home_config.unannotated_repair_threshold
    unannotated_count = len(derived.house.unannotated_areas)
    _toggle(
        hass,
        ISSUE_UNANNOTATED_THRESHOLD,
        active=threshold >= 1 and unannotated_count >= threshold,
        placeholders={"count": str(unannotated_count), "threshold": str(threshold)},
    )

    # Orphan count follows the same rule as ``_build_health`` (``orphaned_at``
    # set on an area, edge, or floor); the reconciler reuses it, it invents no
    # new rule (§4.1).
    orphan_count = (
        sum(1 for area in snapshot.areas if area.orphaned_at is not None)
        + sum(1 for edge in snapshot.edges if edge.orphaned_at is not None)
        + sum(1 for floor in snapshot.floors if floor.orphaned_at is not None)
    )
    entry_id = _singleton_entry_id(hass)
    _toggle(
        hass,
        ISSUE_ORPHANED_ENTRIES,
        active=orphan_count > 0,
        is_fixable=True,
        data={"entry_id": entry_id} if entry_id is not None else None,
        placeholders={"count": str(orphan_count)},
    )

    consistency = derived.consistency
    _toggle(
        hass,
        ISSUE_ISOLATED_AREAS,
        active=bool(consistency.isolated_areas),
        placeholders={"count": str(len(consistency.isolated_areas))},
    )
    _toggle(
        hass,
        ISSUE_INDOOR_WITHOUT_FLOOR,
        active=bool(consistency.indoor_areas_without_floor),
        placeholders={"count": str(len(consistency.indoor_areas_without_floor))},
    )
    _toggle(
        hass,
        ISSUE_CONTRADICTORY_BEARINGS,
        active=bool(consistency.contradictory_bearings),
        placeholders={"count": str(len(consistency.contradictory_bearings))},
    )
    _toggle(
        hass,
        ISSUE_EXTERIOR_NON_OUTDOOR,
        active=bool(consistency.exterior_on_non_outdoor_side),
        placeholders={"count": str(len(consistency.exterior_on_non_outdoor_side))},
    )

    # Unknown-enum: the moved Phase-2 logic, byte-identical placeholders
    # (field/value/count) so behavior is preserved after the consolidation (§4).
    unknowns = snapshot.unknown_enum_values
    _toggle(
        hass,
        ISSUE_UNKNOWN_ENUM,
        active=bool(unknowns),
        placeholders={
            "field": unknowns[0].field_name if unknowns else "",
            "value": unknowns[0].value if unknowns else "",
            "count": str(len(unknowns)),
        },
    )


class TopologyOrphanPurgeRepairFlow(RepairsFlow):
    """Confirm-then-purge flow for orphaned registry entries (§3.1).

    Mirrors ``ConfirmRepairFlow``'s two-step shape, but the confirm step has a
    side effect: it purges every currently-orphaned entry immediately by
    calling ``async_purge_orphans(utcnow())`` (every ``orphaned_at`` is in the
    past), then publishes a ``"purge"`` change so entities and the ``health``
    signal update. Completing the flow makes HA delete the issue; the follow-up
    publish reconciles it away too — both converge on a single removal.
    """

    def __init__(self, entry_id: str) -> None:
        """Store the owning entry id (passed through the issue ``data``, §3.1)."""
        self._entry_id = entry_id

    async def async_step_init(
        self,
        user_input: dict[str, str] | None = None,
    ) -> data_entry_flow.FlowResult:
        """Handle the first step of the fix flow."""
        return await self.async_step_confirm()

    async def async_step_confirm(
        self,
        user_input: dict[str, str] | None = None,
    ) -> data_entry_flow.FlowResult:
        """Purge every currently-orphaned entry on confirm (§3.1)."""
        if user_input is not None:
            entry = self.hass.config_entries.async_get_entry(self._entry_id)
            runtime_data = getattr(entry, "runtime_data", None)
            if runtime_data is not None:
                store = runtime_data.store
                coordinator = runtime_data.coordinator
                cutoff = dt_util.utcnow().isoformat()  # now > every orphaned_at
                snapshot, purged = await store.async_purge_orphans(cutoff)
                if purged:
                    coordinator.async_publish(snapshot, "purge", purged)
            return self.async_create_entry(data={})

        issue_registry = ir.async_get(self.hass)
        description_placeholders = None
        if issue := issue_registry.async_get_issue(self.handler, self.issue_id):
            description_placeholders = issue.translation_placeholders

        return self.async_show_form(
            step_id="confirm",
            data_schema=vol.Schema({}),
            description_placeholders=description_placeholders,
        )


async def async_create_fix_flow(
    hass: HomeAssistant,
    issue_id: str,
    data: dict[str, str | int | float | None] | None,
) -> RepairsFlow:
    """Route a fixable issue to its repair flow (§3.3).

    HA only calls this for issues created with ``is_fixable=True`` — in
    practice only the orphan issue — so the ``ConfirmRepairFlow`` fallback is a
    defensive default that keeps the entry point valid.
    """
    if issue_id == ISSUE_ORPHANED_ENTRIES and data and data.get("entry_id") is not None:
        return TopologyOrphanPurgeRepairFlow(entry_id=str(data["entry_id"]))
    return ConfirmRepairFlow()
