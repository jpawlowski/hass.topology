"""Phase 7 repair deep-link tests (PLAN-topology-phase7.md §3 / §6).

The five reactive informational cards and the fixable orphan card get a per-issue
``learn_more_url`` that opens the panel focused on the matching view; the two
non-panel-remediable cards (``unknown_enum_after_downgrade``,
``store_future_version``) keep the shared repo URL. No issue id, severity,
placeholder, or fixability flag changes (D9) — these tests pin exactly that.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from custom_components.topology.const import (
    DOMAIN,
    ISSUE_CONTRADICTORY_BEARINGS,
    ISSUE_DEEP_LINKS,
    ISSUE_EDGES_SPANNING_FLOORS,
    ISSUE_EXTERIOR_NON_OUTDOOR,
    ISSUE_INDOOR_WITHOUT_FLOOR,
    ISSUE_ISOLATED_AREAS,
    ISSUE_ORPHANED_ENTRIES,
    ISSUE_STORE_FUTURE_VERSION,
    ISSUE_UNANNOTATED_THRESHOLD,
    ISSUE_UNKNOWN_ENUM,
    ISSUE_VERTICAL_WITHOUT_PASSAGE,
    LEARN_MORE_URL,
    PANEL_URL_PATH,
    STORAGE_KEY,
)
from custom_components.topology.repairs import TopologyOrphanPurgeRepairFlow, async_create_fix_flow
from homeassistant.config_entries import ConfigEntryState
from homeassistant.helpers import area_registry as ar, floor_registry as fr, issue_registry as ir

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant


def _issue(hass: HomeAssistant, issue_id: str) -> Any:
    return ir.async_get(hass).async_get_issue(DOMAIN, issue_id)


def _publish(entry: MockConfigEntry, change: str = "seed", ids: list[str] | None = None) -> None:
    coordinator = entry.runtime_data.coordinator
    coordinator.async_publish(entry.runtime_data.store.snapshot(), change, ids or [])


async def test_reactive_cards_deep_link(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    two_floor_registry: fr.FloorRegistry,
) -> None:
    """Each of the five reactive cards carries its `?focus=…` deep-link (§3.1)."""
    store = setup_integration.runtime_data.store

    # A bare seed with three unannotated, edge-less areas raises both the
    # unannotated-threshold and isolated cards at once.
    _publish(setup_integration, "seed")
    unannotated = _issue(hass, ISSUE_UNANNOTATED_THRESHOLD)
    assert unannotated is not None
    assert unannotated.learn_more_url == ISSUE_DEEP_LINKS[ISSUE_UNANNOTATED_THRESHOLD]
    isolated = _issue(hass, ISSUE_ISOLATED_AREAS)
    assert isolated is not None
    assert isolated.learn_more_url == ISSUE_DEEP_LINKS[ISSUE_ISOLATED_AREAS]

    # An interior edge on side N plus a beyond declaration on side N contradict.
    await store.async_upsert_edge("flur", "wohnzimmer", [{"passage": "level", "barrier": "door", "side": "N"}])
    await store.async_set_beyond("flur", "N", "outdoor")
    _publish(setup_integration, "edge", ["flur"])
    bearings = _issue(hass, ISSUE_CONTRADICTORY_BEARINGS)
    assert bearings is not None
    assert bearings.learn_more_url == ISSUE_DEEP_LINKS[ISSUE_CONTRADICTORY_BEARINGS]

    # A glazed opening on a neighbor side raises exterior_on_non_outdoor_side.
    await store.async_set_beyond("flur", "N", "neighbor")
    await store.async_set_exterior_connections(
        "flur", [{"passage": "none", "barrier": "door", "side": "N", "glazed": True}]
    )
    _publish(setup_integration, "exterior", ["flur"])
    exterior = _issue(hass, ISSUE_EXTERIOR_NON_OUTDOOR)
    assert exterior is not None
    assert exterior.learn_more_url == ISSUE_DEEP_LINKS[ISSUE_EXTERIOR_NON_OUTDOOR]

    # An indoor area with no floor, once the home uses floors, is flagged.
    await store.async_update_area("kueche", {"environment": "indoor"})
    floor = next(iter(two_floor_registry.async_list_floors()))
    area_registry.async_update("flur", floor_id=floor.floor_id)
    await hass.async_block_till_done()
    indoor = _issue(hass, ISSUE_INDOOR_WITHOUT_FLOOR)
    assert indoor is not None
    assert indoor.learn_more_url == ISSUE_DEEP_LINKS[ISSUE_INDOOR_WITHOUT_FLOOR]

    # Every deep-link is a same-origin homeassistant:// panel URL (in-app nav).
    for url in ISSUE_DEEP_LINKS.values():
        assert url.startswith(f"homeassistant://{PANEL_URL_PATH}?focus=")


async def test_orphan_card_deep_link_and_flow(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """The orphan card keeps its purge fix-flow AND gains the review deep-link."""
    load_payload(setup_integration, store_payload_full)
    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()

    issue = _issue(hass, ISSUE_ORPHANED_ENTRIES)
    assert issue is not None
    assert issue.is_fixable is True
    assert issue.learn_more_url == ISSUE_DEEP_LINKS[ISSUE_ORPHANED_ENTRIES]

    # The Phase-5 purge flow is still the remediation action (deep-link is context).
    flow = await async_create_fix_flow(hass, ISSUE_ORPHANED_ENTRIES, issue.data)
    assert isinstance(flow, TopologyOrphanPurgeRepairFlow)


async def test_unknown_enum_keeps_repo_url(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    area_registry: ar.AreaRegistry,
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """`unknown_enum_after_downgrade` is not panel-remediable — keeps the repo URL."""
    store_payload_full["areas"]["kueche"]["environment"] = "underwater"
    load_payload(setup_integration, store_payload_full)

    issue = _issue(hass, ISSUE_UNKNOWN_ENUM)
    assert issue is not None
    assert issue.learn_more_url == LEARN_MORE_URL
    assert ISSUE_UNKNOWN_ENUM not in ISSUE_DEEP_LINKS


async def test_store_future_version_keeps_repo(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """`store_future_version` (raised in __init__) keeps the repo URL."""
    envelope = {
        "version": 2,
        "minor_version": 1,
        "key": STORAGE_KEY,
        "data": {"schema_version": 2},
    }
    path = Path(hass.config.path(".storage", STORAGE_KEY))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(envelope), encoding="utf-8")

    mock_config_entry.add_to_hass(hass)
    assert not await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()
    assert mock_config_entry.state is ConfigEntryState.SETUP_ERROR

    issue = _issue(hass, ISSUE_STORE_FUTURE_VERSION)
    assert issue is not None
    assert issue.learn_more_url == LEARN_MORE_URL
    assert ISSUE_STORE_FUTURE_VERSION not in ISSUE_DEEP_LINKS


async def test_deep_link_ids_unchanged(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """The deep-link map only touches learn_more_url, never id/severity/fixability (D9)."""
    _publish(setup_integration, "seed")

    # The five reactive cards stay WARNING + not-fixable; only the URL changed.
    for issue_id in (ISSUE_UNANNOTATED_THRESHOLD, ISSUE_ISOLATED_AREAS):
        issue = _issue(hass, issue_id)
        assert issue is not None
        assert issue.severity == ir.IssueSeverity.WARNING
        assert issue.is_fixable is False

    # Deep-linked ids are the reactive cards + the orphan card. The two
    # edge-geometry advisories share one scope: it lists the flagged edges, and
    # either is resolved from there or by fixing a floor assignment.
    assert set(ISSUE_DEEP_LINKS) == {
        ISSUE_UNANNOTATED_THRESHOLD,
        ISSUE_ISOLATED_AREAS,
        ISSUE_INDOOR_WITHOUT_FLOOR,
        ISSUE_CONTRADICTORY_BEARINGS,
        ISSUE_EXTERIOR_NON_OUTDOOR,
        ISSUE_ORPHANED_ENTRIES,
        ISSUE_EDGES_SPANNING_FLOORS,
        ISSUE_VERTICAL_WITHOUT_PASSAGE,
    }
    assert ISSUE_DEEP_LINKS[ISSUE_EDGES_SPANNING_FLOORS].endswith("?focus=geometry")
    assert ISSUE_DEEP_LINKS[ISSUE_VERTICAL_WITHOUT_PASSAGE].endswith("?focus=geometry")
