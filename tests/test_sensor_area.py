"""Phase 3 per-area diagnostic sensor tests (PLAN-topology-phase3.md §9, §3.3)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

from custom_components.topology.const import STORAGE_KEY
from custom_components.topology.store import default_store_data
from homeassistant.const import EntityCategory
from homeassistant.helpers import area_registry as ar, entity_registry as er

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant


def _dims(entry_id: str, area_id: str) -> dict[str, str]:
    """Return the expected {dimension: unique_id} map for an area."""
    return {dim: f"{entry_id}_{area_id}_{dim}" for dim in ("type", "environment", "trust")}


async def _annotate(hass: HomeAssistant, entry: MockConfigEntry, area_id: str, updates: dict[str, Any]) -> None:
    """Apply an area annotation via the store and publish it to entities."""
    await entry.runtime_data.store.async_update_area(area_id, updates)
    entry.runtime_data.coordinator.async_publish(entry.runtime_data.store.snapshot(), "area", [area_id])
    await hass.async_block_till_done()


async def test_area_triple_created_disabled(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Three diagnostic sensors per area, disabled by default (§3.3)."""
    registry = er.async_get(hass)
    for dim, unique_id in _dims(setup_integration.entry_id, "flur").items():
        entity_id = registry.async_get_entity_id("sensor", "topology", unique_id)
        assert entity_id is not None, dim
        entry = registry.async_get(entity_id)
        assert entry is not None
        assert entry.disabled is True
        assert entry.entity_category == EntityCategory.DIAGNOSTIC


async def test_area_entity_ids(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """entity_ids follow sensor.topology_<slug>_<dimension> (§4.3)."""
    registry = er.async_get(hass)
    for dim in ("type", "environment", "trust"):
        unique_id = f"{setup_integration.entry_id}_flur_{dim}"
        assert registry.async_get_entity_id("sensor", "topology", unique_id) == f"sensor.topology_flur_{dim}"


async def test_area_unique_ids_area_id_based(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """unique_ids are entry_id + area_id + dimension (§4.2)."""
    registry = er.async_get(hass)
    unique_ids = {
        entry.unique_id
        for entry in er.async_entries_for_config_entry(registry, setup_integration.entry_id)
        if "_flur_" in entry.unique_id
    }
    assert unique_ids == set(_dims(setup_integration.entry_id, "flur").values())


async def test_area_unique_id_survives_rename(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """Renaming the area keeps unique_id and the entity_id (§4, D4)."""
    await enable_all(setup_integration)
    registry = er.async_get(hass)
    unique_id = f"{setup_integration.entry_id}_flur_type"
    before = registry.async_get_entity_id("sensor", "topology", unique_id)
    assert before == "sensor.topology_flur_type"

    area_registry.async_update("flur", name="Entrance Hall")
    await hass.async_block_till_done()

    after = registry.async_get_entity_id("sensor", "topology", unique_id)
    assert after == before  # entity_id unchanged, unique_id unchanged


async def test_area_type_open_catalog_state(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """A custom type value passes through verbatim (open catalog, D5)."""
    await enable_all(setup_integration)
    await _annotate(hass, setup_integration, "flur", {"type": "sauna"})
    state = hass.states.get("sensor.topology_flur_type")
    assert state is not None
    assert state.state == "sauna"
    assert "device_class" not in state.attributes  # not an ENUM sensor
    assert state.attributes["area_id"] == "flur"


async def test_area_environment_enum_state(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """The environment sensor is an ENUM with catalog options (§3.3)."""
    await enable_all(setup_integration)
    await _annotate(hass, setup_integration, "flur", {"environment": "indoor"})
    state = hass.states.get("sensor.topology_flur_environment")
    assert state is not None
    assert state.state == "indoor"
    assert state.attributes["device_class"] == "enum"
    assert state.attributes["options"] == ["indoor", "outdoor", "semi_outdoor"]


async def test_area_trust_enum_state(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """The trust sensor is an ENUM reporting the stored value (§3.3)."""
    await enable_all(setup_integration)
    await _annotate(hass, setup_integration, "flur", {"trust": "shared"})
    state = hass.states.get("sensor.topology_flur_trust")
    assert state is not None
    assert state.state == "shared"
    assert state.attributes["options"] == ["private", "shared", "public"]


async def test_area_unknown_enum_reads_unknown(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """An out-of-catalog stored enum reads as unknown, not a default (§2.4)."""
    await enable_all(setup_integration)
    store = setup_integration.runtime_data.store
    store.data["areas"]["flur"] = {"environment": "underwater", "updated_at": "2026-01-01T00:00:00+00:00"}
    setup_integration.runtime_data.coordinator.async_publish(store.snapshot(), "area", ["flur"])
    await hass.async_block_till_done()
    state = hass.states.get("sensor.topology_flur_environment")
    assert state is not None
    assert state.state == "unknown"


async def test_area_null_is_unknown(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """An unannotated area reads unknown for all three dimensions."""
    await enable_all(setup_integration)
    for dim in ("type", "environment", "trust"):
        state = hass.states.get(f"sensor.topology_flur_{dim}")
        assert state is not None
        assert state.state == "unknown"


async def test_area_added_dynamically(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A new registry area gets its triple via the coordinator listener (§6.1)."""
    registry = er.async_get(hass)
    garage = area_registry.async_create("Garage")
    await hass.async_block_till_done()
    for dim in ("type", "environment", "trust"):
        unique_id = f"{setup_integration.entry_id}_{garage.id}_{dim}"
        assert registry.async_get_entity_id("sensor", "topology", unique_id) is not None


async def test_area_removed_unavailable(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """Removing an area makes its sensors unavailable, not deleted (D11)."""
    await enable_all(setup_integration)
    await _annotate(hass, setup_integration, "flur", {"type": "hallway"})
    assert hass.states.get("sensor.topology_flur_type").state == "hallway"

    area_registry.async_delete("flur")
    await hass.async_block_till_done()

    state = hass.states.get("sensor.topology_flur_type")
    assert state is not None
    assert state.state == "unavailable"
    # Still registered (undo window), not deleted.
    registry = er.async_get(hass)
    assert registry.async_get_entity_id("sensor", "topology", f"{setup_integration.entry_id}_flur_type") is not None

    # Re-creating the area with the same id restores availability (§3.5).
    area_registry.async_create("flur")
    await hass.async_block_till_done()
    assert hass.states.get("sensor.topology_flur_type").state != "unavailable"


async def test_area_refreshes_on_mutation(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """A store mutation updates the matching per-area sensor state."""
    await enable_all(setup_integration)
    assert hass.states.get("sensor.topology_flur_trust").state == "unknown"

    await setup_integration.runtime_data.store.async_update_area("flur", {"trust": "private"})
    setup_integration.runtime_data.coordinator.async_publish(
        setup_integration.runtime_data.store.snapshot(), "area", ["flur"]
    )
    await hass.async_block_till_done()
    assert hass.states.get("sensor.topology_flur_trust").state == "private"


async def test_orphaned_area_sensors_restored_on_setup(
    hass: HomeAssistant,
    mock_config_entry: MockConfigEntry,
) -> None:
    """A restart within the orphan window re-creates the removed area's sensors (unavailable)."""
    # Write a store file directly: TopologyStore reads the raw envelope, so this
    # survives setup even though the test harness mocks HA storage in memory.
    data = default_store_data()
    data["areas"]["ghost"] = {
        "type": "bedroom",
        "orphaned_at": "2026-07-24T00:00:00+00:00",
        "updated_at": "2026-07-24T00:00:00+00:00",
    }
    envelope = {"version": 1, "minor_version": 1, "key": STORAGE_KEY, "data": data}
    path = Path(hass.config.path(".storage", STORAGE_KEY))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(envelope), encoding="utf-8")

    mock_config_entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(mock_config_entry.entry_id)
    await hass.async_block_till_done()

    registry = er.async_get(hass)
    for dim in ("type", "environment", "trust"):
        unique_id = f"{mock_config_entry.entry_id}_ghost_{dim}"
        assert registry.async_get_entity_id("sensor", "topology", unique_id) is not None, dim


async def test_area_has_entity_name(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    enable_all: Callable[[MockConfigEntry], Awaitable[None]],
) -> None:
    """Per-area sensors set has_entity_name and use the translation key name."""
    await enable_all(setup_integration)
    registry = er.async_get(hass)
    entity_id = registry.async_get_entity_id("sensor", "topology", f"{setup_integration.entry_id}_flur_environment")
    entry = registry.async_get(entity_id)
    assert entry is not None
    assert entry.has_entity_name is True
    assert entry.translation_key == "area_environment"
