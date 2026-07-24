"""Phase 6 label-projection tests (PLAN-topology-phase6.md §6).

Covers the owned + namespaced projection executor: creating owned
``topology:<dim>:<value>`` labels, scope gating, pruning on clear/toggle-off,
never touching user labels, and the two effective-wiring sites (setup and
``ws_update_home_config``).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.topology.const import (
    CONF_PROJECT_ENVIRONMENT,
    DOMAIN,
    LABEL_OWNED_DESCRIPTION,
    SERVICE_ANNOTATE_AREA,
    SERVICE_PROJECT_LABELS,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import area_registry as ar

if TYPE_CHECKING:
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.label_registry import LabelRegistry


async def _annotate(hass: HomeAssistant, area_id: str, **fields: str) -> None:
    await hass.services.async_call(DOMAIN, SERVICE_ANNOTATE_AREA, {"area_id": area_id, **fields}, blocking=True)
    await hass.async_block_till_done()


async def _project(hass: HomeAssistant, scope: str = "all") -> None:
    await hass.services.async_call(DOMAIN, SERVICE_PROJECT_LABELS, {"scope": scope}, blocking=True)
    await hass.async_block_till_done()


def _owned_names(label_registry: LabelRegistry) -> set[str]:
    """Return the names of every topology-owned label."""
    return {label.name for label in label_registry.async_list_labels() if label.description == LABEL_OWNED_DESCRIPTION}


def _area_label_names(hass: HomeAssistant, label_registry: LabelRegistry, area_id: str) -> set[str]:
    area = ar.async_get(hass).async_get_area(area_id)
    return {label_registry.async_get_label(label_id).name for label_id in area.labels}


@pytest.fixture
def projection_entry_data(entry_data: dict[str, Any]) -> dict[str, Any]:
    """Entry data with the environment projection toggle on."""
    return {**entry_data, CONF_PROJECT_ENVIRONMENT: True}


async def test_project_labels_creates_owned(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    label_registry: LabelRegistry,
) -> None:
    """With project_environment on, project_labels creates owned labels and assigns them."""
    await setup_integration.runtime_data.store.async_apply_home_config(project_environment=True)
    await _annotate(hass, "flur", environment="indoor")
    await _project(hass, "environment")

    assert "topology:environment:indoor" in _owned_names(label_registry)
    assert "topology:environment:indoor" in _area_label_names(hass, label_registry, "flur")


async def test_project_labels_scope_disabled(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
) -> None:
    """scope=type while the type toggle is off -> projection_disabled {dimension}."""
    with pytest.raises(ServiceValidationError) as exc:
        await _project(hass, "type")
    assert exc.value.translation_key == "projection_disabled"
    assert exc.value.translation_placeholders == {"dimension": "type"}


async def test_project_labels_prunes(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    label_registry: LabelRegistry,
) -> None:
    """Clearing an area's value removes the owned label from the area and deletes it."""
    store = setup_integration.runtime_data.store
    await store.async_apply_home_config(project_environment=True)
    await _annotate(hass, "flur", environment="indoor")
    await _project(hass, "environment")
    assert "topology:environment:indoor" in _owned_names(label_registry)

    # Clear the value (a panel/WS action), re-project: the now-unused owned label
    # is removed from the area and deleted.
    await store.async_update_area("flur", {"environment": None})
    await _project(hass, "environment")
    assert "topology:environment:indoor" not in _owned_names(label_registry)
    assert "topology:environment:indoor" not in _area_label_names(hass, label_registry, "flur")


async def test_project_type_and_trust_shared(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    label_registry: LabelRegistry,
) -> None:
    """Type + trust project; a value shared by two areas reuses the one owned label."""
    store = setup_integration.runtime_data.store
    await store.async_apply_home_config(project_type=True, project_trust=True)
    await _annotate(hass, "flur", type="hallway", trust="shared")
    await _annotate(hass, "wohnzimmer", type="hallway", trust="shared")
    await _project(hass, "all")

    owned = _owned_names(label_registry)
    assert "topology:type:hallway" in owned
    assert "topology:trust:shared" in owned
    # The shared value is one label reused by both areas (target-reuse branch).
    assert "topology:type:hallway" in _area_label_names(hass, label_registry, "flur")
    assert "topology:type:hallway" in _area_label_names(hass, label_registry, "wohnzimmer")
    hallway_labels = [lbl for lbl in label_registry.async_list_labels() if lbl.name == "topology:type:hallway"]
    assert len(hallway_labels) == 1


async def test_projection_toggle_off_prunes(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    label_registry: LabelRegistry,
) -> None:
    """Flipping the toggle off removes + deletes that dimension's owned labels (§2.6.1)."""
    await setup_integration.runtime_data.store.async_apply_home_config(project_environment=True)
    await _annotate(hass, "flur", environment="indoor")
    await _project(hass, "all")
    assert "topology:environment:indoor" in _owned_names(label_registry)

    # Toggle off, re-project with scope=all: the dimension is pruned.
    await setup_integration.runtime_data.store.async_apply_home_config(project_environment=False)
    await _project(hass, "all")
    assert "topology:environment:indoor" not in _owned_names(label_registry)


async def test_projection_never_touches_user_labels(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    label_registry: LabelRegistry,
) -> None:
    """A user label named topology:... without the sentinel is left untouched."""
    user_label = label_registry.async_create("topology:environment:indoor")  # no owned sentinel
    area_reg = ar.async_get(hass)
    area_reg.async_update("flur", labels={user_label.label_id})

    await setup_integration.runtime_data.store.async_apply_home_config(project_environment=True)
    await _annotate(hass, "flur", environment="indoor")
    await _project(hass, "environment")

    # The user label survives; topology did not claim it or delete it.
    survivor = label_registry.async_get_label(user_label.label_id)
    assert survivor is not None
    assert survivor.description != LABEL_OWNED_DESCRIPTION
    assert user_label.label_id in area_reg.async_get_area("flur").labels
    # And topology created no owned duplicate of that name.
    assert "topology:environment:indoor" not in _owned_names(label_registry)


async def test_projection_effective_on_setup(
    hass: HomeAssistant,
    projection_entry_data: dict[str, Any],
    area_registry: Any,
    label_registry: LabelRegistry,
) -> None:
    """Toggles on at setup ⇒ labels reconciled without a manual service call (§2.8 site 2)."""
    # Persist a store with an annotation to disk so setup loads it and the
    # setup-time reconcile (§2.8 site 2) has work — without a manual service call.
    storage_dir = Path(hass.config.path(".storage"))
    storage_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema_version": STORAGE_VERSION,
        "home_config": {
            "occupancy_extent": "whole_property",
            "projection_toggles": {"environment": True, "type": False, "trust": False},
            "imports_done_at": {"aliases": None, "labels": None},
            "unannotated_repair_threshold": 3,
        },
        "areas": {"flur": {"environment": "indoor", "updated_at": "2026-07-23T10:00:00+00:00"}},
        "edges": {},
        "floors": {},
    }
    envelope = {"version": STORAGE_VERSION, "minor_version": 1, "key": STORAGE_KEY, "data": payload}
    (storage_dir / STORAGE_KEY).write_text(json.dumps(envelope), encoding="utf-8")

    entry = MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, data=projection_entry_data, title="Topology")
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    assert "topology:environment:indoor" in _owned_names(label_registry)


async def test_projection_effective_on_ws_update(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: Any,
    label_registry: LabelRegistry,
    hass_ws_client: WebSocketGenerator,
) -> None:
    """A ws_update_home_config toggle flip reconciles labels immediately (§2.8 site 3)."""
    await _annotate(hass, "flur", environment="indoor")
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/update_home_config", "projection_toggles": {"environment": True}})
    result = await client.receive_json()
    assert result["success"]
    await hass.async_block_till_done()
    assert "topology:environment:indoor" in _owned_names(label_registry)
