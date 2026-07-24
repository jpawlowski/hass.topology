"""Phase 4 perimeter-open binary sensor tests (PLAN-topology-phase4.md §7, §2)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.helpers import area_registry as ar, entity_registry as er

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant

_PERIMETER = "binary_sensor.topology_perimeter_open"
_DOOR = "binary_sensor.wohnungstuer_contact"
_WINDOW = "binary_sensor.wohnzimmer_fenster_contact"


async def _load_with_sensors(
    hass: HomeAssistant,
    entry: MockConfigEntry,
    payload: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    *,
    door: str = "off",
    window: str = "off",
) -> None:
    """Seed the two §2.5 bound sensors, then load the perimeter payload."""
    hass.states.async_set(_DOOR, door)
    hass.states.async_set(_WINDOW, window)
    load_payload(entry, payload)
    await hass.async_block_till_done()


async def test_perimeter_entity_identity(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Frozen entity_id/unique_id and device_class opening (§2.1)."""
    registry = er.async_get(hass)
    entity_id = registry.async_get_entity_id(
        "binary_sensor", "topology", f"{setup_integration.entry_id}_perimeter_open"
    )
    assert entity_id == _PERIMETER
    assert hass.states.get(_PERIMETER).attributes["device_class"] == "opening"


async def test_perimeter_off_when_no_sensors(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """With no perimeter payload the aggregate is a steady off (§2.3)."""
    state = hass.states.get(_PERIMETER)
    assert state.state == "off"
    assert state.attributes["monitored_count"] == 0
    assert state.attributes["open_count"] == 0
    assert state.attributes["open_connections"] == []


async def test_perimeter_on_when_bound_sensor_on(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Any open bound sensor turns the aggregate on and lists the connection (§2.3/§2.5)."""
    await _load_with_sensors(hass, setup_integration, store_payload_full, load_payload)
    assert hass.states.get(_PERIMETER).state == "off"
    assert hass.states.get(_PERIMETER).attributes["monitored_count"] == 2

    hass.states.async_set(_DOOR, "on")
    await hass.async_block_till_done()
    state = hass.states.get(_PERIMETER)
    assert state.state == "on"
    open_connections = state.attributes["open_connections"]
    assert [c["source_entity"] for c in open_connections] == [_DOOR]
    assert open_connections[0]["area_id"] == "flur"


async def test_perimeter_off_when_all_closed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """All bound sensors closed → off with empty open_connections."""
    await _load_with_sensors(hass, setup_integration, store_payload_full, load_payload)
    state = hass.states.get(_PERIMETER)
    assert state.state == "off"
    assert state.attributes["open_connections"] == []


async def test_perimeter_unavailable_sensor_ignored(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """An unavailable bound sensor is not open and is surfaced (§2.3/§2.5, D3/D4)."""
    await _load_with_sensors(hass, setup_integration, store_payload_full, load_payload)
    hass.states.async_set(_DOOR, "unavailable")
    await hass.async_block_till_done()
    state = hass.states.get(_PERIMETER)
    assert state.state == "off"
    assert _DOOR in state.attributes["unavailable_sensors"]


async def test_perimeter_tracks_new_binding(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Adding a sensor binding re-subscribes; its state then drives the aggregate (§2.4)."""
    await _load_with_sensors(hass, setup_integration, store_payload_full, load_payload)
    # Bind a new door sensor to the kueche window connection (perimeter, was unbound).
    new_sensor = "binary_sensor.kueche_fenster_contact"
    hass.states.async_set(new_sensor, "on")
    await setup_integration.runtime_data.store.async_set_exterior_connections(
        "kueche",
        [{"passage": "none", "barrier": "door", "side": "S", "glazed": True, "sensor_entity_id": new_sensor}],
    )
    setup_integration.runtime_data.coordinator.async_publish(
        setup_integration.runtime_data.store.snapshot(), "exterior", ["kueche"]
    )
    await hass.async_block_till_done()
    state = hass.states.get(_PERIMETER)
    assert state.state == "on"
    assert new_sensor in [c["source_entity"] for c in state.attributes["open_connections"]]


async def test_perimeter_untrack_removed_binding(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Removing a binding stops that sensor from affecting the aggregate (§2.4)."""
    await _load_with_sensors(hass, setup_integration, store_payload_full, load_payload)
    # Clear the flur exterior connections (drops the door binding).
    await setup_integration.runtime_data.store.async_set_exterior_connections("flur", [])
    setup_integration.runtime_data.coordinator.async_publish(
        setup_integration.runtime_data.store.snapshot(), "exterior", ["flur"]
    )
    await hass.async_block_till_done()
    assert hass.states.get(_PERIMETER).attributes["monitored_count"] == 1

    # The now-untracked door going open must not turn the aggregate on.
    hass.states.async_set(_DOOR, "on")
    await hass.async_block_till_done()
    assert hass.states.get(_PERIMETER).state == "off"


async def test_perimeter_orphaned_excluded(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """A perimeter connection on an orphaned area is not tracked (§2.2)."""
    await _load_with_sensors(hass, setup_integration, store_payload_full, load_payload)
    area_registry.async_delete("flur")
    await hass.async_block_till_done()
    state = hass.states.get(_PERIMETER)
    assert state.attributes["monitored_count"] == 1  # only wohnzimmer window remains
    hass.states.async_set(_DOOR, "on")
    await hass.async_block_till_done()
    assert hass.states.get(_PERIMETER).state == "off"


async def test_perimeter_debounce_coalesces(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """Rapid bound-sensor changes settle to the correct final state (§2.3, D5)."""
    await _load_with_sensors(hass, setup_integration, store_payload_full, load_payload)
    hass.states.async_set(_DOOR, "on")
    hass.states.async_set(_DOOR, "off")
    hass.states.async_set(_WINDOW, "on")
    await hass.async_block_till_done()
    assert hass.states.get(_PERIMETER).state == "on"


async def test_perimeter_enabled_single_instance(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Registered enabled, exactly one instance."""
    registry = er.async_get(hass)
    entries = [
        entity
        for entity in er.async_entries_for_config_entry(registry, setup_integration.entry_id)
        if entity.domain == "binary_sensor"
    ]
    assert len(entries) == 1
    assert entries[0].disabled is False
