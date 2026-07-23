"""
Config flow handler package for topology.

Package structure:
- config_flow.py: Main config flow (user setup; reconfigure in Phase 2)
- schemas/: Voluptuous schemas for the flow steps
- validators/: Validation functions for the flow steps
- handler.py: Backwards-compatibility re-export wrapper

Topology has no options flow and no subentries (ADR "Editing Surface"): the
panel is the primary editing surface.

For more information:
https://developers.home-assistant.io/docs/config_entries_config_flow_handler
"""

from __future__ import annotations

from .config_flow import TopologyConfigFlowHandler

__all__ = ["TopologyConfigFlowHandler"]
