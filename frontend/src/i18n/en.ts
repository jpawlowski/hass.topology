/**
 * Inlined English strings for the panel (Phase 7 §5, D11). Panel i18n is a
 * frontend concern outside the AGENTS.md `en.json` + `services.yaml` surface, so
 * these live in the bundle, not the Python translation files. The keyed-dict
 * shape leaves room to add bundled `de`/etc. later without touching Python.
 */

export const EN: Record<string, string> = {
  "panel.title": "Topology",
  "panel.floor.outdoor": "Outdoor / unfloored",
  "panel.floor.switcher": "Floor",
  "banner.reconnecting": "Reconnecting…",
  "banner.error": "Could not load topology data",

  "map.needs_annotation": "Needs annotation",
  "map.orphaned": "Orphaned (registry entry gone)",
  "map.legend.trust": "Trust",
  "map.legend.environment": "Environment",

  "sidebar.unannotated": "Unannotated areas",
  "sidebar.isolated": "Isolated areas",
  "sidebar.bearings": "Contradictory bearings",
  "sidebar.none": "Nothing flagged",

  "editor.area.title": "Area annotation",
  "editor.area.type": "Type",
  "editor.area.environment": "Environment",
  "editor.area.trust": "Trust",
  "editor.edge.title": "Connection",
  "editor.edge.preset": "Preset",
  "editor.edge.add": "Add connection",
  "editor.edge.delete": "Delete edge",
  "editor.beyond.title": "Outer wall (beyond)",
  "editor.exterior.title": "Exterior connections",
  "editor.floor.title": "Floor levels",
  "editor.floor.effective": "Effective level",
  "editor.floor.override": "Override",
  "editor.home.title": "Home configuration",
  "editor.home.occupancy": "Occupancy extent",
  "editor.home.threshold": "Unannotated repair threshold",
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

  "error.not_loaded": "Topology is not loaded",
  "error.area_not_found": "Area not found",
  "error.edge_not_found": "Edge not found",
  "error.floor_not_found": "Floor not found",
  "error.invalid_enum": "Invalid value",
  "error.invalid_connection": "Invalid connection",
  "error.store_error": "Could not save the change",
  "error.unauthorized": "Admin permission required",
};
