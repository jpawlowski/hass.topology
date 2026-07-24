"""Service actions package for topology.

Topology registers no service actions until Phase 6. ``async_setup_services``
is a stable no-op entry point so ``async_setup`` can call it unconditionally.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant


async def async_setup_services(hass: HomeAssistant) -> None:
    """Register topology service actions (none until Phase 6)."""
