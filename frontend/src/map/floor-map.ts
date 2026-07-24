/**
 * The per-floor 2D map (Phase 7 §2.5) — explicitly 2D in v1 (master §7). A
 * read-only renderer: it draws area nodes (tinted by trust, styled by
 * environment) and interior edges (styled by the most-permeable connection,
 * perimeter highlighted), overlays the `health` consistency flags, and emits
 * selection events. It never writes.
 *
 * Card-reuse boundary (§4.2, D15): this element imports no editor, no write
 * command, and none of the panel's route/panel props — it takes plain data +
 * `hass` (for names/icons) and emits `area-selected` / `edge-selected`
 * CustomEvents. A future read-only Lovelace card renders it unchanged.
 */

import { LitElement, html, svg, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { AreaOut, EdgeOut, FloorOut, HealthResult } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { FocusScope } from "../router";
import { computeLayout } from "./layout";
import { edgeStyle, environmentClass, needsAnnotation, trustTint } from "./styling";
import { localize } from "../i18n/localize";

/** Sentinel floor id for the outdoor / unfloored bucket (§2.5). */
export const OUTDOOR_BUCKET = "__outdoor__";

/** Health list consulted for each focus scope (§2.5 consistency overlay). */
const FOCUS_HEALTH_KEY: Partial<Record<FocusScope, keyof HealthResult>> = {
  unannotated: "unannotated_areas",
  isolated: "isolated_areas",
  floors: "indoor_areas_without_floor",
  bearings: "contradictory_bearings",
  exterior: "exterior_on_non_outdoor_side",
};

@customElement("topology-floor-map")
export class TopologyFloorMap extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public areas: AreaOut[] = [];
  @property({ attribute: false }) public edges: EdgeOut[] = [];
  @property({ attribute: false }) public floors: FloorOut[] = [];
  @property({ attribute: false }) public health: HealthResult | null = null;
  @property({ attribute: false }) public activeFloor: string | null = null;
  @property({ attribute: false }) public focusScope: FocusScope | null = null;

  private areaFloor(areaId: string): string {
    const area = this.hass?.areas?.[areaId];
    return area?.floor_id ?? OUTDOOR_BUCKET;
  }

  private areaName(areaId: string, annotation: AreaOut): string {
    const name = this.hass?.areas?.[areaId]?.name;
    if (name) {
      return name;
    }
    return annotation.type ?? areaId;
  }

  /** Area ids flagged by the active focus scope, from the live health lists. */
  private flaggedAreas(): Set<string> {
    if (this.focusScope === null || this.health === null) {
      return new Set();
    }
    const key = FOCUS_HEALTH_KEY[this.focusScope];
    if (key === undefined) {
      return new Set();
    }
    const value = this.health[key];
    return new Set(Array.isArray(value) ? (value as string[]) : []);
  }

  private visibleAreas(): AreaOut[] {
    if (this.activeFloor === null) {
      return this.areas;
    }
    return this.areas.filter((area) => this.areaFloor(area.area_id) === this.activeFloor);
  }

  protected override render() {
    const areas = this.visibleAreas();
    const visibleIds = new Set(areas.map((area) => area.area_id));
    const layout = computeLayout(areas.map((area) => area.area_id));
    const flagged = this.flaggedAreas();
    const edges = this.edges.filter(
      (edge) =>
        !edge.orphaned_at && visibleIds.has(edge.area_a) && visibleIds.has(edge.area_b),
    );

    return html`
      <svg viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid meet" role="img">
        <g class="edges">
          ${edges.map((edge) => this.renderEdge(edge, layout))}
        </g>
        <g class="nodes">
          ${areas.map((area) => this.renderNode(area, layout, flagged.has(area.area_id)))}
        </g>
      </svg>
    `;
  }

  private renderEdge(edge: EdgeOut, layout: Map<string, { x: number; y: number }>) {
    const a = layout.get(edge.area_a);
    const b = layout.get(edge.area_b);
    if (!a || !b) {
      return nothing;
    }
    const style = edgeStyle(edge);
    const classes = `edge barrier-${style.barrier} ${style.perimeter ? "perimeter" : ""}`;
    return svg`
      <line
        class=${classes}
        x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y}
        tabindex="0"
        @click=${() => this.emitEdge(edge)}
        @keydown=${(ev: KeyboardEvent) => this.onKey(ev, () => this.emitEdge(edge))}
      ></line>
      ${style.glyph
        ? svg`<text class="glyph" x=${(a.x + b.x) / 2} y=${(a.y + b.y) / 2}>${style.glyph}</text>`
        : nothing}
    `;
  }

  private renderNode(
    area: AreaOut,
    layout: Map<string, { x: number; y: number }>,
    isFlagged: boolean,
  ) {
    const point = layout.get(area.area_id);
    if (!point) {
      return nothing;
    }
    const orphaned = area.orphaned_at !== null;
    const muted = needsAnnotation(area);
    const classes = [
      "node",
      `trust-${trustTint(area.trust)}`,
      `env-${environmentClass(area.environment)}`,
      muted ? "muted" : "",
      isFlagged ? "flagged" : "",
      orphaned ? "orphaned" : "",
    ].join(" ");
    const width = 150;
    const height = 64;
    return svg`
      <g
        class=${classes}
        transform="translate(${point.x - width / 2}, ${point.y - height / 2})"
        tabindex="0"
        @click=${() => this.emitArea(area)}
        @keydown=${(ev: KeyboardEvent) => this.onKey(ev, () => this.emitArea(area))}
      >
        <rect class="node-body" width=${width} height=${height} rx="10"></rect>
        <text class="node-label" x=${width / 2} y=${height / 2}>
          ${this.areaName(area.area_id, area)}
        </text>
        ${muted
          ? svg`<title>${localize("map.needs_annotation")}</title>`
          : nothing}
        ${orphaned
          ? svg`<circle class="orphan-badge" cx=${width - 8} cy="8" r="7"></circle>
                <title>${localize("map.orphaned")}</title>`
          : nothing}
      </g>
    `;
  }

  private onKey(ev: KeyboardEvent, action: () => void): void {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      action();
    }
  }

  private emitArea(area: AreaOut): void {
    this.dispatchEvent(
      new CustomEvent("area-selected", { detail: { area }, bubbles: true, composed: true }),
    );
  }

  private emitEdge(edge: EdgeOut): void {
    this.dispatchEvent(
      new CustomEvent("edge-selected", { detail: { edge }, bubbles: true, composed: true }),
    );
  }

  public static override styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    svg {
      width: 100%;
      height: 100%;
      background: var(--card-background-color, #fff);
      border-radius: 12px;
    }
    .edge {
      stroke: var(--primary-text-color, #212121);
      stroke-width: 3;
      opacity: 0.8;
      cursor: pointer;
    }
    .edge:focus {
      outline: none;
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 5;
    }
    .barrier-open {
      stroke-dasharray: none;
      opacity: 1;
    }
    .barrier-door {
      stroke-dasharray: 10 6;
    }
    .barrier-solid {
      stroke-dasharray: 2 8;
      opacity: 0.5;
    }
    .edge.perimeter {
      stroke: var(--warning-color, #ff9800);
      stroke-width: 4;
    }
    .glyph {
      font-size: 18px;
      fill: var(--secondary-text-color, #727272);
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }
    .node {
      cursor: pointer;
    }
    .node-body {
      fill: var(--card-background-color, #fff);
      stroke: var(--divider-color, #bdbdbd);
      stroke-width: 2;
    }
    .trust-private .node-body {
      fill: var(--topology-trust-private, rgba(3, 169, 244, 0.14));
    }
    .trust-shared .node-body {
      fill: var(--topology-trust-shared, rgba(76, 175, 80, 0.14));
    }
    .trust-public .node-body {
      fill: var(--topology-trust-public, rgba(255, 152, 0, 0.14));
    }
    .env-outdoor .node-body {
      stroke-dasharray: 6 4;
    }
    .env-semi_outdoor .node-body {
      stroke-dasharray: 2 4;
    }
    .node.muted .node-body {
      opacity: 0.5;
      stroke-dasharray: 4 4;
    }
    .node.flagged .node-body {
      stroke: var(--error-color, #f44336);
      stroke-width: 4;
    }
    .node.orphaned .node-body {
      stroke: var(--error-color, #f44336);
    }
    .node:focus {
      outline: none;
    }
    .node:focus .node-body {
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 4;
    }
    .node-label {
      text-anchor: middle;
      dominant-baseline: middle;
      fill: var(--primary-text-color, #212121);
      font-size: 16px;
      pointer-events: none;
    }
    .orphan-badge {
      fill: var(--error-color, #f44336);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-floor-map": TopologyFloorMap;
  }
}
