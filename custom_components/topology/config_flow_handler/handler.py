"""
Backwards-compatibility wrapper for the topology config flow handler.

Re-exports ``TopologyConfigFlowHandler`` from ``config_flow.py`` for external
imports. The actual implementation lives in ``config_flow.py``.

For more information:
https://developers.home-assistant.io/docs/config_entries_config_flow_handler
"""

from __future__ import annotations

from custom_components.topology.config_flow_handler.config_flow import TopologyConfigFlowHandler

__all__ = ["TopologyConfigFlowHandler"]
