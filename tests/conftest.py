"""Shared fixtures for the topology test matrix (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.topology.const import DOMAIN, STORAGE_KEY
from homeassistant.helpers import area_registry as ar, floor_registry as fr

if TYPE_CHECKING:
    from collections.abc import Callable, Iterator

    from homeassistant.core import HomeAssistant

_FIXTURE = Path(__file__).parent / "fixtures" / "store_v1_example.json"


@pytest.fixture(autouse=True)
def _auto_enable_custom_integrations(enable_custom_integrations: Any) -> None:
    """Load custom_components.topology in every test."""
    _ = enable_custom_integrations


@pytest.fixture(autouse=True)
def _clean_store_file(hass: HomeAssistant) -> Iterator[None]:
    """Remove the on-disk store file around every test (shared test config dir)."""
    path = Path(hass.config.path(".storage", STORAGE_KEY))
    path.unlink(missing_ok=True)
    yield
    path.unlink(missing_ok=True)


@pytest.fixture
def store_payload_full() -> dict[str, Any]:
    """The frozen §2.5 three-room-flat store payload."""
    return json.loads(_FIXTURE.read_text(encoding="utf-8"))


@pytest.fixture
def entry_data() -> dict[str, Any]:
    """Config-entry data with the §5.1 flow defaults."""
    return {
        "occupancy_extent": "whole_property",
        "import_aliases": False,
        "import_labels": False,
        "project_environment": False,
        "project_type": False,
        "project_trust": False,
        "unannotated_repair_threshold": 3,
    }


@pytest.fixture
def mock_config_entry(entry_data: dict[str, Any]) -> MockConfigEntry:
    """The singleton topology config entry."""
    return MockConfigEntry(domain=DOMAIN, unique_id=DOMAIN, data=entry_data, title="Topology")


@pytest.fixture
def area_registry(hass: HomeAssistant) -> ar.AreaRegistry:
    """Area registry populated with flur, wohnzimmer, kueche (ids match §2.5)."""
    registry = ar.async_get(hass)
    for name in ("flur", "wohnzimmer", "kueche"):
        registry.async_create(name)
    return registry


@pytest.fixture
def floor_registry(hass: HomeAssistant) -> fr.FloorRegistry:
    """Floor registry with a single ground floor at level 0."""
    registry = fr.async_get(hass)
    registry.async_create("Ground", level=0)
    return registry


async def async_setup_entry_for(hass: HomeAssistant, entry: MockConfigEntry) -> MockConfigEntry:
    """Add and set up a config entry, returning it."""
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


@pytest.fixture
async def setup_integration(hass: HomeAssistant, mock_config_entry: MockConfigEntry) -> MockConfigEntry:
    """A set-up topology entry (store loaded, coordinator + watcher running)."""
    return await async_setup_entry_for(hass, mock_config_entry)


def _load_payload_into_store(entry: MockConfigEntry, payload: dict[str, Any]) -> None:
    """Inject a full store payload into a set-up entry and reseed the coordinator."""
    store = entry.runtime_data.store
    data = store.data
    data["home_config"] = payload["home_config"]
    data["areas"] = {k: dict(v) for k, v in payload["areas"].items()}
    data["edges"] = {k: dict(v) for k, v in payload["edges"].items()}
    data["floors"] = {k: dict(v) for k, v in payload["floors"].items()}
    entry.runtime_data.coordinator.async_seed(store.snapshot())


@pytest.fixture
def load_payload() -> Callable[[MockConfigEntry, dict[str, Any]], None]:
    """Return a helper that injects a full store payload into a set-up entry."""
    return _load_payload_into_store
