"""
Config-flow schemas for topology (PLAN-topology-phase2-followup-configflow.md §2.1).

The flow is confirm-only: it collects **no data at all**. Both steps therefore
share one empty schema. Home-level settings (occupancy extent, projection
toggles, unannotated-repair threshold) live in the store and are edited in the
Topology panel through ``topology/update_home_config``; the one-shot imports are
a panel first-run action, not a setup field (§2.3).

The empty ``vol.Schema({})`` is deliberate rather than ``data_schema=None`` (D2):
it is equivalent at runtime — the schema is only applied when non-``None`` — but
explicit, and a test can assert the step offers no fields. HA validates the
frontend's ``{}`` against it and re-enters the step with a non-``None``
``user_input``, which is what "Submit" means for a field-less form.
"""

from __future__ import annotations

import voluptuous as vol


def get_confirm_schema() -> vol.Schema:
    """Return the field-less schema shared by the ``user`` and ``reconfigure`` steps."""
    return vol.Schema({})


__all__ = ["get_confirm_schema"]
