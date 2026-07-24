"""
Perimeter-open binary sensor for topology (§2).

``binary_sensor.topology_perimeter_open`` is the live any-of aggregate over the
door/window sensors bound to perimeter connections. The perimeter set comes from
``coordinator.derived.perimeter`` (never a direct registry/store read); the
entity subscribes to those bound sensors' state and re-subscribes when the
topology changes. Bound-sensor changes are coalesced through a debouncer.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from custom_components.topology.const import LOGGER, PERIMETER_DEBOUNCE_SECONDS, TRANSLATION_KEY_PERIMETER_OPEN
from custom_components.topology.entity import TopologyEntity
from custom_components.topology.entity_utils.entity_ids import perimeter_object_id, perimeter_unique_id
from homeassistant.components.binary_sensor import ENTITY_ID_FORMAT, BinarySensorDeviceClass, BinarySensorEntity
from homeassistant.const import STATE_ON, STATE_UNAVAILABLE, STATE_UNKNOWN
from homeassistant.core import callback
from homeassistant.helpers.debounce import Debouncer
from homeassistant.helpers.entity import async_generate_entity_id
from homeassistant.helpers.event import async_track_state_change_event

if TYPE_CHECKING:
    from custom_components.topology.coordinator import TopologyCoordinator
    from custom_components.topology.data import PerimeterConnection
    from homeassistant.core import CALLBACK_TYPE, Event
    from homeassistant.helpers.event import EventStateChangedData

_UNOBSERVABLE = {STATE_UNAVAILABLE, STATE_UNKNOWN}


class TopologyPerimeterBinarySensor(TopologyEntity, BinarySensorEntity):
    """Aggregate: on when any bound perimeter sensor is open (§2)."""

    _attr_translation_key = TRANSLATION_KEY_PERIMETER_OPEN
    _attr_device_class = BinarySensorDeviceClass.OPENING

    def __init__(self, coordinator: TopologyCoordinator) -> None:
        """Pin the frozen unique_id and entity_id (§2.1, §4)."""
        super().__init__(coordinator)
        self._attr_unique_id = perimeter_unique_id(coordinator.config_entry.entry_id)
        self.entity_id = async_generate_entity_id(ENTITY_ID_FORMAT, perimeter_object_id(), hass=coordinator.hass)
        self._tracked_sensors: tuple[str, ...] = ()
        self._unsub_state: CALLBACK_TYPE | None = None
        self._debouncer: Debouncer | None = None

    def _monitored(self) -> tuple[PerimeterConnection, ...]:
        """Return perimeter connections that carry a bound sensor (§2.2)."""
        return tuple(
            connection for connection in self.coordinator.derived.perimeter if connection.sensor_entity_id is not None
        )

    def _sensor_open(self, entity_id: str | None) -> bool:
        """Return whether a bound sensor currently reads open (state == on, D2)."""
        if entity_id is None:
            return False
        state = self.hass.states.get(entity_id)
        return state is not None and state.state == STATE_ON

    @property
    def is_on(self) -> bool:
        """On iff any bound perimeter sensor is open (§2.3)."""
        return any(self._sensor_open(connection.sensor_entity_id) for connection in self._monitored())

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return the open-connection list and observability counts (§2.5)."""
        monitored = self._monitored()
        open_connections: list[dict[str, Any]] = []
        unavailable: set[str] = set()
        for connection in monitored:
            entity_id = connection.sensor_entity_id
            if entity_id is None:
                continue
            state = self.hass.states.get(entity_id)
            if state is None or state.state in _UNOBSERVABLE:
                unavailable.add(entity_id)
                continue
            if state.state == STATE_ON:
                open_connections.append(
                    {
                        "edge_id": connection.edge_id,
                        "area_id": connection.area_id,
                        "connection_index": connection.connection_index,
                        "source_entity": entity_id,
                    }
                )
        open_connections.sort(key=lambda item: (item["edge_id"] or "", item["area_id"], item["connection_index"]))
        return {
            "open_connections": open_connections,
            "open_count": len(open_connections),
            "monitored_count": len(monitored),
            "unavailable_sensors": sorted(unavailable),
        }

    async def async_added_to_hass(self) -> None:
        """Subscribe to the bound sensors and start the debouncer (§2.4)."""
        await super().async_added_to_hass()
        self._debouncer = Debouncer(
            self.hass,
            LOGGER,
            cooldown=PERIMETER_DEBOUNCE_SECONDS,
            immediate=True,
            function=self._async_write_debounced,
        )
        self.async_on_remove(self._async_teardown)
        self._async_resubscribe()

    @callback
    def _async_teardown(self) -> None:
        """Tear down the state subscription and debouncer on remove (§2.4)."""
        if self._unsub_state is not None:
            self._unsub_state()
            self._unsub_state = None
        if self._debouncer is not None:
            self._debouncer.async_shutdown()

    async def _async_write_debounced(self) -> None:
        """Debounced state write (§2.3)."""
        self.async_write_ha_state()

    @callback
    def _async_sensor_changed(self, event: Event[EventStateChangedData]) -> None:
        """Coalesce a bound-sensor change into one state write (§2.3)."""
        if self._debouncer is not None:
            self.hass.async_create_task(self._debouncer.async_call())

    @callback
    def _handle_coordinator_update(self) -> None:
        """Re-subscribe when the perimeter set changed, then write state (§2.4)."""
        self._async_resubscribe()
        super()._handle_coordinator_update()

    @callback
    def _async_resubscribe(self) -> None:
        """Align the state subscription with the current bound-sensor set (§2.4)."""
        sensors = tuple(
            sorted(
                {
                    connection.sensor_entity_id
                    for connection in self._monitored()
                    if connection.sensor_entity_id is not None
                }
            )
        )
        if sensors == self._tracked_sensors:
            return
        if self._unsub_state is not None:
            self._unsub_state()
            self._unsub_state = None
        self._tracked_sensors = sensors
        if sensors:
            self._unsub_state = async_track_state_change_event(self.hass, list(sensors), self._async_sensor_changed)
