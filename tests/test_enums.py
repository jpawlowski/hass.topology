"""Enum catalog + unknown-enum downgrade tests (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology import data as topology_data
from custom_components.topology.const import DOMAIN
from custom_components.topology.data import (
    AREA_TYPE_CATALOG,
    CONNECTION_PRESETS,
    TRUST_ORDER,
    Barrier,
    BeyondClass,
    CardinalSide,
    ConnectionPreset,
    Environment,
    OccupancyExtent,
    Passage,
    Trust,
)
from homeassistant.helpers import issue_registry as ir

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant

_PRESET_EXPECTATIONS = {
    ConnectionPreset.INTERIOR_DOOR: (Passage.LEVEL, Barrier.DOOR, False, True),
    ConnectionPreset.OPEN_PASSAGE: (Passage.LEVEL, Barrier.OPEN, False, False),
    ConnectionPreset.SHARED_WALL: (Passage.NONE, Barrier.SOLID, False, False),
    ConnectionPreset.OPEN_STAIR: (Passage.STAIRS, Barrier.OPEN, False, False),
    ConnectionPreset.ENCLOSED_STAIR: (Passage.STAIRS, Barrier.DOOR, False, True),
    ConnectionPreset.LIFT: (Passage.ELEVATOR, Barrier.DOOR, False, True),
    ConnectionPreset.LOFT_LADDER: (Passage.LADDER, Barrier.DOOR, False, True),
    ConnectionPreset.RAMP: (Passage.RAMP, Barrier.OPEN, False, False),
    ConnectionPreset.WINDOW: (Passage.NONE, Barrier.DOOR, True, True),
    ConnectionPreset.OUTSIDE_DOOR: (Passage.LEVEL, Barrier.DOOR, False, True),
}


def test_enum_catalog_frozen() -> None:
    """The exact member sets of all §3 enums are frozen."""
    assert {member.value for member in Environment} == {"indoor", "outdoor", "semi_outdoor"}
    assert {member.value for member in Trust} == {"private", "shared", "public"}
    assert {member.value for member in Passage} == {"none", "level", "stairs", "ramp", "elevator", "ladder", "hatch"}
    assert {member.value for member in Barrier} == {"open", "door", "solid"}
    assert {member.value for member in CardinalSide} == {"N", "E", "S", "W"}
    assert {member.value for member in BeyondClass} == {"outdoor", "neighbor", "earth"}
    assert {member.value for member in OccupancyExtent} == {"whole_property", "unit_within_building"}
    assert AREA_TYPE_CATALOG == (
        "bedroom",
        "living",
        "kitchen",
        "dining",
        "bathroom",
        "hallway",
        "office",
        "utility",
        "storage",
        "garage",
        "balcony",
        "terrace",
        "outdoor",
    )
    assert {member.value for member in ConnectionPreset} == {
        "interior_door",
        "open_passage",
        "shared_wall",
        "open_stair",
        "enclosed_stair",
        "lift",
        "loft_ladder",
        "ramp",
        "window",
        "outside_door",
    }


def test_preset_expansion_table() -> None:
    """Every §3.9 preset expands to the frozen passage/barrier/glazed/sensor."""
    assert set(CONNECTION_PRESETS) == set(_PRESET_EXPECTATIONS)
    for preset, (passage, barrier, glazed, sensor) in _PRESET_EXPECTATIONS.items():
        definition = CONNECTION_PRESETS[preset]
        assert definition.passage is passage
        assert definition.barrier is barrier
        assert definition.glazed_default is glazed
        assert definition.sensor_allowed is sensor


def test_trust_ordering() -> None:
    """TRUST_ORDER proves private < shared < public."""
    assert TRUST_ORDER[Trust.PRIVATE] < TRUST_ORDER[Trust.SHARED] < TRUST_ORDER[Trust.PUBLIC]


async def test_type_open_catalog_passthrough(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """A custom type is stored and served verbatim with no repair issue."""
    store = setup_integration.runtime_data.store
    await store.async_update_area("flur", {"type": "sauna"})
    setup_integration.runtime_data.coordinator.async_seed(store.snapshot())

    annotation = next(a for a in store.snapshot().areas if a.area_id == "flur")
    assert annotation.type == "sauna"
    assert store.snapshot().unknown_enum_values == ()
    registry = ir.async_get(hass)
    assert registry.async_get_issue(DOMAIN, "unknown_enum_after_downgrade") is None


def test_unknown_environment_reads_null(store_payload_full: dict[str, Any]) -> None:
    """A stored environment value outside the catalog reads as null."""
    store_payload_full["areas"]["kueche"]["environment"] = "underwater"
    snapshot = topology_data.snapshot_from_store(store_payload_full)
    kueche = next(a for a in snapshot.areas if a.area_id == "kueche")
    assert kueche.environment is None
    assert any(
        u.scope == "area" and u.id == "kueche" and u.field_name == "environment" and u.value == "underwater"
        for u in snapshot.unknown_enum_values
    )


async def test_unknown_enum_creates_repair(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    area_registry: Any,
) -> None:
    """An unknown enum value raises the repair issue once, with placeholders."""
    store_payload_full["areas"]["kueche"]["environment"] = "underwater"
    load_payload(setup_integration, store_payload_full)

    registry = ir.async_get(hass)
    issue = registry.async_get_issue(DOMAIN, "unknown_enum_after_downgrade")
    assert issue is not None
    assert issue.translation_placeholders is not None
    assert issue.translation_placeholders["field"] == "environment"
    assert issue.translation_placeholders["value"] == "underwater"
    assert issue.translation_placeholders["count"] == "1"


async def test_unknown_enum_raw_preserved(
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    area_registry: Any,
) -> None:
    """Mutating an unrelated field re-saves the unknown raw value untouched."""
    store_payload_full["areas"]["kueche"]["environment"] = "underwater"
    load_payload(setup_integration, store_payload_full)
    store = setup_integration.runtime_data.store

    await store.async_update_area("flur", {"type": "hallway"})

    assert store.data["areas"]["kueche"]["environment"] == "underwater"


async def test_unknown_enum_in_health(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
    area_registry: Any,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """The unknown value is listed in health.unknown_enum_values."""
    store_payload_full["areas"]["kueche"]["environment"] = "underwater"
    load_payload(setup_integration, store_payload_full)

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/health"})
    response = await client.receive_json()
    assert response["success"]
    unknowns = response["result"]["unknown_enum_values"]
    assert {"scope": "area", "id": "kueche", "field": "environment", "value": "underwater"} in unknowns
