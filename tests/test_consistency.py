"""Consistency-signal emission tests (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.entity_utils.derivations import build_health
from homeassistant.helpers import area_registry as ar

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant


async def test_health_ok_when_complete(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """A fully annotated home reports status ok with all lists empty."""
    load_payload(setup_integration, store_payload_full)
    health = build_health(setup_integration.runtime_data.coordinator.data, area_registry)
    assert health["status"] == "ok"
    assert health["unannotated_areas"] == []
    assert health["orphaned_areas"] == []
    assert health["orphaned_edges"] == []
    assert health["area_count"] == 3
    assert health["annotated_count"] == 3


async def test_health_unannotated_listed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """A new bare area is listed and flips the status to warning."""
    load_payload(setup_integration, store_payload_full)
    bare = area_registry.async_create("Garage")
    await hass.async_block_till_done()

    health = build_health(setup_integration.runtime_data.coordinator.data, area_registry)
    assert bare.id in health["unannotated_areas"]
    assert health["annotated_count"] == 3
    assert health["area_count"] == 4
    assert health["status"] == "warning"


async def test_health_orphans_listed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Orphaned edge and area ids appear in their respective lists."""
    load_payload(setup_integration, store_payload_full)
    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()

    health = build_health(setup_integration.runtime_data.coordinator.data, area_registry)
    assert "wohnzimmer" in health["orphaned_areas"]
    assert "flur::wohnzimmer" in health["orphaned_edges"]
    assert health["status"] == "warning"


async def test_health_matches_house_sensor_inputs(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Health counts derive consistently from the single snapshot source."""
    load_payload(setup_integration, store_payload_full)
    area_registry.async_create("Spare")  # one unannotated registry area
    await hass.async_block_till_done()

    health = build_health(setup_integration.runtime_data.coordinator.data, area_registry)
    # Every registry area is either annotated or unannotated — the counts partition.
    assert health["annotated_count"] + len(health["unannotated_areas"]) == health["area_count"]
