"""Phase 6 one-shot import tests (PLAN-topology-phase6.md §6).

Covers the fill-empty-only alias/label heuristics, the ``imports_done_at`` stamp,
the setup-time one-shot (opt-in + unstamped) with its stamp guard, and the manual
service re-run that ignores the stamp (D11).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.topology.const import (
    CONF_IMPORT_ALIASES,
    DOMAIN,
    LABEL_OWNED_DESCRIPTION,
    SERVICE_IMPORT_FROM_CORE,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from homeassistant.helpers import area_registry as ar

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.label_registry import LabelRegistry


def _annotation(entry: MockConfigEntry, area_id: str) -> Any:
    snapshot = entry.runtime_data.store.snapshot()
    return next((a for a in snapshot.areas if a.area_id == area_id), None)


async def _import(hass: HomeAssistant, source: str) -> None:
    await hass.services.async_call(DOMAIN, SERVICE_IMPORT_FROM_CORE, {"source": source}, blocking=True)
    await hass.async_block_till_done()


def _write_store(hass: HomeAssistant, payload: dict[str, Any]) -> None:
    """Persist a store payload to disk so setup loads it (envelope form)."""
    storage_dir = Path(hass.config.path(".storage"))
    storage_dir.mkdir(parents=True, exist_ok=True)
    envelope = {"version": STORAGE_VERSION, "minor_version": 1, "key": STORAGE_KEY, "data": payload}
    (storage_dir / STORAGE_KEY).write_text(json.dumps(envelope), encoding="utf-8")


def _store_payload(*, imports_done_at: dict[str, str | None]) -> dict[str, Any]:
    return {
        "schema_version": STORAGE_VERSION,
        "home_config": {
            "occupancy_extent": "whole_property",
            "projection_toggles": {"environment": False, "type": False, "trust": False},
            "imports_done_at": imports_done_at,
            "unannotated_repair_threshold": 3,
        },
        "areas": {},
        "edges": {},
        "floors": {},
    }


async def test_import_aliases_infers_type(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    import_payload: dict[str, str],
) -> None:
    """source=aliases seeds type from an alias/name match + cascades env/trust (fill-empty)."""
    await _import(hass, "aliases")
    kitchen = _annotation(setup_integration, import_payload["kitchen"])
    assert kitchen.type == "kitchen"
    assert kitchen.environment.value == "indoor"
    assert kitchen.trust.value == "private"
    bedroom = _annotation(setup_integration, import_payload["bedroom"])
    assert bedroom.type == "bedroom"
    assert bedroom.environment.value == "indoor"


async def test_import_labels_seeds(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    import_payload: dict[str, str],
    label_registry: LabelRegistry,
) -> None:
    """source=labels seeds environment/type from label names; owned topology:* ignored."""
    # An owned topology label on the prefilled area must be ignored as a source.
    owned = label_registry.async_create("topology:environment:indoor", description=LABEL_OWNED_DESCRIPTION)
    ar.async_get(hass).async_update(import_payload["prefilled"], labels={owned.label_id})

    await _import(hass, "labels")

    shed = _annotation(setup_integration, import_payload["shed"])
    assert shed.environment.value == "outdoor"  # from the "outdoor" user label
    assert shed.type == "garage"  # from the "garage" user label
    assert shed.trust.value == "private"  # cascade from type garage
    # The owned label was ignored: the prefilled area gained no environment.
    prefilled = _annotation(setup_integration, import_payload["prefilled"])
    assert prefilled is None or prefilled.environment is None


async def test_import_fill_empty_only(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    import_payload: dict[str, str],
) -> None:
    """An area with an existing type is never overwritten by import."""
    store = setup_integration.runtime_data.store
    await store.async_update_area(import_payload["kitchen"], {"type": "office"})
    await _import(hass, "aliases")
    assert _annotation(setup_integration, import_payload["kitchen"]).type == "office"


async def test_import_stamps_done_at(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    import_payload: dict[str, str],
) -> None:
    """The import stamps imports_done_at[source] via async_mark_import_done."""
    assert setup_integration.runtime_data.store.snapshot().home_config.imports_done_at_aliases is None
    await _import(hass, "aliases")
    assert setup_integration.runtime_data.store.snapshot().home_config.imports_done_at_aliases is not None


async def test_import_oneshot_at_setup(
    hass: HomeAssistant,
    import_payload: dict[str, str],
    entry_data: dict[str, Any],
) -> None:
    """Opt-in + unstamped ⇒ import runs once at setup; a stamped store does not re-import."""
    # Part A: opted-in, unstamped -> setup imports.
    _write_store(hass, _store_payload(imports_done_at={"aliases": None, "labels": None}))
    entry_a = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, data={**entry_data, CONF_IMPORT_ALIASES: True})
    entry_a.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry_a.entry_id)
    await hass.async_block_till_done()
    assert _annotation(entry_a, import_payload["kitchen"]).type == "kitchen"
    await hass.config_entries.async_remove(entry_a.entry_id)
    await hass.async_block_till_done()

    # Part B: opted-in but already stamped -> setup does NOT re-import.
    _write_store(hass, _store_payload(imports_done_at={"aliases": "2026-01-01T00:00:00+00:00", "labels": None}))
    entry_b = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, data={**entry_data, CONF_IMPORT_ALIASES: True})
    entry_b.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry_b.entry_id)
    await hass.async_block_till_done()
    assert _annotation(entry_b, import_payload["kitchen"]) is None


async def test_mark_import_done_rejects_unknown_source(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
) -> None:
    """async_mark_import_done rejects a source outside the known set (robustness)."""
    with pytest.raises(ValueError, match="unknown import source"):
        await setup_integration.runtime_data.store.async_mark_import_done("bogus")


async def test_import_service_reruns(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    import_payload: dict[str, str],
) -> None:
    """The manual service re-runs regardless of the stamp (D11)."""
    store = setup_integration.runtime_data.store
    await store.async_mark_import_done("aliases")  # pretend it already ran
    await _import(hass, "aliases")
    # The service ignored the stamp and imported anyway.
    assert _annotation(setup_integration, import_payload["kitchen"]).type == "kitchen"
