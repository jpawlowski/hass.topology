"""
Deterministic entity-id and unique-id builders for topology (§4).

One module owns the frozen id scheme so every entity constructs its
``unique_id`` and ``entity_id`` the same way:

- ``unique_id`` keys on the registry-stable ``area_id`` (never the name/slug),
  so an area rename never changes it (§4.1/§4.2).
- ``entity_id`` embeds the ``topology`` prefix explicitly — the integration
  domain is not auto-prefixed and topology has no device (§4.3, decision D3).
"""

from __future__ import annotations

from custom_components.topology.const import ENTITY_ID_PREFIX, SUFFIX_HOUSE, SUFFIX_PERIMETER_OPEN
from homeassistant.util import slugify


def house_unique_id(entry_id: str) -> str:
    """Return the household summary sensor's unique_id (§4.2)."""
    return f"{entry_id}_{SUFFIX_HOUSE}"


def perimeter_unique_id(entry_id: str) -> str:
    """Return the perimeter binary sensor's unique_id (§4.2)."""
    return f"{entry_id}_{SUFFIX_PERIMETER_OPEN}"


def area_unique_id(entry_id: str, area_id: str, dimension: str) -> str:
    """Return a per-area sensor's unique_id (§4.2, area_id-based, rename-safe)."""
    return f"{entry_id}_{area_id}_{dimension}"


def house_object_id() -> str:
    """Return the household summary sensor's object_id (§4.3)."""
    return f"{ENTITY_ID_PREFIX}_{SUFFIX_HOUSE}"


def perimeter_object_id() -> str:
    """Return the perimeter binary sensor's object_id (§4.3)."""
    return f"{ENTITY_ID_PREFIX}_{SUFFIX_PERIMETER_OPEN}"


def area_object_id(area_slug: str, dimension: str) -> str:
    """Return a per-area sensor's object_id from the area slug (§4.3)."""
    return f"{ENTITY_ID_PREFIX}_{area_slug}_{dimension}"


def area_slug(name: str) -> str:
    """Return the entity-id slug for an area name (``homeassistant.util.slugify``)."""
    return slugify(name)
