"""Phase 5 repair-issue tests (PLAN-topology-phase5.md §8).

Covers the reactive reconciler (one repair card per snapshot-derived defect,
created when the condition holds and deleted when it clears), the unannotated
threshold boundary, the orphan purge fix flow, unknown-enum parity after the
move out of the coordinator, the ``store_future_version`` boundary, idempotency,
and the translation/hassfest shape.
"""

from __future__ import annotations

from http import HTTPStatus
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from custom_components.topology.const import (
    DOMAIN,
    EVENT_TOPOLOGY_UPDATED,
    ISSUE_CONTRADICTORY_BEARINGS,
    ISSUE_EXTERIOR_NON_OUTDOOR,
    ISSUE_INDOOR_WITHOUT_FLOOR,
    ISSUE_ISOLATED_AREAS,
    ISSUE_ORPHANED_ENTRIES,
    ISSUE_STORE_FUTURE_VERSION,
    ISSUE_UNANNOTATED_THRESHOLD,
    ISSUE_UNKNOWN_ENUM,
    LEARN_MORE_URL,
)
from custom_components.topology.entity_utils.derivations import derive
from custom_components.topology.repairs import (
    ConfirmRepairFlow,
    TopologyOrphanPurgeRepairFlow,
    async_create_fix_flow,
    async_reconcile_issues,
)
from custom_components.topology.store import TopologyStore
from custom_components.topology.websocket_api import _build_health
from homeassistant.helpers import area_registry as ar, floor_registry as fr, issue_registry as ir

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant

_ALL_ISSUE_IDS = (
    ISSUE_STORE_FUTURE_VERSION,
    ISSUE_UNKNOWN_ENUM,
    ISSUE_UNANNOTATED_THRESHOLD,
    ISSUE_ORPHANED_ENTRIES,
    ISSUE_ISOLATED_AREAS,
    ISSUE_INDOOR_WITHOUT_FLOOR,
    ISSUE_CONTRADICTORY_BEARINGS,
    ISSUE_EXTERIOR_NON_OUTDOOR,
)


def _issue(hass: HomeAssistant, issue_id: str) -> Any:
    """Return the topology issue for an id, or None."""
    return ir.async_get(hass).async_get_issue(DOMAIN, issue_id)


def _publish(entry: MockConfigEntry, change: str = "test", ids: list[str] | None = None) -> None:
    """Re-publish the current store snapshot to run the reconciler."""
    coordinator = entry.runtime_data.coordinator
    coordinator.async_publish(entry.runtime_data.store.snapshot(), change, ids or [])


# --- reactive creation / deletion per issue class --------------------------


async def test_no_issues_when_healthy(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    area_registry: ar.AreaRegistry,
    two_floor_registry: fr.FloorRegistry,
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """The fully wired §2.5 home raises zero topology issues; health is ok."""
    load_payload(setup_integration, store_payload_full)

    for issue_id in _ALL_ISSUE_IDS:
        assert _issue(hass, issue_id) is None

    health = _build_health(setup_integration.runtime_data.coordinator.data, area_registry)
    assert health["status"] == "ok"


async def test_unannotated_threshold_created(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    unannotated_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Unannotated count == threshold raises the issue with {count, threshold}."""
    load_payload(setup_integration, unannotated_payload)

    issue = _issue(hass, ISSUE_UNANNOTATED_THRESHOLD)
    assert issue is not None
    assert issue.is_fixable is False
    assert issue.severity == ir.IssueSeverity.WARNING
    assert issue.learn_more_url == LEARN_MORE_URL
    assert issue.translation_placeholders == {"count": "3", "threshold": "3"}


async def test_unannotated_threshold_boundary(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    unannotated_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """count == threshold fires; annotating down to threshold-1 clears it (D5)."""
    load_payload(setup_integration, unannotated_payload)
    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is not None  # count 3 == threshold

    # Annotate one area -> count 2 == threshold - 1 -> below the boundary.
    await setup_integration.runtime_data.store.async_update_area("alpha", {"type": "office"})
    _publish(setup_integration, "area", ["alpha"])

    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is None


async def test_unannotated_threshold_cleared(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    unannotated_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """A reactive publish that drops the count below the threshold deletes the card."""
    load_payload(setup_integration, unannotated_payload)
    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is not None

    store = setup_integration.runtime_data.store
    await store.async_update_area("alpha", {"type": "office"})
    await store.async_update_area("bravo", {"type": "office"})
    _publish(setup_integration, "area", ["alpha", "bravo"])

    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is None


async def test_unannotated_threshold_zero_disables(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    unannotated_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """A threshold below 1 never fires, however many areas are unannotated."""
    unannotated_payload["home_config"]["unannotated_repair_threshold"] = 0
    load_payload(setup_integration, unannotated_payload)

    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is None


async def test_isolated_areas_issue(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Areas with no interior edge are isolated; connecting them clears the card."""
    _publish(setup_integration, "seed")
    assert _issue(hass, ISSUE_ISOLATED_AREAS) is not None

    store = setup_integration.runtime_data.store
    await store.async_upsert_edge("flur", "wohnzimmer", [{"passage": "level", "barrier": "door"}])
    await store.async_upsert_edge("flur", "kueche", [{"passage": "level", "barrier": "door"}])
    _publish(setup_integration, "edge", ["flur"])

    assert _issue(hass, ISSUE_ISOLATED_AREAS) is None


async def test_indoor_without_floor_issue(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    two_floor_registry: fr.FloorRegistry,
) -> None:
    """An indoor floorless area fires only once the home uses floors (mirrors D9)."""
    store = setup_integration.runtime_data.store
    await store.async_update_area("wohnzimmer", {"environment": "indoor"})
    _publish(setup_integration, "area", ["wohnzimmer"])
    # No area has a floor yet -> the home models no floors -> no nag.
    assert _issue(hass, ISSUE_INDOOR_WITHOUT_FLOOR) is None

    floor = next(iter(two_floor_registry.async_list_floors()))
    area_registry.async_update("flur", floor_id=floor.floor_id)  # home now uses floors
    await hass.async_block_till_done()

    assert _issue(hass, ISSUE_INDOOR_WITHOUT_FLOOR) is not None


async def test_contradictory_bearings_issue(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A side used as both an interior edge and a beyond declaration fires (D10)."""
    store = setup_integration.runtime_data.store
    await store.async_upsert_edge("flur", "wohnzimmer", [{"passage": "level", "barrier": "door", "side": "N"}])
    await store.async_set_beyond("flur", "N", "outdoor")
    _publish(setup_integration, "edge", ["flur"])

    assert _issue(hass, ISSUE_CONTRADICTORY_BEARINGS) is not None


async def test_exterior_non_outdoor_issue(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A glazed opening on a neighbor side fires; a plain door on it does not (D11)."""
    store = setup_integration.runtime_data.store
    await store.async_set_beyond("flur", "N", "neighbor")
    await store.async_set_exterior_connections(
        "flur", [{"passage": "none", "barrier": "door", "side": "N", "glazed": True}]
    )
    _publish(setup_integration, "exterior", ["flur"])
    assert _issue(hass, ISSUE_EXTERIOR_NON_OUTDOOR) is not None

    # A non-glazed door on the same neighbor side is the legitimate apartment door.
    await store.async_set_exterior_connections("flur", [{"passage": "level", "barrier": "door", "side": "N"}])
    _publish(setup_integration, "exterior", ["flur"])
    assert _issue(hass, ISSUE_EXTERIOR_NON_OUTDOOR) is None


async def test_unknown_enum_issue_parity(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    area_registry: ar.AreaRegistry,
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """unknown_enum_after_downgrade still toggles with {field, value, count} (D3)."""
    store_payload_full["areas"]["kueche"]["environment"] = "underwater"
    load_payload(setup_integration, store_payload_full)

    issue = _issue(hass, ISSUE_UNKNOWN_ENUM)
    assert issue is not None
    assert issue.translation_placeholders == {"field": "environment", "value": "underwater", "count": "1"}

    # Correcting the value clears the card (re-upgrade path).
    await setup_integration.runtime_data.store.async_update_area("kueche", {"environment": "indoor"})
    _publish(setup_integration, "area", ["kueche"])
    assert _issue(hass, ISSUE_UNKNOWN_ENUM) is None


async def test_store_future_version_untouched(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """The reconciler never creates or deletes store_future_version (setup-owned)."""
    # A pre-existing setup-time card must survive a reconcile pass...
    ir.async_create_issue(
        hass,
        DOMAIN,
        ISSUE_STORE_FUTURE_VERSION,
        is_fixable=False,
        severity=ir.IssueSeverity.ERROR,
        translation_key=ISSUE_STORE_FUTURE_VERSION,
        translation_placeholders={"version": "2"},
    )

    store = TopologyStore(hass)
    snapshot = store.snapshot()
    derived = derive(snapshot, ar.async_get(hass), fr.async_get(hass))
    async_reconcile_issues(hass, snapshot, derived)

    assert _issue(hass, ISSUE_STORE_FUTURE_VERSION) is not None  # not deleted by the reconciler
    # ...and the reconciler never raises it on its own.
    ir.async_delete_issue(hass, DOMAIN, ISSUE_STORE_FUTURE_VERSION)
    async_reconcile_issues(hass, snapshot, derived)
    assert _issue(hass, ISSUE_STORE_FUTURE_VERSION) is None


# --- orphaned entries + fix flow -------------------------------------------


async def test_orphaned_issue_on_area_removal(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Removing a registry area orphans its data and raises a fixable orphan card."""
    load_payload(setup_integration, store_payload_full)
    assert _issue(hass, ISSUE_ORPHANED_ENTRIES) is None

    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()

    issue = _issue(hass, ISSUE_ORPHANED_ENTRIES)
    assert issue is not None
    assert issue.is_fixable is True


async def test_orphaned_issue_cleared_on_restore(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Re-adding the area (watcher restore) clears the card without purging data."""
    load_payload(setup_integration, store_payload_full)
    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()
    assert _issue(hass, ISSUE_ORPHANED_ENTRIES) is not None

    area_registry.async_create("wohnzimmer")
    await hass.async_block_till_done()

    assert _issue(hass, ISSUE_ORPHANED_ENTRIES) is None
    assert "wohnzimmer" in setup_integration.runtime_data.store.data["areas"]  # data kept


async def test_orphan_fix_flow_purges(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    orphaned_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    repairs_client: Any,
) -> None:
    """The fix flow purges every orphan now and HA removes the resolved card."""
    load_payload(setup_integration, orphaned_payload)
    assert _issue(hass, ISSUE_ORPHANED_ENTRIES) is not None

    resp = await repairs_client.post(
        "/api/repairs/issues/fix", json={"handler": DOMAIN, "issue_id": ISSUE_ORPHANED_ENTRIES}
    )
    assert resp.status == HTTPStatus.OK
    flow = await resp.json()
    assert flow["step_id"] == "confirm"

    resp = await repairs_client.post(f"/api/repairs/issues/fix/{flow['flow_id']}", json={})
    assert resp.status == HTTPStatus.OK
    result = await resp.json()
    assert result["type"] == "create_entry"
    await hass.async_block_till_done()

    store = setup_integration.runtime_data.store
    assert "wohnzimmer" not in store.data["areas"]
    assert "flur::wohnzimmer" not in store.data["edges"]
    assert "flur" in store.data["areas"]  # the live entry is untouched
    assert _issue(hass, ISSUE_ORPHANED_ENTRIES) is None


async def test_orphan_fix_flow_publishes(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    orphaned_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    repairs_client: Any,
) -> None:
    """The purge fans out a "purge" change so health.orphaned_* updates."""
    load_payload(setup_integration, orphaned_payload)

    events: list[dict[str, Any]] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, lambda event: events.append(event.data))

    resp = await repairs_client.post(
        "/api/repairs/issues/fix", json={"handler": DOMAIN, "issue_id": ISSUE_ORPHANED_ENTRIES}
    )
    flow = await resp.json()
    await repairs_client.post(f"/api/repairs/issues/fix/{flow['flow_id']}", json={})
    await hass.async_block_till_done()

    assert any(event["change"] == "purge" for event in events)
    health = _build_health(setup_integration.runtime_data.coordinator.data, ar.async_get(hass))
    assert health["orphaned_areas"] == []
    assert health["orphaned_edges"] == []


async def test_orphan_issue_carries_entry_id(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    orphaned_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """The orphan card's data carries the entry_id the fix flow resolves from."""
    load_payload(setup_integration, orphaned_payload)

    issue = _issue(hass, ISSUE_ORPHANED_ENTRIES)
    assert issue is not None
    assert issue.data == {"entry_id": setup_integration.entry_id}


# --- routing / defensive fix-flow branches ---------------------------------


async def test_create_fix_flow_routing(hass: HomeAssistant) -> None:
    """async_create_fix_flow routes the orphan id to the purge flow, else confirm."""
    orphan_flow = await async_create_fix_flow(hass, ISSUE_ORPHANED_ENTRIES, {"entry_id": "abc"})
    assert isinstance(orphan_flow, TopologyOrphanPurgeRepairFlow)

    # Any other id (or the orphan id without data) falls back to the plain confirm flow.
    assert isinstance(await async_create_fix_flow(hass, ISSUE_ISOLATED_AREAS, None), ConfirmRepairFlow)
    assert isinstance(await async_create_fix_flow(hass, ISSUE_ORPHANED_ENTRIES, None), ConfirmRepairFlow)


async def test_fix_flow_missing_entry_safe(hass: HomeAssistant) -> None:
    """Confirming with an unresolvable entry_id still completes without error."""
    flow = TopologyOrphanPurgeRepairFlow(entry_id="does-not-exist")
    flow.hass = hass
    flow.handler = DOMAIN
    flow.issue_id = ISSUE_ORPHANED_ENTRIES

    form = await flow.async_step_init()
    assert form["step_id"] == "confirm"

    result = await flow.async_step_confirm(user_input={})
    assert result["type"] == "create_entry"


# --- idempotency, consolidation, translations ------------------------------


async def test_reconcile_idempotent(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    unannotated_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Two consecutive publishes with the same defect yield exactly one card."""
    load_payload(setup_integration, unannotated_payload)
    _publish(setup_integration, "again")

    registry = ir.async_get(hass)
    matching = [key for key in registry.issues if key == (DOMAIN, ISSUE_UNANNOTATED_THRESHOLD)]
    assert len(matching) == 1


async def test_reconcile_runs_on_seed(
    hass: HomeAssistant,
    area_registry: ar.AreaRegistry,
    setup_integration: MockConfigEntry,
) -> None:
    """Issues exist immediately after setup (the seed path), before any mutation."""
    # area_registry created three unannotated areas before setup ran, so the
    # seed inside async_setup_entry already reconciled the threshold card.
    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is not None


async def test_reconcile_runs_on_registry_event(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
) -> None:
    """A registry area add re-runs the reconciler and toggles the threshold card."""
    registry = ar.async_get(hass)
    registry.async_create("one")
    registry.async_create("two")
    await hass.async_block_till_done()
    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is None  # 2 < threshold 3

    registry.async_create("three")
    await hass.async_block_till_done()
    assert _issue(hass, ISSUE_UNANNOTATED_THRESHOLD) is not None  # 3 == threshold


async def test_issue_placeholders_no_area_ids(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    unannotated_payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """No issue placeholder carries a raw area_id list — counts/field names only (D9)."""
    load_payload(setup_integration, unannotated_payload)

    registry = ir.async_get(hass)
    area_ids = {"alpha", "bravo", "charlie"}
    topology_issues = [issue for (domain, _), issue in registry.issues.items() if domain == DOMAIN]
    assert topology_issues  # some cards are active
    for issue in topology_issues:
        for value in (issue.translation_placeholders or {}).values():
            assert value not in area_ids
            assert "," not in value  # never a joined id list


def test_issue_translations_present() -> None:
    """Every created issue_id has a translation entry; the fixable one has fix_flow."""
    path = Path("custom_components/topology/translations/en.json")
    issues = json.loads(path.read_text(encoding="utf-8"))["issues"]

    for issue_id in _ALL_ISSUE_IDS:
        assert issue_id in issues, issue_id
        assert "title" in issues[issue_id]

    # The seven informational issues use description; the orphan issue uses fix_flow.
    for issue_id in _ALL_ISSUE_IDS:
        entry = issues[issue_id]
        if issue_id == ISSUE_ORPHANED_ENTRIES:
            assert "description" not in entry
            confirm = entry["fix_flow"]["step"]["confirm"]
            assert "title" in confirm
            assert "description" in confirm
        else:
            assert "description" in entry
            assert "fix_flow" not in entry


def test_hassfest_issue_translations() -> None:
    """Every issue matches hassfest's shape: title + exactly one of description/fix_flow."""
    path = Path("custom_components/topology/translations/en.json")
    issues = json.loads(path.read_text(encoding="utf-8"))["issues"]

    for issue_id, entry in issues.items():
        assert "title" in entry, issue_id
        # cv.has_at_least_one_key + Exclusive("description", "fix_flow") in gen_issues_schema.
        assert ("description" in entry) != ("fix_flow" in entry), issue_id
