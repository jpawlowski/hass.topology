"""
Coordinator package for topology.

The coordinator owns the in-memory topology snapshot and fans changes out to
entities and consumers. Topology is registry-driven and calculated, so the
coordinator does not poll (ADR "Coordinator Role").

Package structure:
- base.py: TopologyCoordinator (snapshot fanout, bus event)
- registry_watcher.py: area/floor registry event reactions (Phase 2)
"""

from __future__ import annotations

from .base import TopologyCoordinator
from .registry_watcher import TopologyRegistryWatcher

__all__ = ["TopologyCoordinator", "TopologyRegistryWatcher"]
