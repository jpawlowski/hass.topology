"""Phase 6 service-action tests (PLAN-topology-phase6.md §6).

Covers registration + admin-gating (``action-setup``/A.1), each service's happy
path and its translated validation errors (``action-exceptions``), and the
translation/hassfest shape (services + exceptions + selector blocks).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
import yaml

from custom_components.topology.const import (
    DOMAIN,
    EVENT_TOPOLOGY_UPDATED,
    SERVICE_ANNOTATE_AREA,
    SERVICE_DECLARE_CONNECTION,
    SERVICE_IMPORT_FROM_CORE,
    SERVICE_PROJECT_LABELS,
    SERVICE_SET_BEYOND,
    SERVICE_SET_EXTERIOR,
    SERVICE_SET_FLOOR_LEVEL,
)
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError, Unauthorized
from homeassistant.setup import async_setup_component

if TYPE_CHECKING:
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    from homeassistant.core import Context, HomeAssistant

_ALL_SERVICES = (
    SERVICE_ANNOTATE_AREA,
    SERVICE_DECLARE_CONNECTION,
    SERVICE_SET_BEYOND,
    SERVICE_SET_EXTERIOR,
    SERVICE_SET_FLOOR_LEVEL,
    SERVICE_PROJECT_LABELS,
    SERVICE_IMPORT_FROM_CORE,
)

_TOPOLOGY_DIR = Path(__file__).parent.parent / "custom_components" / "topology"
_TRANSLATIONS_PATH = _TOPOLOGY_DIR / "translations" / "en.json"
_SERVICES_PATH = _TOPOLOGY_DIR / "services.yaml"


def _annotation(entry: MockConfigEntry, area_id: str) -> Any:
    """Return the store annotation for an area id, or None."""
    snapshot = entry.runtime_data.store.snapshot()
    return next((a for a in snapshot.areas if a.area_id == area_id), None)


def _events(hass: HomeAssistant) -> list[dict[str, Any]]:
    """Return a growing list of captured ``topology_updated`` event payloads."""
    captured: list[dict[str, Any]] = []
    hass.bus.async_listen(EVENT_TOPOLOGY_UPDATED, lambda event: captured.append(event.data))
    return captured


async def _call(
    hass: HomeAssistant,
    service: str,
    data: dict[str, Any],
    *,
    context: Context | None = None,
) -> None:
    await hass.services.async_call(DOMAIN, service, data, blocking=True, context=context)
    await hass.async_block_till_done()


# --- registration + admin-gating -------------------------------------------


async def test_services_registered(hass: HomeAssistant) -> None:
    """All seven services exist after async_setup, before any entry (action-setup)."""
    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    for service in _ALL_SERVICES:
        assert hass.services.has_service(DOMAIN, service)


async def test_service_requires_admin(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    admin_context: Context,
    non_admin_context: Context,
) -> None:
    """A non-admin user context is rejected; no-user + admin contexts are allowed (A.1)."""
    with pytest.raises(Unauthorized):
        await _call(hass, SERVICE_ANNOTATE_AREA, {"area_id": "flur", "type": "hallway"}, context=non_admin_context)
    # No-user (automation/script) context runs the handler.
    await _call(hass, SERVICE_ANNOTATE_AREA, {"area_id": "flur", "type": "hallway"})
    assert _annotation(setup_integration, "flur").type == "hallway"
    # An admin user context is also allowed.
    await _call(hass, SERVICE_ANNOTATE_AREA, {"area_id": "wohnzimmer", "type": "living"}, context=admin_context)
    assert _annotation(setup_integration, "wohnzimmer").type == "living"


async def test_service_not_loaded(hass: HomeAssistant) -> None:
    """Calling a service with no loaded entry raises HomeAssistantError (not_loaded)."""
    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    with pytest.raises(HomeAssistantError) as exc:
        await _call(hass, SERVICE_ANNOTATE_AREA, {"area_id": "flur", "type": "hallway"})
    assert exc.value.translation_key == "not_loaded"


# --- annotate_area ---------------------------------------------------------


async def test_annotate_area_sets_fields(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """annotate_area writes type/environment/trust; fans ("area",[id]); house updates."""
    events = _events(hass)
    await _call(
        hass,
        SERVICE_ANNOTATE_AREA,
        {"area_id": "flur", "type": "hallway", "environment": "indoor", "trust": "shared"},
    )
    annotation = _annotation(setup_integration, "flur")
    assert annotation.type == "hallway"
    assert annotation.environment.value == "indoor"
    assert annotation.trust.value == "shared"
    assert {"change": "area", "ids": ["flur"]} in events
    assert hass.states.get("sensor.topology_house").attributes["annotated_count"] == 1


async def test_annotate_area_unknown_area(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """Unknown area_id -> ServiceValidationError (area_not_found with {area_id})."""
    with pytest.raises(ServiceValidationError) as exc:
        await _call(hass, SERVICE_ANNOTATE_AREA, {"area_id": "nope", "type": "kitchen"})
    assert exc.value.translation_key == "area_not_found"
    assert exc.value.translation_placeholders == {"area_id": "nope"}


async def test_annotate_area_nothing(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """No dimension supplied -> nothing_to_update."""
    with pytest.raises(ServiceValidationError) as exc:
        await _call(hass, SERVICE_ANNOTATE_AREA, {"area_id": "flur"})
    assert exc.value.translation_key == "nothing_to_update"


# --- declare_connection ----------------------------------------------------


async def test_declare_connection_preset(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """Preset expands to the frozen passage/barrier; edge created; ("edge",[id]) fired."""
    events = _events(hass)
    await _call(
        hass,
        SERVICE_DECLARE_CONNECTION,
        {"area_a": "flur", "area_b": "wohnzimmer", "preset": "interior_door"},
    )
    snapshot = setup_integration.runtime_data.store.snapshot()
    edge = next(e for e in snapshot.edges if e.edge_id == "flur::wohnzimmer")
    connection = edge.connections[0]
    assert connection.passage.value == "level"
    assert connection.barrier.value == "door"
    assert connection.preset_name == "interior_door"
    assert {"change": "edge", "ids": ["flur::wohnzimmer"]} in events


async def test_declare_connection_with_side_and_sensor(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """Optional side/glazed/sensor pass through onto the built connection (§2.2)."""
    await _call(
        hass,
        SERVICE_DECLARE_CONNECTION,
        {
            "area_a": "flur",
            "area_b": "wohnzimmer",
            "preset": "interior_door",
            "side": "N",
            "glazed": True,
            "sensor": "binary_sensor.door_contact",
        },
    )
    snapshot = setup_integration.runtime_data.store.snapshot()
    connection = next(e for e in snapshot.edges if e.edge_id == "flur::wohnzimmer").connections[0]
    assert connection.side.value == "N"
    assert connection.glazed is True
    assert connection.sensor_entity_id == "binary_sensor.door_contact"


async def test_declare_connection_same_area(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """area_a == area_b -> same_area."""
    with pytest.raises(ServiceValidationError) as exc:
        await _call(
            hass,
            SERVICE_DECLARE_CONNECTION,
            {"area_a": "flur", "area_b": "flur", "preset": "interior_door"},
        )
    assert exc.value.translation_key == "same_area"


async def test_declare_connection_sensor_rule(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """Sensor on a non-door preset -> sensor_requires_door; malformed -> invalid_sensor."""
    with pytest.raises(ServiceValidationError) as exc:
        await _call(
            hass,
            SERVICE_DECLARE_CONNECTION,
            {"area_a": "flur", "area_b": "wohnzimmer", "preset": "open_passage", "sensor": "binary_sensor.door"},
        )
    assert exc.value.translation_key == "sensor_requires_door"

    with pytest.raises(ServiceValidationError) as exc:
        await _call(
            hass,
            SERVICE_DECLARE_CONNECTION,
            {"area_a": "flur", "area_b": "wohnzimmer", "preset": "interior_door", "sensor": "sensor.not_binary"},
        )
    assert exc.value.translation_key == "invalid_sensor"
    assert exc.value.translation_placeholders == {"sensor": "sensor.not_binary"}


async def test_declare_connection_replaces(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """A second declare_connection on the same pair replaces the bundle (D3)."""
    await _call(
        hass,
        SERVICE_DECLARE_CONNECTION,
        {"area_a": "flur", "area_b": "wohnzimmer", "preset": "interior_door"},
    )
    await _call(
        hass,
        SERVICE_DECLARE_CONNECTION,
        {"area_a": "wohnzimmer", "area_b": "flur", "preset": "open_passage"},
    )
    snapshot = setup_integration.runtime_data.store.snapshot()
    edges = [e for e in snapshot.edges if e.edge_id == "flur::wohnzimmer"]
    assert len(edges) == 1
    assert len(edges[0].connections) == 1
    assert edges[0].connections[0].preset_name == "open_passage"


# --- set_beyond ------------------------------------------------------------


async def test_set_beyond_and_clear(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """Sets a beyond side; omitting (or null) clears it."""
    await _call(hass, SERVICE_SET_BEYOND, {"area_id": "flur", "side": "N", "beyond": "neighbor"})
    beyond = dict(_annotation(setup_integration, "flur").beyond)
    assert beyond and beyond[next(iter(beyond))].value == "neighbor"
    # Omitting beyond clears the side.
    await _call(hass, SERVICE_SET_BEYOND, {"area_id": "flur", "side": "N"})
    assert _annotation(setup_integration, "flur").beyond == ()


async def test_set_exterior_list(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """Replaces the exterior-connection list; per-connection sensor validation applies."""
    await _call(
        hass,
        SERVICE_SET_EXTERIOR,
        {
            "area_id": "wohnzimmer",
            "connections": [
                {"passage": "none", "barrier": "door", "side": "S", "sensor_entity_id": "binary_sensor.fenster"},
                {"passage": "none", "barrier": "solid", "side": "W"},  # no sensor -> no cross-field check
            ],
        },
    )
    exterior = _annotation(setup_integration, "wohnzimmer").exterior_connections
    assert len(exterior) == 2
    assert exterior[0].sensor_entity_id == "binary_sensor.fenster"

    with pytest.raises(ServiceValidationError) as exc:
        await _call(
            hass,
            SERVICE_SET_EXTERIOR,
            {
                "area_id": "wohnzimmer",
                "connections": [{"passage": "level", "barrier": "open", "sensor_entity_id": "binary_sensor.x"}],
            },
        )
    assert exc.value.translation_key == "sensor_requires_door"

    # A door barrier with a malformed sensor id -> invalid_sensor.
    with pytest.raises(ServiceValidationError) as exc:
        await _call(
            hass,
            SERVICE_SET_EXTERIOR,
            {
                "area_id": "wohnzimmer",
                "connections": [{"passage": "none", "barrier": "door", "sensor_entity_id": "sensor.bad"}],
            },
        )
    assert exc.value.translation_key == "invalid_sensor"


async def test_set_floor_level(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    two_floor_registry: Any,
) -> None:
    """Sets/clears a floor override; unknown floor -> floor_not_found."""
    await _call(hass, SERVICE_SET_FLOOR_LEVEL, {"floor_id": "ground", "level": 2})
    snapshot = setup_integration.runtime_data.store.snapshot()
    override = next(f for f in snapshot.floors if f.floor_id == "ground")
    assert override.level_override == 2
    # Clearing via omitted level.
    await _call(hass, SERVICE_SET_FLOOR_LEVEL, {"floor_id": "ground"})
    assert not [f for f in setup_integration.runtime_data.store.snapshot().floors if f.floor_id == "ground"]

    with pytest.raises(ServiceValidationError) as exc:
        await _call(hass, SERVICE_SET_FLOOR_LEVEL, {"floor_id": "nope", "level": 1})
    assert exc.value.translation_key == "floor_not_found"
    assert exc.value.translation_placeholders == {"floor_id": "nope"}


# --- translations / hassfest -----------------------------------------------


def _load_translations() -> dict[str, Any]:
    return json.loads(_TRANSLATIONS_PATH.read_text(encoding="utf-8"))


def _load_services_yaml() -> dict[str, Any]:
    return yaml.safe_load(_SERVICES_PATH.read_text(encoding="utf-8"))


def test_service_translations_present() -> None:
    """Every service+field and every raised exceptions.<key> has an en.json entry."""
    translations = _load_translations()
    services_yaml = _load_services_yaml()
    services_block = translations["services"]
    for service, definition in services_yaml.items():
        assert service in services_block, service
        assert services_block[service]["name"]
        assert services_block[service]["description"]
        for field in definition.get("fields") or {}:
            assert field in services_block[service]["fields"], (service, field)
            assert services_block[service]["fields"][field]["name"]

    expected_exceptions = {
        "not_loaded",
        "area_not_found",
        "floor_not_found",
        "same_area",
        "sensor_requires_door",
        "invalid_sensor",
        "nothing_to_update",
        "projection_disabled",
    }
    assert expected_exceptions <= set(translations["exceptions"])
    for key in expected_exceptions:
        assert translations["exceptions"][key]["message"]


def test_selector_translation_keys() -> None:
    """Every select translation_key in services.yaml resolves under selector."""
    translations = _load_translations()
    services_yaml = _load_services_yaml()
    selector_block = translations["selector"]
    seen = False
    for definition in services_yaml.values():
        for field in (definition.get("fields") or {}).values():
            select = (field.get("selector") or {}).get("select")
            if not select or "translation_key" not in select:
                continue
            seen = True
            key = select["translation_key"]
            assert key in selector_block, key
            assert "options" in selector_block[key]
    assert seen


async def test_hassfest_services(hass: HomeAssistant, setup_integration: MockConfigEntry) -> None:
    """Services registered via async_setup match the services.yaml definitions (CI parity)."""
    services_yaml = _load_services_yaml()
    registered = hass.services.async_services().get(DOMAIN, {})
    assert set(services_yaml) == set(_ALL_SERVICES)
    for service in services_yaml:
        assert service in registered
