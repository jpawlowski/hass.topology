"""
Base entity class for topology.

All integration entities inherit from this class. Topology entities are
registry-driven and carry no device (Quality-Scale mapping declares
``devices: N/A``). Phase 1 keeps only the skeleton; Phase 3 adds the actual
entities and their value wiring.

For more information on entities:
https://developers.home-assistant.io/docs/core/entity
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.coordinator import TopologyCoordinator
from homeassistant.helpers.update_coordinator import CoordinatorEntity

if TYPE_CHECKING:
    from custom_components.topology.data import TopologyDerived


class TopologyEntity(CoordinatorEntity[TopologyCoordinator]):
    """Base entity class for topology.

    Provides automatic coordinator updates and the has-entity-name naming
    convention. Entities read from ``coordinator.data`` (the snapshot) and
    ``coordinator.derived`` (the registry-merged projection, §7) — never from
    the store, the area registry, or the floor registry directly.
    """

    _attr_has_entity_name = True

    @property
    def derived(self) -> TopologyDerived:
        """Return the coordinator's registry-merged projection (§7.3)."""
        return self.coordinator.derived
