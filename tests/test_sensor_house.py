"""Phase 3 household summary sensor tests (PLAN-topology-phase3.md §9, §3.1)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.const import DOMAIN
from homeassistant.helpers import area_registry as ar, entity_registry as er, floor_registry as fr

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant

_HOUSE = "sensor.topology_house"


async def test_house_entity_id_and_unique_id(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """The household sensor uses the frozen entity_id and entry-scoped unique_id (§4)."""
    registry = er.async_get(hass)
    entry = registry.async_get(_HOUSE)
    assert entry is not None
    assert entry.unique_id == f"{setup_integration.entry_id}_house"


async def test_house_state_percentage(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """State is the annotated percentage with % unit and measurement state_class."""
    load_payload(setup_integration, store_payload_full)
    await hass.async_block_till_done()
    state = hass.states.get(_HOUSE)
    assert state is not None
    assert state.state == "100"
    assert state.attributes["unit_of_measurement"] == "%"
    assert state.attributes["state_class"] == "measurement"


async def test_house_state_zero_areas(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """With no registry areas the state is 0 (D10)."""
    mock_config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()
    state = hass.states.get(_HOUSE)
    assert state is not None
    assert state.state == "0"
    assert state.attributes["area_count"] == 0
    assert state.attributes["annotated_count"] == 0


async def test_house_attributes_contract(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """The attribute key set and formats match the frozen contract (§3.1)."""
    area_registry.async_create("Spare")
    load_payload(setup_integration, store_payload_full)
    await hass.async_block_till_done()
    attributes = hass.states.get(_HOUSE).attributes

    assert attributes["occupancy_extent"] == "unit_within_building"  # §2.5 flat
    assert attributes["area_count"] == 4
    assert attributes["annotated_count"] == 3
    spare_id = next(a.id for a in area_registry.async_list_areas() if a.name == "Spare")
    assert attributes["unannotated_areas"] == [spare_id]
    assert attributes["perimeter_connection_count"] == 3
    assert attributes["outdoor_area_count"] == 0
    assert attributes["floor_count"] == 0


async def test_house_outdoor_and_floor_counts(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    two_floor_registry: fr.FloorRegistry,
) -> None:
    """outdoor_area_count counts only environment==outdoor (D7); floor_count is registry floors (D8)."""
    garten = area_registry.async_create("Garten")
    store = setup_integration.runtime_data.store
    store.data["areas"][garten.id] = {"environment": "outdoor", "updated_at": "2026-01-01T00:00:00+00:00"}
    store.data["areas"]["flur"] = {"environment": "semi_outdoor", "updated_at": "2026-01-01T00:00:00+00:00"}
    setup_integration.runtime_data.coordinator.async_seed(store.snapshot())
    await hass.async_block_till_done()

    attributes = hass.states.get(_HOUSE).attributes
    assert attributes["outdoor_area_count"] == 1  # garten only, semi_outdoor excluded
    assert attributes["floor_count"] == 2


async def test_house_enabled_by_default(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """The household sensor is registered enabled."""
    entry = er.async_get(hass).async_get(_HOUSE)
    assert entry is not None
    assert entry.disabled is False


async def test_house_refreshes_on_mutation(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A store mutation updates the household state without a reload."""
    assert hass.states.get(_HOUSE).state == "0"
    await setup_integration.runtime_data.store.async_update_area("flur", {"type": "hallway"})
    setup_integration.runtime_data.coordinator.async_publish(
        setup_integration.runtime_data.store.snapshot(), "area", ["flur"]
    )
    await hass.async_block_till_done()
    # 1 of 3 areas annotated -> round(1/3*100) == 33
    assert hass.states.get(_HOUSE).state == "33"


async def test_house_single_instance(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Exactly one household sensor exists regardless of area count."""
    registry = er.async_get(hass)
    house_entities = [
        entity
        for entity in er.async_entries_for_config_entry(registry, setup_integration.entry_id)
        if entity.unique_id.endswith("_house")
    ]
    assert len(house_entities) == 1
    assert house_entities[0].platform == DOMAIN
