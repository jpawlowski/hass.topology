"""
Runtime data types for topology.

Attached to each config entry as `entry.runtime_data` after successful
setup. Phase 1 keeps it minimal (only the loaded `Integration` handle);
later phases add the registry watcher, graph index, and stores.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.loader import Integration


type TopologyConfigEntry = ConfigEntry["TopologyData"]


@dataclass
class TopologyData:
    """Runtime data for the topology hub config entry."""

    integration: Integration
