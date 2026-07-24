"""Phase 6 diagnostics-export tests (PLAN-topology-phase6.md §6).

Covers the per-bundle pseudonym map (no name-derived id survives, joins intact),
the scoped ``type`` redaction (home_config booleans kept), orphan inclusion, the
absence of registry display names (D7), and a Syrupy regression snapshot.
"""

from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Any

from custom_components.topology.diagnostics import async_get_config_entry_diagnostics
from homeassistant.helpers import area_registry as ar

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from syrupy.assertion import SnapshotAssertion

    from homeassistant.core import HomeAssistant

# Raw name-derived strings that must never appear in a bundle (§4.2).
_RAW_IDS = (
    "flur",
    "wohnzimmer",
    "kueche",
    "etage_3",
    "wohnungstuer_contact",
    "wohnzimmer_fenster_contact",
)


async def _bundle(hass: HomeAssistant, entry: MockConfigEntry) -> dict[str, Any]:
    return await async_get_config_entry_diagnostics(hass, entry)


async def test_diagnostics_pseudonymizes_ids(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[..., None],
) -> None:
    """No raw area/floor/edge/sensor id survives; each maps to a stable token."""
    load_payload(setup_integration, store_payload_full)
    bundle = await _bundle(hass, setup_integration)
    text = json.dumps(bundle)
    for raw in _RAW_IDS:
        assert raw not in text

    for area in bundle["areas"]:
        assert re.fullmatch(r"area_\d+", area["area_id"])
    for floor in bundle["floors"]:
        assert re.fullmatch(r"floor_\d+", floor["floor_id"])
    for edge in bundle["edges"]:
        for part in edge["edge_id"].split("::"):
            assert re.fullmatch(r"area_\d+", part)
    # Sensor object parts become binary_sensor.sensor_<n> (domain kept).
    sensors = [
        connection["sensor_entity_id"]
        for area in bundle["areas"]
        for connection in area["exterior_connections"]
        if "sensor_entity_id" in connection
    ]
    assert sensors
    for sensor in sensors:
        assert re.fullmatch(r"binary_sensor\.sensor_\d+", sensor)


async def test_diagnostics_preserves_joins(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[..., None],
) -> None:
    """An edge_id equals the ::-join of its endpoints' pseudonyms; ids stay consistent."""
    load_payload(setup_integration, store_payload_full)
    bundle = await _bundle(hass, setup_integration)
    for edge in bundle["edges"]:
        assert edge["edge_id"] == f"{edge['area_a']}::{edge['area_b']}"
    # Every edge endpoint token is a token that also appears among the areas.
    area_tokens = {area["area_id"] for area in bundle["areas"]}
    for edge in bundle["edges"]:
        assert edge["area_a"] in area_tokens
        assert edge["area_b"] in area_tokens


async def test_diagnostics_redacts_type(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[..., None],
) -> None:
    """Every area type is REDACTED; enums/booleans/levels/timestamps are kept."""
    load_payload(setup_integration, store_payload_full)
    bundle = await _bundle(hass, setup_integration)
    for area in bundle["areas"]:
        assert area["type"] == "**REDACTED**"
        assert area["environment"] == "indoor"  # enum kept
        assert area["updated_at"]  # timestamp kept
    # The home_config projection toggle named "type" is a boolean, never redacted.
    assert bundle["home_config"]["projection_toggles"]["type"] is False
    assert bundle["floors"][0]["level_override"] == 3  # level kept


async def test_diagnostics_includes_orphans(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    orphaned_payload: dict[str, Any],
    load_payload: Callable[..., None],
) -> None:
    """Orphaned entries appear with pseudonymized ids (ADR debuggability)."""
    load_payload(setup_integration, orphaned_payload)
    bundle = await _bundle(hass, setup_integration)
    orphan_areas = [area for area in bundle["areas"] if area["orphaned_at"] is not None]
    assert orphan_areas
    for area in orphan_areas:
        assert re.fullmatch(r"area_\d+", area["area_id"])
    orphan_edges = [edge for edge in bundle["edges"] if edge["orphaned_at"] is not None]
    assert orphan_edges


async def test_diagnostics_no_names(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[..., None],
) -> None:
    """No registry display name appears anywhere in the bundle (D7)."""
    load_payload(setup_integration, store_payload_full)
    bundle = await _bundle(hass, setup_integration)
    text = json.dumps(bundle)
    for area in ar.async_get(hass).async_list_areas():
        assert area.name not in text


async def test_diagnostics_optional_and_unknown_fields(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    load_payload: Callable[..., None],
) -> None:
    """Covers perimeter_override/inline_trust, a domainless sensor, and unknown enums."""
    payload = {
        "schema_version": 1,
        "home_config": {
            "occupancy_extent": "not_a_real_extent",  # unknown enum (scope=home_config)
            "projection_toggles": {"environment": False, "type": False, "trust": False},
            "imports_done_at": {"aliases": None, "labels": None},
            "unannotated_repair_threshold": 3,
        },
        "areas": {
            "alpha": {
                "type": "custom",
                "environment": "not_a_real_env",  # unknown enum (scope=area)
                "exterior_connections": [
                    {
                        "passage": "none",
                        "barrier": "door",
                        "sensor_entity_id": "domainless",  # no "." -> whole-string pseudonym
                        "perimeter_override": True,
                        "inline_trust": "shared",
                    }
                ],
                "updated_at": "2026-07-23T10:00:00+00:00",
            }
        },
        "edges": {
            "alpha::beta": {
                "area_a": "alpha",
                "area_b": "beta",
                "connections": [{"passage": "teleport", "barrier": "door"}],  # unknown enum (scope=edge)
                "created_at": "2026-07-23T10:05:00+00:00",
            }
        },
        "floors": {},
    }
    load_payload(setup_integration, payload)
    bundle = await _bundle(hass, setup_integration)

    connection = bundle["areas"][0]["exterior_connections"][0]
    assert connection["perimeter_override"] is True
    assert connection["inline_trust"] == "shared"
    assert connection["sensor_entity_id"] == "sensor_1"  # domainless -> whole-string token
    # Unknown-enum entries appear, with area- and edge-scoped ids pseudonymized.
    scopes = {entry["scope"] for entry in bundle["unknown_enum_values"]}
    assert {"area", "edge", "home_config"} <= scopes
    for entry in bundle["unknown_enum_values"]:
        if entry["scope"] == "area":
            assert re.fullmatch(r"area_\d+", entry["id"])
        elif entry["scope"] == "edge":
            for part in entry["id"].split("::"):
                assert re.fullmatch(r"area_\d+", part)
        elif entry["scope"] == "home_config":
            assert entry["id"] == "home_config"  # no name-derived id, kept verbatim


async def test_diagnostics_snapshot(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    store_payload_full: dict[str, Any],
    load_payload: Callable[..., None],
    snapshot: SnapshotAssertion,
) -> None:
    """Syrupy snapshot of a full bundle (regression guard on the frozen shape)."""
    load_payload(setup_integration, store_payload_full)
    bundle = await _bundle(hass, setup_integration)
    assert bundle == snapshot
