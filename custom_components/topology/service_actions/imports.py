"""
One-shot alias/label import executor (PLAN-topology-phase6.md §2.7).

``async_run_import`` seeds area annotations from Core data with conservative,
**fill-empty-only** heuristics — it never overwrites a user value. ``aliases``
matches ``area.aliases ∪ {area.name}`` (slugified) against ``AREA_TYPE_CATALOG``
and cascades ``environment``/``trust`` via ``TYPE_CASCADE``; ``labels`` matches
label names against the ``Environment`` value set and ``AREA_TYPE_CATALOG``.

Driven by the ``import_from_core`` service alone — the panel's first-run card is
the user-facing trigger. Setup deliberately runs no import: an opt-in that fires
before the user has seen the result is not undoable, so the card asks first.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.data import AREA_TYPE_CATALOG, TYPE_CASCADE, Environment
from homeassistant.helpers import area_registry as ar, label_registry as lr
from homeassistant.util import slugify

from .label_projection import is_owned

if TYPE_CHECKING:
    from collections.abc import Iterable

    from custom_components.topology.data import AreaAnnotation, TopologySnapshot
    from custom_components.topology.store import TopologyStore
    from homeassistant.core import HomeAssistant

_ENVIRONMENT_VALUES = frozenset(member.value for member in Environment)
_TYPE_VALUES = frozenset(AREA_TYPE_CATALOG)


def _first_slug_in(candidates: Iterable[str], valid: frozenset[str]) -> str | None:
    """Return the first candidate whose slug is in ``valid`` (fill-empty match)."""
    for candidate in candidates:
        slug = slugify(candidate)
        if slug in valid:
            return slug
    return None


def _apply_type(updates: dict[str, str], area_type: str, annotation: AreaAnnotation | None) -> None:
    """Set ``type`` and cascade empty ``environment``/``trust`` from ``TYPE_CASCADE``."""
    updates["type"] = area_type
    env_default, trust_default = TYPE_CASCADE.get(area_type, (None, None))
    if (
        env_default is not None
        and "environment" not in updates
        and (annotation is None or annotation.environment is None)
    ):
        updates["environment"] = env_default.value
    if trust_default is not None and "trust" not in updates and (annotation is None or annotation.trust is None):
        updates["trust"] = trust_default.value


async def async_run_import(
    hass: HomeAssistant,
    store: TopologyStore,
    source: str,
) -> tuple[TopologySnapshot, list[str]]:
    """Run the fill-empty-only import for a source (§2.7.1).

    Returns the final snapshot and the ids of areas that gained a field.
    """
    if source == "aliases":
        return await _import_from_aliases(hass, store)
    return await _import_from_labels(hass, store)


async def _import_from_aliases(hass: HomeAssistant, store: TopologyStore) -> tuple[TopologySnapshot, list[str]]:
    """Seed ``type`` (+cascade) from area aliases/name (§2.7.1)."""
    area_reg = ar.async_get(hass)
    snapshot = store.snapshot()
    annotations = {a.area_id: a for a in snapshot.areas}
    affected: list[str] = []

    for area in area_reg.async_list_areas():
        annotation = annotations.get(area.id)
        if annotation is not None and annotation.type is not None:
            continue  # fill-empty-only: never clobber an existing type
        candidates = [*sorted(area.aliases), area.name]
        matched = _first_slug_in(candidates, _TYPE_VALUES)
        if matched is None:
            continue
        updates: dict[str, str] = {}
        _apply_type(updates, matched, annotation)
        snapshot = await store.async_update_area(area.id, updates)
        affected.append(area.id)

    return snapshot, affected


async def _import_from_labels(hass: HomeAssistant, store: TopologyStore) -> tuple[TopologySnapshot, list[str]]:
    """Seed ``environment``/``type`` (+cascade) from label names (§2.7.1)."""
    area_reg = ar.async_get(hass)
    label_reg = lr.async_get(hass)
    snapshot = store.snapshot()
    annotations = {a.area_id: a for a in snapshot.areas}
    affected: list[str] = []

    for area in area_reg.async_list_areas():
        annotation = annotations.get(area.id)
        names = _user_label_names(label_reg, area.labels)
        updates: dict[str, str] = {}

        env_slug = _first_slug_in(names, _ENVIRONMENT_VALUES)
        if env_slug is not None and (annotation is None or annotation.environment is None):
            updates["environment"] = env_slug

        if annotation is None or annotation.type is None:
            type_slug = _first_slug_in(names, _TYPE_VALUES)
            if type_slug is not None:
                _apply_type(updates, type_slug, annotation)

        if updates:
            snapshot = await store.async_update_area(area.id, updates)
            affected.append(area.id)

    return snapshot, affected


def _user_label_names(label_reg: lr.LabelRegistry, label_ids: Iterable[str]) -> list[str]:
    """Return the names of an area's non-owned labels, sorted for determinism.

    Owned ``topology:*`` labels are ignored as import sources — they are outputs
    of the projection, not user intent (§2.7.1).
    """
    names: list[str] = []
    for label_id in label_ids:
        label = label_reg.async_get_label(label_id)
        if label is None or is_owned(label):
            continue
        names.append(label.name)
    return sorted(names)
