"""
Config flow handler package for topology.

Package structure:
- config_flow.py: The confirm-only config flow (user setup + reconfigure) and
  its test-before-configure checks
- schemas/: Voluptuous schemas for the flow steps

Topology has no options flow and no subentries (ADR "Editing Surface"): the
panel is the primary editing surface.

For more information:
https://developers.home-assistant.io/docs/config_entries_config_flow_handler
"""

from __future__ import annotations

from .config_flow import TopologyConfigFlowHandler

__all__ = ["TopologyConfigFlowHandler"]
