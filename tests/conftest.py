"""Shared fixtures for the topology test matrix (PLAN-topology-phase2.md §7)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.topology.const import DOMAIN, STORAGE_KEY
from homeassistant.core import Context
from homeassistant.helpers import area_registry as ar, entity_registry as er, floor_registry as fr, label_registry as lr
from homeassistant.setup import async_setup_component

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable, Iterator

    from pytest_homeassistant_custom_component.common import MockUser
    from pytest_homeassistant_custom_component.typing import ClientSessionGenerator

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


@pytest.fixture
def two_floor_registry(hass: HomeAssistant) -> fr.FloorRegistry:
    """Floor registry with two floors at levels 0 and 1 (§9 axis/floor tests)."""
    registry = fr.async_get(hass)
    registry.async_create("Ground", level=0)
    registry.async_create("Upper", level=1)
    return registry


@pytest.fixture
def enable_all(hass: HomeAssistant) -> Callable[[MockConfigEntry], Awaitable[None]]:
    """Return a helper that enables all disabled topology entities and reloads.

    Per-area sensors are disabled by default (§3.3); enabling them requires a
    reload. Tests inject annotations *after* enabling (store mutation + publish
    drives the live entity state) because the test harness mocks storage in
    memory and does not persist across a reload.
    """

    async def _enable(entry: MockConfigEntry) -> None:
        registry = er.async_get(hass)
        for entity in er.async_entries_for_config_entry(registry, entry.entry_id):
            if entity.disabled:
                registry.async_update_entity(entity.entity_id, disabled_by=None)
        await hass.config_entries.async_reload(entry.entry_id)
        await hass.async_block_till_done()

    return _enable


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


# --- Phase 5 repair fixtures (PLAN-topology-phase5.md §8) -------------------


def _home_config(threshold: int = 3) -> dict[str, Any]:
    """Return a default home_config block with a given repair threshold."""
    return {
        "occupancy_extent": "whole_property",
        "projection_toggles": {"environment": False, "type": False, "trust": False},
        "imports_done_at": {"aliases": None, "labels": None},
        "unannotated_repair_threshold": threshold,
    }


@pytest.fixture
def unannotated_payload(hass: HomeAssistant) -> dict[str, Any]:
    """A store payload plus a registry of three unannotated areas (§8).

    Three areas (``alpha``/``bravo``/``charlie``) exist in the registry with no
    store annotation, so the derived ``unannotated_areas`` count is three — at
    the default threshold — and the ``unannotated_areas_threshold`` repair
    fires once the payload is loaded.
    """
    registry = ar.async_get(hass)
    for name in ("alpha", "bravo", "charlie"):
        registry.async_create(name)
    return {
        "schema_version": 1,
        "home_config": _home_config(threshold=3),
        "areas": {},
        "edges": {},
        "floors": {},
    }


@pytest.fixture
def orphaned_payload() -> dict[str, Any]:
    """A payload whose ``wohnzimmer`` area and one edge already carry ``orphaned_at`` (§8).

    ``flur`` stays live; ``wohnzimmer`` and the ``flur::wohnzimmer`` edge are
    flagged orphaned with a past timestamp, so the orphan repair fires and a
    ``async_purge_orphans(utcnow())`` removes them.
    """
    orphaned_at = "2026-07-23T10:00:00+00:00"
    return {
        "schema_version": 1,
        "home_config": _home_config(threshold=3),
        "areas": {
            "flur": {
                "type": "hallway",
                "environment": "indoor",
                "trust": "private",
                "updated_at": "2026-07-23T10:00:00+00:00",
            },
            "wohnzimmer": {
                "type": "living",
                "environment": "indoor",
                "trust": "private",
                "updated_at": "2026-07-23T10:01:00+00:00",
                "orphaned_at": orphaned_at,
            },
        },
        "edges": {
            "flur::wohnzimmer": {
                "area_a": "flur",
                "area_b": "wohnzimmer",
                "connections": [{"passage": "level", "barrier": "door"}],
                "created_at": "2026-07-23T10:05:00+00:00",
                "orphaned_at": orphaned_at,
            }
        },
        "floors": {},
    }


# --- Phase 6 service / projection / import fixtures (PLAN-topology-phase6.md §6) --


@pytest.fixture
def label_registry(hass: HomeAssistant) -> lr.LabelRegistry:
    """Return the label registry (projection + label-import tests)."""
    return lr.async_get(hass)


@pytest.fixture
def admin_context(hass_admin_user: MockUser) -> Context:
    """Return a Context for an admin user (admin-gated service calls, A.1)."""
    return Context(user_id=hass_admin_user.id)


@pytest.fixture
def non_admin_context(hass_read_only_user: MockUser) -> Context:
    """Return a Context for a non-admin user (rejected by the admin gate, A.1)."""
    return Context(user_id=hass_read_only_user.id)


@pytest.fixture
def import_payload(hass: HomeAssistant) -> dict[str, str]:
    """Create a registry that seeds a known import result (§2.7.1).

    ``kitchen`` — name slug matches ``AREA_TYPE_CATALOG`` → type ``kitchen``.
    ``bedroom`` — alias ``Bedroom`` matches → type ``bedroom`` + cascade.
    ``shed`` — user labels ``outdoor`` (environment) + ``garage`` (type).
    ``prefilled`` — already carries a store type, so import must not touch it.
    Returns the created area ids by role.
    """
    area_reg = ar.async_get(hass)
    label_reg = lr.async_get(hass)
    kitchen = area_reg.async_create("Kitchen")
    bedroom = area_reg.async_create("Master", aliases={"Bedroom"})
    env_label = label_reg.async_create("outdoor")
    type_label = label_reg.async_create("garage")
    shed = area_reg.async_create("Shed")
    area_reg.async_update(shed.id, labels={env_label.label_id, type_label.label_id})
    prefilled = area_reg.async_create("Studio")
    return {
        "kitchen": kitchen.id,
        "bedroom": bedroom.id,
        "shed": shed.id,
        "prefilled": prefilled.id,
    }


@pytest.fixture
async def repairs_client(hass: HomeAssistant, hass_client: ClientSessionGenerator) -> Any:
    """Set up the repairs component and return an HTTP client for its fix-flow API.

    Setting up the ``repairs`` component processes every loaded integration's
    repairs platform (``async_process_repairs_platforms``), so topology's
    ``async_create_fix_flow`` is registered. The returned client drives
    ``/api/repairs/issues/fix`` for the orphan purge flow (§8).
    """
    assert await async_setup_component(hass, "repairs", {})
    await hass.async_block_till_done()
    return await hass_client()
