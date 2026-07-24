"""
One-way, owned + namespaced label projection (PLAN-topology-phase6.md §2.6).

``async_reconcile_labels`` projects each area's ``environment``/``type``/``trust``
annotation onto Core area labels named ``topology:<dim>:<value>`` (frozen format,
D10). Ownership is asserted solely by the ``LABEL_OWNED_DESCRIPTION`` sentinel on
the label's ``description`` — never by the name prefix — so a user label that
happens to share a ``topology:`` name is never removed, reused, or deleted
(§2.6.1). The reconcile is the single core called by the ``project_labels``
service, at setup, and on ``ws_update_home_config`` (§2.8).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from custom_components.topology.const import LABEL_NAMESPACE, LABEL_OWNED_DESCRIPTION, LOGGER
from homeassistant.helpers import area_registry as ar, label_registry as lr

if TYPE_CHECKING:
    from custom_components.topology.data import AreaAnnotation, TopologySnapshot
    from homeassistant.core import HomeAssistant
    from homeassistant.helpers.label_registry import LabelEntry, LabelRegistry

# The three projectable dimensions, in a stable order.
_DIMENSIONS: tuple[str, ...] = ("environment", "type", "trust")


def is_owned(label: LabelEntry) -> bool:
    """Return whether a label is owned by topology (the sentinel test, §2.6.1)."""
    return label.description == LABEL_OWNED_DESCRIPTION


def _dim_of(name: str) -> str | None:
    """Return the dimension encoded in a ``topology:<dim>:<value>`` name, or None."""
    parts = name.split(":", 2)
    if len(parts) == 3 and parts[0] == LABEL_NAMESPACE and parts[1] in _DIMENSIONS:
        return parts[1]
    return None


def _dim_value(annotation: AreaAnnotation, dim: str) -> str | None:
    """Return the annotation's value for a dimension (enum value or open str)."""
    if dim == "type":
        return annotation.type
    if dim == "environment":
        return annotation.environment.value if annotation.environment is not None else None
    return annotation.trust.value if annotation.trust is not None else None


def _label_name(dim: str, value: str) -> str:
    """Return the frozen projected-label name ``topology:<dim>:<value>`` (D10)."""
    return f"{LABEL_NAMESPACE}:{dim}:{value}"


def _unused_by_areas(area_reg: ar.AreaRegistry, label_id: str) -> bool:
    """Return whether no registry area references the label (prune test, §2.6.1)."""
    return all(label_id not in area.labels for area in area_reg.async_list_areas())


async def async_reconcile_labels(
    hass: HomeAssistant,
    snapshot: TopologySnapshot,
    *,
    scope: str = "all",
) -> None:
    """Reconcile owned ``topology:<dim>:<value>`` area labels to the snapshot (§2.6.1).

    ``dims`` (enabled and in scope) drive the desired labels; ``scope_dims`` (in
    scope regardless of the toggle) drive stale-removal and pruning, so turning a
    toggle off removes and deletes that dimension's owned labels — the projection
    is fully reversible while installed (§2.6.1).
    """
    label_reg = lr.async_get(hass)
    area_reg = ar.async_get(hass)
    home = snapshot.home_config
    toggles = {
        "environment": home.project_environment,
        "type": home.project_type,
        "trust": home.project_trust,
    }
    in_scope = [dim for dim in _DIMENSIONS if scope in ("all", dim)]
    dims = [dim for dim in in_scope if toggles[dim]]
    scope_dims = set(in_scope)

    annotations = {a.area_id: a for a in snapshot.areas if a.orphaned_at is None}
    owned_ids = {label.label_id for label in label_reg.async_list_labels() if is_owned(label)}

    for area in area_reg.async_list_areas():
        desired = _desired_names(annotations.get(area.id), dims)
        current = set(area.labels)
        stale = _stale_labels(label_reg, current, owned_ids, scope_dims, desired)
        target_ids = _target_label_ids(label_reg, desired, owned_ids)
        new_labels = (current - stale) | target_ids
        if new_labels != current:
            area_reg.async_update(area.id, labels=new_labels)

    _prune_unused(label_reg, area_reg, owned_ids, scope_dims)


def _desired_names(annotation: AreaAnnotation | None, dims: list[str]) -> set[str]:
    """Return the set of ``topology:<dim>:<value>`` names an area should carry."""
    if annotation is None:
        return set()
    names: set[str] = set()
    for dim in dims:
        value = _dim_value(annotation, dim)
        if value is not None:
            names.add(_label_name(dim, value))
    return names


def _stale_labels(
    label_reg: LabelRegistry,
    current: set[str],
    owned_ids: set[str],
    scope_dims: set[str],
    desired: set[str],
) -> set[str]:
    """Return the owned, in-scope labels on the area that are no longer desired."""
    stale: set[str] = set()
    for label_id in current:
        if label_id not in owned_ids:
            continue
        label = label_reg.async_get_label(label_id)
        if label is None:
            continue
        if _dim_of(label.name) in scope_dims and label.name not in desired:
            stale.add(label_id)
    return stale


def _target_label_ids(
    label_reg: LabelRegistry,
    desired: set[str],
    owned_ids: set[str],
) -> set[str]:
    """Return the owned label ids to assign, creating missing ones (§2.6.1).

    A desired name that already exists as a *user* label (no sentinel) is skipped
    — topology never claims a second label of the same normalized name — leaving
    both the user label and the area untouched (debug-logged).
    """
    target_ids: set[str] = set()
    for name in desired:
        existing = label_reg.async_get_label_by_name(name)
        if existing is None:
            created = label_reg.async_create(name, description=LABEL_OWNED_DESCRIPTION)
            owned_ids.add(created.label_id)
            target_ids.add(created.label_id)
        elif existing.label_id in owned_ids:
            target_ids.add(existing.label_id)
        else:
            LOGGER.debug("Skipping projection of %s: a user label with that name already exists", name)
    return target_ids


def _prune_unused(
    label_reg: LabelRegistry,
    area_reg: ar.AreaRegistry,
    owned_ids: set[str],
    scope_dims: set[str],
) -> None:
    """Delete owned, in-scope labels now referenced by no area (§2.6.1)."""
    for label in list(label_reg.async_list_labels()):
        if (
            label.label_id in owned_ids
            and _dim_of(label.name) in scope_dims
            and _unused_by_areas(area_reg, label.label_id)
        ):
            label_reg.async_delete(label.label_id)
