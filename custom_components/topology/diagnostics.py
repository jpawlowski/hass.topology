"""
Diagnostics export for topology (PLAN-topology-phase6.md §4).

Implements the Phase-5 §6 redaction ruleset without drift: a per-bundle
pseudonym map over every name-derived identifier (``area_id``/``floor_id``/
``edge_id`` and the sensor object part) is built first, then the free-text
``type`` is redacted via ``async_redact_data`` scoped to the areas list. Registry
display names are never denormalized (D7), so the only value ``async_redact_data``
handles is ``type``. Orphaned entries are included, ids pseudonymized like
everything else (ADR "Registry-Driven State").

Learn more about diagnostics:
https://developers.home-assistant.io/docs/core/integration_diagnostics
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from homeassistant.helpers import area_registry as ar, floor_registry as fr

# Unannotated in Home Assistant; the redaction result type is opaque here.
from homeassistant.helpers.redact import async_redact_data  # pyright: ignore[reportUnknownVariableType]

from .const import STORAGE_VERSION
from .entity_utils.derivations import build_health

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .data import AreaAnnotation, Connection, Edge, FloorOverride, TopologyConfigEntry, UnknownEnumValue


class _Pseudonymizer:
    """Per-bundle map from name-derived ids to stable ``<kind>_<n>`` tokens (§4.3).

    Sequential per-kind counters in first-seen order (D8): deterministic within a
    bundle, no salt, not cross-correlatable, and every adjacency join stays intact
    because the same raw id always maps to the same token.
    """

    def __init__(self) -> None:
        """Start with empty per-kind maps."""
        self._area: dict[str, str] = {}
        self._floor: dict[str, str] = {}
        self._sensor: dict[str, str] = {}

    def area(self, raw: str) -> str:
        """Return the stable pseudonym for an area id."""
        return self._area.setdefault(raw, f"area_{len(self._area) + 1}")

    def floor(self, raw: str) -> str:
        """Return the stable pseudonym for a floor id."""
        return self._floor.setdefault(raw, f"floor_{len(self._floor) + 1}")

    def edge(self, raw: str) -> str:
        """Rebuild an ``area_a::area_b`` id from its endpoints' pseudonyms (§4.3)."""
        return "::".join(self.area(part) for part in raw.split("::"))

    def sensor(self, raw: str) -> str:
        """Keep the domain, pseudonymize the object part → ``domain.sensor_<n>`` (§4.3)."""
        domain, sep, obj = raw.partition(".")
        if not sep:
            return self._sensor.setdefault(raw, f"sensor_{len(self._sensor) + 1}")
        return f"{domain}.{self._sensor.setdefault(obj, f'sensor_{len(self._sensor) + 1}')}"


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: TopologyConfigEntry,
) -> dict[str, Any]:
    """Return the pseudonymized, redacted diagnostics bundle (§4)."""
    snapshot = entry.runtime_data.coordinator.data
    area_reg = ar.async_get(hass)
    pseudo = _Pseudonymizer()
    home = snapshot.home_config

    # Pass 1: build the map + emit the payload with pseudonymized ids (§4.3).
    areas = [_area_out(annotation, pseudo) for annotation in snapshot.areas]
    edges = [_edge_out(edge, pseudo) for edge in snapshot.edges]
    floors = [_floor_out(override, pseudo) for override in snapshot.floors]
    unknown_enum_values = [_unknown_out(unknown, pseudo) for unknown in snapshot.unknown_enum_values]
    health = _health_out(build_health(snapshot, area_reg, fr.async_get(hass)), pseudo)

    payload: dict[str, Any] = {
        "meta": {
            "schema_version": STORAGE_VERSION,
            "area_count": len(snapshot.areas),
            "edge_count": len(snapshot.edges),
            "floor_count": len(snapshot.floors),
            "unknown_enum_count": len(snapshot.unknown_enum_values),
            "pseudonymized": True,
        },
        "home_config": {
            "occupancy_extent": home.occupancy_extent.value,
            "projection_toggles": {
                "environment": home.project_environment,
                "type": home.project_type,
                "trust": home.project_trust,
            },
            "imports_done_at": {
                "aliases": home.imports_done_at_aliases,
                "labels": home.imports_done_at_labels,
            },
            "unannotated_repair_threshold": home.unannotated_repair_threshold,
        },
        "areas": areas,
        "edges": edges,
        "floors": floors,
        "unknown_enum_values": unknown_enum_values,
        "health": health,
    }

    # Pass 2: redact the free-text annotation ``type``. Scoped to the areas list so
    # the recursive redaction never touches home_config.projection_toggles.type
    # (a boolean) — "keep home_config verbatim" (§4.3, PR-review — Codex).
    payload["areas"] = async_redact_data(payload["areas"], {"type"})
    return payload


def _connection_out(connection: Connection, pseudo: _Pseudonymizer) -> dict[str, Any]:
    """Serialize a connection with its sensor object part pseudonymized (§4.2)."""
    out: dict[str, Any] = {
        "passage": connection.passage.value,
        "barrier": connection.barrier.value,
    }
    if connection.side is not None:
        out["side"] = connection.side.value
    if connection.sensor_entity_id is not None:
        out["sensor_entity_id"] = pseudo.sensor(connection.sensor_entity_id)
    if connection.glazed:
        out["glazed"] = True
    if connection.preset_name is not None:
        out["preset_name"] = connection.preset_name
    if connection.perimeter_override:
        out["perimeter_override"] = True
    if connection.inline_trust is not None:
        out["inline_trust"] = connection.inline_trust.value
    return out


def _area_out(annotation: AreaAnnotation, pseudo: _Pseudonymizer) -> dict[str, Any]:
    """Serialize an area annotation with its id pseudonymized (``type`` redacted later)."""
    return {
        "area_id": pseudo.area(annotation.area_id),
        "type": annotation.type,
        "environment": annotation.environment.value if annotation.environment is not None else None,
        "trust": annotation.trust.value if annotation.trust is not None else None,
        "beyond": {side.value: beyond.value for side, beyond in annotation.beyond},
        "exterior_connections": [_connection_out(connection, pseudo) for connection in annotation.exterior_connections],
        "orphaned_at": annotation.orphaned_at,
        "updated_at": annotation.updated_at,
    }


def _edge_out(edge: Edge, pseudo: _Pseudonymizer) -> dict[str, Any]:
    """Serialize an edge with its id + endpoints pseudonymized (join preserved, §4.2)."""
    return {
        "edge_id": pseudo.edge(edge.edge_id),
        "area_a": pseudo.area(edge.area_a),
        "area_b": pseudo.area(edge.area_b),
        "connections": [_connection_out(connection, pseudo) for connection in edge.connections],
        "orphaned_at": edge.orphaned_at,
        "created_at": edge.created_at,
    }


def _floor_out(override: FloorOverride, pseudo: _Pseudonymizer) -> dict[str, Any]:
    """Serialize a floor override with its id pseudonymized (§4.2)."""
    return {
        "floor_id": pseudo.floor(override.floor_id),
        "level_override": override.level_override,
        "orphaned_at": override.orphaned_at,
        "updated_at": override.updated_at,
    }


def _unknown_out(unknown: UnknownEnumValue, pseudo: _Pseudonymizer) -> dict[str, Any]:
    """Serialize an unknown-enum entry with its owner id pseudonymized (§4.2)."""
    return {
        "scope": unknown.scope,
        "id": _pseudo_scoped_id(unknown.scope, unknown.id, pseudo),
        "field": unknown.field_name,
        "value": unknown.value,
    }


def _pseudo_scoped_id(scope: str, raw_id: str, pseudo: _Pseudonymizer) -> str:
    """Map an id by its scope: ``area`` → area, ``edge`` → edge, else verbatim (§4.2)."""
    if scope == "area":
        return pseudo.area(raw_id)
    if scope == "edge":
        return pseudo.edge(raw_id)
    return raw_id  # "home_config" carries no name-derived id


def _health_out(health: dict[str, Any], pseudo: _Pseudonymizer) -> dict[str, Any]:
    """Map every area_id-bearing health list through the pseudonym map (§4.1)."""
    out = dict(health)
    out["unannotated_areas"] = [pseudo.area(area_id) for area_id in health["unannotated_areas"]]
    out["orphaned_edges"] = [pseudo.edge(edge_id) for edge_id in health["orphaned_edges"]]
    out["orphaned_areas"] = [pseudo.area(area_id) for area_id in health["orphaned_areas"]]
    out["orphaned_floors"] = [pseudo.floor(floor_id) for floor_id in health["orphaned_floors"]]
    out["isolated_areas"] = [pseudo.area(area_id) for area_id in health["isolated_areas"]]
    out["indoor_areas_without_floor"] = [pseudo.area(area_id) for area_id in health["indoor_areas_without_floor"]]
    out["contradictory_bearings"] = [pseudo.area(area_id) for area_id in health["contradictory_bearings"]]
    out["exterior_on_non_outdoor_side"] = [pseudo.area(area_id) for area_id in health["exterior_on_non_outdoor_side"]]
    # The two geometry advisories carry edge_ids, so they go through the edge map.
    out["edges_spanning_multiple_floors"] = [
        pseudo.edge(edge_id) for edge_id in health["edges_spanning_multiple_floors"]
    ]
    out["vertical_edges_without_vertical_passage"] = [
        pseudo.edge(edge_id) for edge_id in health["vertical_edges_without_vertical_passage"]
    ]
    out["unknown_enum_values"] = [
        {
            "scope": entry["scope"],
            "id": _pseudo_scoped_id(entry["scope"], entry["id"], pseudo),
            "field": entry["field"],
            "value": entry["value"],
        }
        for entry in health["unknown_enum_values"]
    ]
    return out
