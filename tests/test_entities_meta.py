"""Phase 3 contract-freeze, translation, and quality-rule tests (§9)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

from custom_components.topology.binary_sensor import PARALLEL_UPDATES as BINARY_SENSOR_PARALLEL_UPDATES
from custom_components.topology.data import AREA_TYPE_CATALOG
from custom_components.topology.entity_utils.entity_ids import perimeter_object_id, perimeter_unique_id
from custom_components.topology.sensor import PARALLEL_UPDATES as SENSOR_PARALLEL_UPDATES
from homeassistant.helpers import area_registry as ar, entity_registry as er

if TYPE_CHECKING:
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import HomeAssistant

_COMPONENT = Path(__file__).parent.parent / "custom_components" / "topology"


def _load_json(name: str) -> dict:
    return json.loads((_COMPONENT / name).read_text(encoding="utf-8"))


async def test_perimeter_ids_frozen() -> None:
    """The perimeter binary sensor's frozen ids are reserved (§3.2, §4, D1)."""
    assert perimeter_object_id() == "topology_perimeter_open"
    assert perimeter_unique_id("ENTRY") == "ENTRY_perimeter_open"


async def test_perimeter_emitted_phase4(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """The perimeter binary sensor exists from Phase 4 with its frozen unique_id (D1)."""
    registry = er.async_get(hass)
    unique_id = perimeter_unique_id(setup_integration.entry_id)
    entity_id = registry.async_get_entity_id("binary_sensor", "topology", unique_id)
    assert entity_id == "binary_sensor.topology_perimeter_open"
    assert hass.states.get("binary_sensor.topology_perimeter_open") is not None


async def test_entity_translations_present() -> None:
    """Every entity translation_key has a name; ENUM options all have state labels (§5.1)."""
    entity = _load_json("translations/en.json")["entity"]
    assert entity["sensor"]["house"]["name"]
    assert entity["sensor"]["area_type"]["name"]
    assert "state" not in entity["sensor"]["area_type"]  # open catalog (D5)

    env_states = entity["sensor"]["area_environment"]["state"]
    assert set(env_states) == {"indoor", "outdoor", "semi_outdoor"}
    trust_states = entity["sensor"]["area_trust"]["state"]
    assert set(trust_states) == {"private", "shared", "public"}

    perimeter = entity["binary_sensor"]["perimeter_open"]
    assert perimeter["name"]
    assert set(perimeter["state"]) == {"on", "off"}


async def test_icons_json_keyset() -> None:
    """icons.json covers every default + closed-state key (§5.2)."""
    entity = _load_json("icons.json")["entity"]
    assert entity["sensor"]["house"]["default"]
    assert entity["sensor"]["area_type"]["default"]
    # Every shipped catalog type has an icon; custom types fall back to default.
    assert set(entity["sensor"]["area_type"]["state"]) == set(AREA_TYPE_CATALOG)
    assert set(entity["sensor"]["area_environment"]["state"]) == {"indoor", "outdoor", "semi_outdoor"}
    assert set(entity["sensor"]["area_trust"]["state"]) == {"private", "shared", "public"}
    assert set(entity["binary_sensor"]["perimeter_open"]["state"]) == {"on", "off"}


async def test_parallel_updates_zero() -> None:
    """Both platforms declare PARALLEL_UPDATES = 0 (Silver parallel-updates)."""
    assert SENSOR_PARALLEL_UPDATES == 0
    assert BINARY_SENSOR_PARALLEL_UPDATES == 0


async def test_has_entity_name_all(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """Every topology entity sets has_entity_name (Gold has-entity-name)."""
    registry = er.async_get(hass)
    entities = er.async_entries_for_config_entry(registry, setup_integration.entry_id)
    assert entities
    assert all(entity.has_entity_name for entity in entities)
