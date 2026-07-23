# Examples

> [!IMPORTANT]
> **Planning stage.** Topology has no entities or services yet — see
> [`../development/PLAN.md`](../development/PLAN.md) for the roadmap.
> Real-world automation examples land in Phase 9 alongside the first
> release.

Once the read hook (Phase 5) and label projection (Phase 6) are in
place, this page will show typical patterns:

- Trigger on any perimeter door opening while the household is `away`,
  using `binary_sensor.topology_perimeter_open`.
- Target automations at all `outdoor` areas via the projected
  `topology:outdoor` label.
- Combine `topology:private` + a residents `needs_quiet` state to
  filter courier notifications.

Nothing is stable enough to publish yet — snippets would rot.
