"""Phase 3 derived-view + shared-derivation tests (PLAN-topology-phase3.md §9)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.entity_utils.derivations import (
    derive,
    derive_areas,
    derive_house,
    derive_perimeter,
    effective_level,
)
from custom_components.topology.entity_utils.entity_ids import area_slug
from custom_components.topology.websocket_api import _build_health
from homeassistant.helpers import area_registry as ar, floor_registry as fr

if TYPE_CHECKING:
    from collections.abc import Callable

    from pytest_homeassistant_custom_component.common import MockConfigEntry
    from pytest_homeassistant_custom_component.typing import WebSocketGenerator

    from homeassistant.core import HomeAssistant


def _annotate_outdoor(entry: MockConfigEntry, area_id: str) -> None:
    """Inject an outdoor annotation for an area and reseed the coordinator."""
    store = entry.runtime_data.store
    store.data["areas"][area_id] = {"environment": "outdoor", "updated_at": "2026-01-01T00:00:00+00:00"}
    entry.runtime_data.coordinator.async_seed(store.snapshot())


async def test_derive_house_counts(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    floor_registry: fr.FloorRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """derive_house returns the correct counts for the §2.5 home plus an outdoor area."""
    garten = area_registry.async_create("Garten")
    load_payload(setup_integration, store_payload_full)
    _annotate_outdoor(setup_integration, garten.id)

    house = derive_house(
        setup_integration.runtime_data.coordinator.data,
        area_registry,
        floor_registry,
    )
    assert house.area_count == 4
    assert house.annotated_count == 4
    assert house.unannotated_areas == ()
    assert house.outdoor_area_count == 1
    assert house.floor_count == 1
    assert house.perimeter_connection_count == 3


async def test_derive_house_equals_health(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    floor_registry: fr.FloorRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """The house counts equal the health counts (single source, D2/D6)."""
    area_registry.async_create("Spare")  # one unannotated registry area
    load_payload(setup_integration, store_payload_full)
    await hass.async_block_till_done()

    snapshot = setup_integration.runtime_data.coordinator.data
    house = derive_house(snapshot, area_registry, floor_registry)
    health = _build_health(snapshot, area_registry)
    assert house.area_count == health["area_count"]
    assert house.annotated_count == health["annotated_count"]
    assert list(house.unannotated_areas) == health["unannotated_areas"]


async def test_derive_areas_projection(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """derive_areas marks exists/orphaned, carries values, and captures name+slug (D16)."""
    load_payload(setup_integration, store_payload_full)
    projections = {p.area_id: p for p in derive_areas(setup_integration.runtime_data.coordinator.data, area_registry)}

    flur = projections["flur"]
    assert flur.exists is True
    assert flur.orphaned is False
    assert flur.type == "hallway"
    assert flur.name == "flur"
    assert flur.slug == "flur"


async def test_derive_areas_unknown_enum_none(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """An out-of-catalog stored enum surfaces as None on the projection (§2.4)."""
    store = setup_integration.runtime_data.store
    store.data["areas"]["flur"] = {"environment": "underwater", "updated_at": "2026-01-01T00:00:00+00:00"}
    setup_integration.runtime_data.coordinator.async_seed(store.snapshot())

    projections = {p.area_id: p for p in derive_areas(setup_integration.runtime_data.coordinator.data, area_registry)}
    assert projections["flur"].environment is None


async def test_derive_perimeter_unchanged(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    hass_ws_client: WebSocketGenerator,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """The extracted derive_perimeter matches the read_hook perimeter list (D15)."""
    load_payload(setup_integration, store_payload_full)
    direct = derive_perimeter(setup_integration.runtime_data.coordinator.data, area_registry)

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "topology/read_hook"})
    response = await client.receive_json()
    assert response["success"]
    assert response["result"]["perimeter"] == direct
    assert len(direct) == 3


async def test_coordinator_derived_recomputed(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """coordinator.derived refreshes on a registry event."""
    coordinator = setup_integration.runtime_data.coordinator
    before = coordinator.derived.house.area_count
    area_registry.async_create("Spare")
    await hass.async_block_till_done()
    assert coordinator.derived.house.area_count == before + 1


def test_area_slug_helper() -> None:
    """area_slug slugifies an area name for the entity-id (§4.3)."""
    assert area_slug("Living Room") == "living_room"


async def test_derive_perimeter_edge_trust_delta(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """An interior edge across a trust boundary is a perimeter connection (§4.10)."""
    store = setup_integration.runtime_data.store
    await store.async_update_area("flur", {"trust": "private"})
    await store.async_update_area("wohnzimmer", {"trust": "shared"})
    await store.async_upsert_edge("flur", "wohnzimmer", [{"passage": "level", "barrier": "door"}])

    perimeter = derive_perimeter(store.snapshot(), area_registry)
    edges = [entry for entry in perimeter if entry["source"] == "edge"]
    assert len(edges) == 1
    assert edges[0]["edge_id"] == "flur::wohnzimmer"


async def test_derive_perimeter_override_same_trust(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """A perimeter_override forces a same-trust edge to count (§4.10)."""
    store = setup_integration.runtime_data.store
    await store.async_update_area("flur", {"trust": "private"})
    await store.async_update_area("kueche", {"trust": "private"})
    await store.async_upsert_edge(
        "flur", "kueche", [{"passage": "level", "barrier": "door", "perimeter_override": True}]
    )

    perimeter = derive_perimeter(store.snapshot(), area_registry)
    assert any(entry["source"] == "edge" and entry["edge_id"] == "flur::kueche" for entry in perimeter)


async def test_effective_level_uses_override(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
) -> None:
    """effective_level falls back to the store override when the registry level is None."""
    floor = fr.async_get(hass).async_create("Loft")  # level unset
    area_registry.async_update("flur", floor_id=floor.floor_id)
    store = setup_integration.runtime_data.store
    store.data["floors"][floor.floor_id] = {"level_override": 5, "updated_at": "2026-01-01T00:00:00+00:00"}

    overrides = {override.floor_id: override for override in store.snapshot().floors}
    assert effective_level("flur", area_registry, fr.async_get(hass), overrides) == 5


async def test_derive_live_area_ids_excludes_orphans(
    hass: HomeAssistant,
    setup_integration: MockConfigEntry,
    area_registry: ar.AreaRegistry,
    floor_registry: fr.FloorRegistry,
    store_payload_full: dict[str, Any],
    load_payload: Callable[[MockConfigEntry, dict[str, Any]], None],
) -> None:
    """A removed area drops out of live_area_ids (orphaned annotation kept)."""
    load_payload(setup_integration, store_payload_full)
    area_registry.async_delete("wohnzimmer")
    await hass.async_block_till_done()

    derived = derive(setup_integration.runtime_data.coordinator.data, area_registry, floor_registry)
    assert "wohnzimmer" not in derived.live_area_ids
    assert "flur" in derived.live_area_ids
