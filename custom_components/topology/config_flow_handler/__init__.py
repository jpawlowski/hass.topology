"""
Config flow handler package for topology.

Topology is a single-instance hub: it consumes the Home Assistant area /
floor registries and needs no credentials or per-instance configuration.
The config flow is therefore a bare "create the hub entry once" step.

Package structure:
------------------
- config_flow.py: The single-instance hub flow (user step, no input).

Further modules (options, subentries, schemas, validators) will be
added later if the roadmap needs them. See `docs/development/PLAN.md`.
"""

from __future__ import annotations

from .config_flow import TopologyConfigFlowHandler

__all__ = ["TopologyConfigFlowHandler"]
