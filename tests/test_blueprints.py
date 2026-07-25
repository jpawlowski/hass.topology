"""Validation of the four shipped automation blueprints (Phase 8 §5, V6/V7).

Two things are checked, and the second is the one that earns its keep: that each
file *is* a valid blueprint (metadata, selectors, sections, ``!input``
substitution, and the resulting automation config), and that every Topology
entity id, attribute name, and service action it references actually exists. A
blueprint is the one artifact that ships to users and is never executed by the
test suite, so a renamed attribute would otherwise break it silently.
"""

from __future__ import annotations

from pathlib import Path
import re
from typing import TYPE_CHECKING, Any

import pytest

from custom_components.topology.const import (
    DOMAIN,
    SERVICE_GET_CONNECTIONS_FACING_OUTDOOR,
    SERVICE_GET_HEALTH,
    SERVICE_GET_MODEL,
    SERVICE_GET_NEIGHBORS,
    SERVICE_GET_PATH,
    SERVICE_GET_PERIMETER,
)
from custom_components.topology.entity_utils.entity_ids import house_object_id, perimeter_object_id
from homeassistant.components.automation.config import AUTOMATION_BLUEPRINT_SCHEMA, PLATFORM_SCHEMA
from homeassistant.components.blueprint.models import Blueprint, BlueprintInputs
from homeassistant.util.yaml.loader import load_yaml_dict

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

_BLUEPRINT_DIR = Path(__file__).parent.parent / "blueprints" / "automation" / "topology"
_FILES = sorted(_BLUEPRINT_DIR.glob("*.yaml"))

# The attributes the perimeter binary sensor and the house sensor actually
# publish. Kept as literals rather than derived from the entity classes: the
# point is to notice when the entity changes and a shipped blueprint does not.
_PERIMETER_ATTRIBUTES = {
    "open_connections",
    "open_count",
    "monitored_connections",
    "monitored_count",
    "unavailable_sensors",
}
_HOUSE_ATTRIBUTES = {
    "occupancy_extent",
    "area_count",
    "annotated_count",
    "unannotated_areas",
    "perimeter_connection_count",
    "outdoor_area_count",
    "floor_count",
}
_READ_SERVICES = {
    SERVICE_GET_NEIGHBORS,
    SERVICE_GET_PATH,
    SERVICE_GET_PERIMETER,
    SERVICE_GET_CONNECTIONS_FACING_OUTDOOR,
    SERVICE_GET_HEALTH,
    SERVICE_GET_MODEL,
}

_PERIMETER_ENTITY = f"binary_sensor.{perimeter_object_id()}"
_HOUSE_ENTITY = f"sensor.{house_object_id()}"

_TOPOLOGY_ENTITY_RE = re.compile(r"\b(?:binary_sensor|sensor)\.topology_[a-z0-9_]+")
_STATE_ATTR_RE = re.compile(r"state_attr\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)")
_TOPOLOGY_ACTION_RE = re.compile(r"\btopology\.([a-z_]+)")


def _load(path: Path) -> Blueprint:
    return Blueprint(
        load_yaml_dict(str(path)),
        path=str(path),
        expected_domain="automation",
        schema=AUTOMATION_BLUEPRINT_SCHEMA,
    )


def test_blueprints_exist() -> None:
    """The four blueprints named in the plan are the ones on disk."""
    assert {path.name for path in _FILES} == {
        "perimeter_open_at_night.yaml",
        "sun_side_covers.yaml",
        "ventilation_coordination.yaml",
        "perimeter_arming.yaml",
    }


@pytest.mark.parametrize("path", _FILES, ids=lambda path: path.stem)
def test_blueprint_metadata_valid(path: Path) -> None:
    """Each file constructs as an automation blueprint with a source_url."""
    blueprint = _load(path)
    assert blueprint.name
    assert blueprint.metadata["source_url"].endswith(f"/{path.name}")
    assert blueprint.inputs


@pytest.mark.parametrize("path", _FILES, ids=lambda path: path.stem)
def test_blueprint_substitutes_with_defaults_only(path: Path) -> None:
    """Only the required inputs supplied → every ``default:`` is exercised.

    This is the combination a user hits when they accept the form as presented,
    and the one that catches a default whose type does not match its selector.
    """
    blueprint = _load(path)
    required = {name: _placeholder(name, spec) for name, spec in blueprint.inputs.items() if "default" not in spec}
    inputs = BlueprintInputs(
        blueprint,
        {"use_blueprint": {"path": path.name, "input": required}},
    )
    inputs.validate()
    config = inputs.async_substitute()
    assert PLATFORM_SCHEMA(config)


@pytest.mark.parametrize("path", _FILES, ids=lambda path: path.stem)
def test_blueprint_substitutes_with_every_input(path: Path) -> None:
    """Every input supplied → no ``!input`` is left unresolved."""
    blueprint = _load(path)
    supplied = {name: _placeholder(name, spec) for name, spec in blueprint.inputs.items()}
    inputs = BlueprintInputs(
        blueprint,
        {"use_blueprint": {"path": path.name, "input": supplied}},
    )
    inputs.validate()
    config = inputs.async_substitute()
    assert PLATFORM_SCHEMA(config)


def _placeholder(name: str, spec: dict[str, Any]) -> Any:
    """Return a plausible value for an input, from its selector.

    Substitution is structural — it does not run the selectors — so the value
    only has to have the right *shape* for the templates that consume it.
    """
    selector = spec.get("selector") or {}
    if "boolean" in selector:
        return True
    if "number" in selector:
        return selector["number"].get("min", 0)
    if "duration" in selector:
        return {"hours": 0, "minutes": 1, "seconds": 0}
    if "time" in selector:
        return "22:00:00"
    if "action" in selector:
        return []
    if "area" in selector:
        return ["kitchen"] if selector["area"].get("multiple") else "kitchen"
    if "entity" in selector:
        return ["cover.demo"] if selector["entity"].get("multiple") else "binary_sensor.demo"
    if "select" in selector:
        options = selector["select"]["options"]
        first = options[0]
        value = first["value"] if isinstance(first, dict) else first
        return [value] if selector["select"].get("multiple") else value
    return "x"


@pytest.mark.parametrize("path", _FILES, ids=lambda path: path.stem)
def test_blueprint_references_real_surface(path: Path) -> None:
    """Every topology entity, attribute, and action a blueprint names exists (V7)."""
    text = path.read_text(encoding="utf-8")

    for entity_id in set(_TOPOLOGY_ENTITY_RE.findall(text)):
        assert entity_id in {_PERIMETER_ENTITY, _HOUSE_ENTITY}, entity_id

    for entity_id, attribute in _STATE_ATTR_RE.findall(text):
        if entity_id == _PERIMETER_ENTITY:
            assert attribute in _PERIMETER_ATTRIBUTES, (entity_id, attribute)
        elif entity_id == _HOUSE_ENTITY:
            assert attribute in _HOUSE_ATTRIBUTES, (entity_id, attribute)

    for action in set(_TOPOLOGY_ACTION_RE.findall(text)):
        assert action in _READ_SERVICES, f"{path.name} calls topology.{action}, which is not a read action"


async def test_blueprint_actions_are_registered(hass: HomeAssistant) -> None:
    """Every ``topology.*`` action a blueprint calls is really registered.

    The regex check above proves the name is in the read set; this proves the
    read set is actually served, so a blueprint cannot ship against an action
    that was renamed out from under it.
    """
    from homeassistant.setup import async_setup_component  # noqa: PLC0415

    assert await async_setup_component(hass, DOMAIN, {})
    await hass.async_block_till_done()
    called: set[str] = set()
    for path in _FILES:
        called |= set(_TOPOLOGY_ACTION_RE.findall(path.read_text(encoding="utf-8")))
    assert called, "no blueprint calls a topology action any more — is that intended?"
    for action in called:
        assert hass.services.has_service(DOMAIN, action), action
