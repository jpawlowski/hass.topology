/**
 * Inlined English strings for the panel (Phase 7 §5, D11). Panel i18n is a
 * frontend concern outside the AGENTS.md `en.json` + `services.yaml` surface, so
 * these live in the bundle, not the Python translation files. The keyed-dict
 * shape leaves room to add bundled `de`/etc. later without touching Python.
 *
 * Every enum value the panel can show has an `enum.<axis>.<value>` entry. The
 * raw machine tokens are unreadable next to each other — `beyond: outdoor` means
 * "open air" while `environment: outdoor` means the area itself is outside, and
 * showing both as the bare word `outdoor` made two different axes look like one.
 * Resolve them through `enumLabel()` so a missing label is a visible gap in one
 * place rather than a raw token in the UI.
 */

export const EN: Record<string, string> = {
  "panel.title": "Topology",
  "panel.floor.outdoor": "Outdoor / unfloored",
  "panel.floor.all": "All floors",
  "panel.floor.switcher": "Floor",
  "panel.nav.home": "Home configuration",
  "panel.nav.floors": "Floor levels",
  "panel.nav.orphans": "Orphaned entries",
  "panel.nav.back": "Back to home configuration",
  "banner.reconnecting": "Reconnecting…",
  "banner.error": "Could not load topology data",

  "map.needs_annotation": "Needs annotation",
  "map.orphaned": "Orphaned (registry entry gone)",
  "map.legend.trust": "Trust",
  "map.legend.environment": "Environment",
  "map.hint": "Drag to pan, scroll to zoom, double-click to reset.",
  "map.reset_view": "Reset view",
  "map.empty": "No areas to show. Create areas in Home Assistant first.",
  "map.band.unfloored": "No floor",
  "map.offfloor": "{count} connection(s) lead to another floor — switch to All floors to see them.",

  "sidebar.unannotated": "Unannotated areas",
  "sidebar.isolated": "Isolated areas",
  "sidebar.bearings": "Contradictory bearings",
  "sidebar.spanning": "Connections spanning several floors",
  "sidebar.no_climb": "Connections between floors with no way to climb",
  "sidebar.none": "Nothing flagged",

  "editor.area.title": "Area annotation",
  "editor.area.type": "Type",
  "editor.area.type.hint":
    "A shortcut, not a setting: picking a type fills in Environment and Trust below, which are the values automations actually read. Change them freely afterwards — and leave Type empty if none fits.",
  "editor.area.type.custom": "Custom type…",
  "editor.area.type.custom_label": "Custom type",
  "editor.area.environment": "Environment",
  "editor.area.environment.hint": "Whether this space is enclosed, open to the weather, or in between.",
  "editor.area.trust": "Trust",
  "editor.area.trust.hint":
    "How exposed the space is to people: private (household only), shared (guests, other tenants), public (anyone). A boundary where this changes becomes part of the perimeter.",
  "editor.area.unsaved": "Unsaved changes",

  "editor.edge.title": "Connection",
  "editor.edge.preset": "Kind",
  "editor.edge.add": "Add connection",
  "editor.edge.delete": "Delete connection",
  "editor.edge.between": "{a} ↔ {b}",
  "editor.edge.axis.horizontal": "Same floor",
  "editor.edge.axis.vertical_up": "{b} is {levels} floor(s) above {a}",
  "editor.edge.axis.vertical_down": "{b} is {levels} floor(s) below {a}",
  "editor.edge.axis.unknown": "Floor relationship unknown (assign both areas to a floor)",
  "editor.edge.hint": "A boundary can carry several ways across — a stair and a lift beside it are two entries here.",

  "editor.neighbors.title": "Neighbours",
  "editor.neighbors.hint":
    "Which areas this one physically borders. This is what makes the adjacency graph — automations use it to reason about rooms next to, above, and below each other.",
  "editor.neighbors.none": "No neighbours declared yet",
  "editor.neighbors.add": "Add neighbour",
  "editor.neighbors.area": "Area",
  "editor.neighbors.pick": "Choose an area…",
  "editor.neighbors.group.same": "Same floor",
  "editor.neighbors.group.above": "Floor above",
  "editor.neighbors.group.below": "Floor below",
  "editor.neighbors.group.distant": "Other floors (unusual)",
  "editor.neighbors.group.unknown": "No floor assigned",
  "editor.neighbors.distant_warning":
    "These areas are more than one floor apart, so they rarely share a boundary. Check the floor assignments if that is unexpected.",
  "editor.neighbors.edit": "Edit",

  "editor.beyond.title": "Outer walls",
  "editor.beyond.hint":
    "For each side that is NOT shared with another one of your areas, say what is on the other side. This is what makes a wall count as exterior, and it decides where a window can sit.",
  "editor.beyond.interior": "Interior wall — borders {areas}",
  "editor.beyond.unset": "Not specified",
  "editor.beyond.suggest": "Set to {value}, based on your occupancy extent",

  "editor.exterior.title": "Windows & outside doors",
  "editor.exterior.hint":
    "Openings that leave your home entirely. Set the side each one faces — without it the opening cannot be matched against the outer wall it sits in, so nothing can use it.",
  "editor.exterior.none": "No windows or outside doors declared",
  "editor.exterior.sideless":
    "An opening without a side cannot be matched to the outer wall it sits in, so nothing will use it. Pick a side for each one.",
  "editor.exterior.outer_sides": "Outer walls declared for this area: {sides}.",
  "editor.exterior.beyond_trust": "Trust beyond",
  "editor.exterior.beyond_trust.hint":
    "Who can reach the far side. Left empty it counts as public, which makes the opening part of the perimeter.",

  "editor.connection.side": "Side",
  "editor.connection.side.hint": "Rough compass bearing of the wall this sits in.",
  "editor.connection.glazed": "Glazed (lets daylight through)",
  "editor.connection.sensor": "Open/close sensor",
  "editor.connection.sensor.hint":
    "Bind a binary sensor to make this opening observable. Only bound openings can turn the perimeter sensor on.",
  "editor.connection.sensor.none": "Not bound",
  "editor.connection.sensor.unavailable": "Only a door-type kind can carry a sensor",
  "editor.connection.override": "Always treat as perimeter",
  "editor.connection.override.hint":
    "Force this boundary into the perimeter even when both sides share the same trust class — for example the door between a main flat and an annexe.",

  "editor.floor.title": "Floor levels",
  "editor.floor.hint":
    "Levels come from Home Assistant and only say what sits above what — 0 is a perfectly normal ground floor. Topology can fill in a level for a floor that has none; a level set in Home Assistant always wins.",
  "editor.floor.effective": "Effective level",
  "editor.floor.override": "Override",
  "editor.floor.from_registry": "From Home Assistant",
  "editor.floor.unset": "No level set",

  "editor.home.title": "Home configuration",
  "editor.home.occupancy": "Occupancy extent",
  "editor.home.occupancy.hint":
    "Whether you model a whole property or one unit inside a larger building. Recorded for consumers; it does not change any derivation.",
  "editor.home.threshold": "Unannotated repair threshold",
  "editor.home.threshold.hint": "Raise a repair notice once at least this many areas are still unannotated.",
  "editor.home.projection": "Label projection",
  "editor.home.projection.hint":
    "Mirror annotations onto Home Assistant areas as `topology:<dimension>:<value>` labels so automations can target them directly.",
  "editor.home.project_environment": "Project environment labels",
  "editor.home.project_type": "Project type labels",
  "editor.home.project_trust": "Project trust labels",

  "first_run.title": "Seed annotations from Home Assistant",
  "first_run.hint":
    "One-shot import from the area registry. It only fills in annotations that are still empty and never overwrites what you have set.",
  "first_run.source.aliases": "Import area aliases",
  "first_run.source.labels": "Import area labels",
  "first_run.import": "Import",
  "first_run.running": "Importing…",
  "first_run.dismiss": "Not now",

  "editor.orphans.title": "Orphaned entries",
  "editor.orphans.restore": "Restore",
  "editor.orphans.empty": "No orphaned entries",

  "action.save": "Save",
  "action.cancel": "Cancel",
  "action.clear": "Clear",
  "action.add": "Add",
  "action.remove": "Remove",
  "action.close": "Close",

  "enum.environment.indoor": "Indoor",
  "enum.environment.outdoor": "Outdoor",
  "enum.environment.semi_outdoor": "Semi-outdoor",

  "enum.trust.private": "Private",
  "enum.trust.shared": "Shared",
  "enum.trust.public": "Public",

  "enum.beyond.outdoor": "Open air",
  "enum.beyond.neighbor": "Neighbouring unit",
  "enum.beyond.earth": "Earth (buried)",

  "enum.side.N": "North",
  "enum.side.E": "East",
  "enum.side.S": "South",
  "enum.side.W": "West",

  "enum.passage.none": "No way through",
  "enum.passage.level": "Step-free",
  "enum.passage.stairs": "Stairs",
  "enum.passage.ramp": "Ramp",
  "enum.passage.elevator": "Lift",
  "enum.passage.ladder": "Ladder",
  "enum.passage.hatch": "Hatch",

  "enum.barrier.open": "Open",
  "enum.barrier.door": "Door",
  "enum.barrier.solid": "Solid",

  "enum.preset.interior_door": "Interior door",
  "enum.preset.open_passage": "Open passage",
  "enum.preset.shared_wall": "Shared wall",
  "enum.preset.open_stair": "Open stair",
  "enum.preset.enclosed_stair": "Enclosed stair",
  "enum.preset.lift": "Lift",
  "enum.preset.loft_ladder": "Loft ladder",
  "enum.preset.ramp": "Ramp",
  "enum.preset.hatch": "Hatch",
  "enum.preset.window": "Window",
  "enum.preset.outside_door": "Outside door",

  "enum.occupancy.whole_property": "Whole property",
  "enum.occupancy.unit_within_building": "Unit within a building",

  "enum.type.bedroom": "Bedroom",
  "enum.type.living": "Living room",
  "enum.type.kitchen": "Kitchen",
  "enum.type.dining": "Dining room",
  "enum.type.bathroom": "Bathroom",
  "enum.type.hallway": "Hallway",
  "enum.type.office": "Office",
  "enum.type.utility": "Utility room",
  "enum.type.storage": "Storage",
  "enum.type.garage": "Garage",
  "enum.type.balcony": "Balcony",
  "enum.type.terrace": "Terrace",
  "enum.type.outdoor": "Outdoors",

  "error.not_loaded": "Topology is not loaded",
  "error.area_not_found": "Area not found",
  "error.edge_not_found": "Edge not found",
  "error.floor_not_found": "Floor not found",
  "error.invalid_enum": "Invalid value",
  "error.invalid_connection": "Invalid connection",
  "error.store_error": "Could not save the change",
  "error.unauthorized": "Admin permission required",
};
