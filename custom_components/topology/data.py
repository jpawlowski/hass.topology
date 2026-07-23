"""
Custom types for topology.

This module defines the runtime data structure attached to each config entry.
Access pattern: entry.runtime_data.coordinator

The TopologyConfigEntry type alias is used throughout the integration
for type-safe access to the config entry's runtime data.

Phase 1 keeps this a minimal placeholder; Phase 2 freezes the full domain
model (see docs/development/PLAN-topology-phase2.md §6).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry

    from .coordinator import TopologyCoordinator


type TopologyConfigEntry = ConfigEntry[TopologyRuntimeData]


@dataclass
class TopologyRuntimeData:
    """Runtime data for topology config entries.

    Stored as entry.runtime_data after successful setup. Phase 2 adds the
    store handle alongside the coordinator (§6).
    """

    coordinator: TopologyCoordinator
