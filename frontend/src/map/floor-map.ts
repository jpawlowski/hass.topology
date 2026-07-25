/**
 * The per-floor 2D map (Phase 7 §2.5) — explicitly 2D in v1 (master §7). A
 * read-only renderer: it draws area nodes (tinted by trust, styled by
 * environment) and edges (styled by the most-permeable connection, perimeter
 * highlighted), overlays the `health` consistency flags, and emits selection
 * events. It never writes.
 *
 * The `viewBox` follows the layout's own bounding box rather than a fixed
 * 1000×700 window, so a node can never be laid out outside the visible area; pan
 * and zoom are for reading detail, not for reaching content. Areas are grouped
 * into per-floor bands (see `./layout`), which is what makes the picture show
 * what is above what before any connection exists.
 *
 * Card-reuse boundary (§4.2, D15): this element imports no editor, no write
 * command, and none of the panel's route/panel props — it takes plain data +
 * `hass` (for names/icons) and emits `area-selected` / `edge-selected`
 * CustomEvents. A future read-only Lovelace card renders it unchanged.
 */

import { LitElement, html, svg, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AreaOut, EdgeOut, Environment, FloorOut, HealthResult, Trust } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { FocusScope } from "../router";
import { computeLayout, type Extent, type LayoutNode, type Point } from "./layout";
import { edgeStyle, environmentClass, needsAnnotation, trustTint } from "./styling";
import { enumLabel, localize } from "../i18n/localize";

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

const NODE_WIDTH = 150;
const NODE_HEIGHT = 64;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;

/** Length of an inter-floor connector stub, in viewBox units. */
const CONNECTOR_LENGTH = 30;

/**
 * One edge that leaves the floor on screen, resolved from the visible side.
 *
 * A single-floor view can draw no line for these — the far node is not laid
 * out — but hiding them made declared vertical connections look undeclared, and
 * counting them only told the user that something existed somewhere. A stub
 * pointing the way the edge actually goes is the smallest thing that answers
 * "what is above this room".
 */
interface Connector {
  edge: EdgeOut;
  /** The endpoint that *is* on screen. */
  areaId: string;
  /** The endpoint that is not. */
  otherId: string;
  /** `1` = the far side is above, `-1` = below, `0` = no resolvable level. */
  direction: 1 | 0 | -1;
}

@customElement("topology-floor-map")
export class TopologyFloorMap extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public areas: AreaOut[] = [];
  @property({ attribute: false }) public edges: EdgeOut[] = [];
  @property({ attribute: false }) public floors: FloorOut[] = [];
  @property({ attribute: false }) public health: HealthResult | null = null;
  @property({ attribute: false }) public activeFloor: string | null = null;
  @property({ attribute: false }) public focusScope: FocusScope | null = null;
  @property({ attribute: false }) public selectedAreaId: string | null = null;
  @property({ attribute: false }) public selectedEdgeId: string | null = null;

  /** User pan/zoom, as a viewBox. `null` means "follow the content extent". */
  @state() private viewOverride: Extent | null = null;

  private panStart: { pointerId: number; x: number; y: number; view: Extent } | null = null;

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

  private floorName(floorId: string | null): string {
    if (floorId === null || floorId === OUTDOOR_BUCKET) {
      return localize("panel.floor.outdoor");
    }
    return this.hass?.floors?.[floorId]?.name ?? floorId;
  }

  /**
   * Edge ids flagged by the active focus scope. The consistency overlay used to
   * flag areas only, so a scope whose findings are boundaries highlighted nothing.
   */
  private flaggedEdges(): Set<string> {
    if (this.focusScope !== "geometry" || this.health === null) {
      return new Set();
    }
    return new Set([
      ...(this.health.edges_spanning_multiple_floors ?? []),
      ...(this.health.vertical_edges_without_vertical_passage ?? []),
    ]);
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

  /** Floor ids top-down, as the server ordered them, plus the unfloored bucket. */
  private floorOrder(): string[] {
    return [...this.floors.map((floor) => floor.floor_id), OUTDOOR_BUCKET];
  }

  protected override render() {
    const areas = this.visibleAreas();
    if (areas.length === 0) {
      return html`<div class="empty">${localize("map.empty")}</div>`;
    }
    const visibleIds = new Set(areas.map((area) => area.area_id));
    const nodes: LayoutNode[] = areas.map((area) => ({
      areaId: area.area_id,
      floorId: this.areaFloor(area.area_id),
    }));
    const layout = computeLayout(nodes, this.floorOrder(), {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    });
    const flagged = this.flaggedAreas();
    const flaggedEdges = this.flaggedEdges();
    const edges = this.edges.filter(
      (edge) => !edge.orphaned_at && visibleIds.has(edge.area_a) && visibleIds.has(edge.area_b),
    );
    const connectors = this.offFloorConnectors(visibleIds);
    const view = this.viewOverride ?? layout.extent;
    const viewBox = `${view.x} ${view.y} ${view.width} ${view.height}`;

    return html`
      <div class="wrap">
        <svg
          viewBox=${viewBox}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          @wheel=${this.onWheel}
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerUp}
          @dblclick=${this.resetView}
        >
          <g class="bands">
            ${layout.bands.length > 1
              ? layout.bands.map((band) => this.renderBand(band, layout.extent))
              : nothing}
          </g>
          <g class="edges">
            ${edges.map((edge) => this.renderEdge(edge, layout.positions, flaggedEdges.has(edge.edge_id)))}
          </g>
          <g class="connectors">
            ${this.renderConnectors(connectors, layout.positions, flaggedEdges)}
          </g>
          <g class="nodes">
            ${areas.map((area) => this.renderNode(area, layout.positions, flagged.has(area.area_id)))}
          </g>
        </svg>
        ${this.renderLegend()}
        <div class="overlay">
          ${this.viewOverride !== null
            ? html`<button class="reset" @click=${this.resetView}>${localize("map.reset_view")}</button>`
            : nothing}
          ${connectors.length > 0
            ? html`<p class="offfloor">${localize("map.offfloor", { count: connectors.length })}</p>`
            : nothing}
          <p class="hint">${localize("map.hint")}</p>
        </div>
      </div>
    `;
  }

  /**
   * Key to the encoding. The map tints by trust and dashes by environment, which
   * is unreadable without a key — the legend strings existed but nothing rendered
   * them.
   */
  private renderLegend() {
    const trusts: Trust[] = ["private", "shared", "public"];
    const environments: Environment[] = ["indoor", "semi_outdoor", "outdoor"];
    return html`
      <div class="legend">
        <span class="group">
          <span class="caption">${localize("map.legend.trust")}</span>
          ${trusts.map(
            (trust) => html`
              <span class="item">
                <span class="swatch trust-${trust}"></span>${enumLabel("trust", trust)}
              </span>
            `,
          )}
        </span>
        <span class="group">
          <span class="caption">${localize("map.legend.environment")}</span>
          ${environments.map(
            (environment) => html`
              <span class="item">
                <span class="swatch env-${environment}"></span>${enumLabel("environment", environment)}
              </span>
            `,
          )}
        </span>
      </div>
    `;
  }

  /** A floor band: a tinted strip plus the floor's name, so the stack reads. */
  private renderBand(band: { floorId: string | null; y: number; height: number }, extent: Extent) {
    return svg`
      <g class="band">
        <rect x="0" y=${band.y - 12} width=${extent.width} height=${band.height + 24} rx="12"></rect>
        <text class="band-label" x="12" y=${band.y - 18}>${this.floorName(band.floorId)}</text>
      </g>
    `;
  }

  /**
   * Edges with exactly one endpoint on the visible floor, resolved from that
   * endpoint's point of view.
   *
   * `level_delta` is signed `area_a -> area_b`, so it has to be flipped when the
   * visible side is `area_b` — otherwise every second connector points the wrong
   * way, which is worse than not drawing it at all.
   */
  private offFloorConnectors(visibleIds: Set<string>): Connector[] {
    const result: Connector[] = [];
    for (const edge of this.edges) {
      if (edge.orphaned_at) {
        continue;
      }
      const aVisible = visibleIds.has(edge.area_a);
      if (aVisible === visibleIds.has(edge.area_b)) {
        continue;
      }
      const areaId = aVisible ? edge.area_a : edge.area_b;
      const otherId = aVisible ? edge.area_b : edge.area_a;
      const delta = edge.level_delta;
      const signed = delta === null || delta === 0 ? 0 : Math.sign(aVisible ? delta : -delta);
      result.push({ edge, areaId, otherId, direction: signed as 1 | 0 | -1 });
    }
    return result;
  }

  private renderConnectors(
    connectors: Connector[],
    positions: Map<string, Point>,
    flaggedEdges: Set<string>,
  ) {
    // Fan several connectors out across the node's width instead of stacking
    // them on one point, so two stairs from the same landing stay distinguishable.
    const byArea = new Map<string, Connector[]>();
    for (const connector of connectors) {
      const bucket = byArea.get(connector.areaId);
      if (bucket === undefined) {
        byArea.set(connector.areaId, [connector]);
      } else {
        bucket.push(connector);
      }
    }
    return [...byArea.entries()].flatMap(([areaId, group]) =>
      group.map((connector, index) =>
        this.renderConnector(connector, positions.get(areaId), index, group.length, flaggedEdges),
      ),
    );
  }

  private renderConnector(
    connector: Connector,
    point: Point | undefined,
    index: number,
    total: number,
    flaggedEdges: Set<string>,
  ) {
    if (!point) {
      return nothing;
    }
    // A connector with no resolvable level is drawn upward but labelled without a
    // direction — pretending to know which way it goes would be a lie the map
    // cannot back up.
    const up = connector.direction >= 0;
    const spread = NODE_WIDTH * 0.6;
    const x = point.x - spread / 2 + (total === 1 ? spread / 2 : (spread * index) / (total - 1));
    const yStart = point.y + (up ? -NODE_HEIGHT / 2 : NODE_HEIGHT / 2);
    const yEnd = yStart + (up ? -CONNECTOR_LENGTH : CONNECTOR_LENGTH);
    const style = edgeStyle(connector.edge);
    const selected = connector.edge.edge_id === this.selectedEdgeId;
    const classes = [
      "connector",
      `barrier-${style.barrier}`,
      up ? "up" : "down",
      connector.direction === 0 ? "unknown" : "",
      flaggedEdges.has(connector.edge.edge_id) ? "flagged" : "",
      selected ? "selected" : "",
    ].join(" ");
    const key = connector.direction === 0 ? "map.connector.unknown" : up ? "map.connector.up" : "map.connector.down";
    const label = localize(key, {
      area: this.areaLabel(connector.otherId),
      floor: this.floorName(this.areaFloor(connector.otherId)),
    });
    const head = up ? yEnd + 7 : yEnd - 7;
    return svg`
      <g
        class=${classes}
        tabindex="0"
        @click=${() => this.emitEdge(connector.edge)}
        @keydown=${(ev: KeyboardEvent) => this.onKey(ev, () => this.emitEdge(connector.edge))}
        @dblclick=${(ev: Event) => this.onConnectorActivate(ev, connector)}
      >
        <line class="stem" x1=${x} y1=${yStart} x2=${x} y2=${yEnd}></line>
        <polyline class="head" points=${`${x - 6},${head} ${x},${yEnd} ${x + 6},${head}`}></polyline>
        <text class="connector-label" x=${x} y=${up ? yEnd - 8 : yEnd + 18}>${label}</text>
        <title>${label} — ${localize("map.connector.hint")}</title>
      </g>
    `;
  }

  /** Ask the host to switch floors; the map itself owns no navigation (§4.2, D15). */
  private onConnectorActivate(ev: Event, connector: Connector): void {
    // The svg's own dblclick resets the view, which is not what a double-click on
    // a connector means.
    ev.stopPropagation();
    ev.preventDefault();
    const floorId = this.areaFloor(connector.otherId);
    this.dispatchEvent(
      new CustomEvent("floor-requested", {
        detail: { floorId: floorId === OUTDOOR_BUCKET ? null : floorId, areaId: connector.otherId },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** Registry name of an area that may not be in the rendered set. */
  private areaLabel(areaId: string): string {
    return this.hass?.areas?.[areaId]?.name ?? areaId;
  }

  private renderEdge(edge: EdgeOut, positions: Map<string, Point>, isFlagged = false) {
    const a = positions.get(edge.area_a);
    const b = positions.get(edge.area_b);
    if (!a || !b) {
      return nothing;
    }
    const style = edgeStyle(edge);
    const selected = edge.edge_id === this.selectedEdgeId;
    const classes = [
      "edge",
      `barrier-${style.barrier}`,
      style.perimeter ? "perimeter" : "",
      isFlagged ? "flagged" : "",
      selected ? "selected" : "",
    ].join(" ");
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

  private renderNode(area: AreaOut, positions: Map<string, Point>, isFlagged: boolean) {
    const point = positions.get(area.area_id);
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
      area.area_id === this.selectedAreaId ? "selected" : "",
    ].join(" ");
    return svg`
      <g
        class=${classes}
        transform="translate(${point.x - NODE_WIDTH / 2}, ${point.y - NODE_HEIGHT / 2})"
        tabindex="0"
        @click=${() => this.emitArea(area)}
        @keydown=${(ev: KeyboardEvent) => this.onKey(ev, () => this.emitArea(area))}
      >
        <rect class="node-body" width=${NODE_WIDTH} height=${NODE_HEIGHT} rx="10"></rect>
        <text class="node-label" x=${NODE_WIDTH / 2} y=${NODE_HEIGHT / 2}>
          ${this.areaName(area.area_id, area)}
        </text>
        ${muted ? svg`<title>${localize("map.needs_annotation")}</title>` : nothing}
        ${orphaned
          ? svg`<circle class="orphan-badge" cx=${NODE_WIDTH - 8} cy="8" r="7"></circle>
                <title>${localize("map.orphaned")}</title>`
          : nothing}
      </g>
    `;
  }

  // --- pan / zoom ----------------------------------------------------------

  /** The viewBox currently in effect, resolving the "follow content" default. */
  private currentView(): Extent {
    return this.viewOverride ?? this.contentExtent();
  }

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    const view = this.currentView();
    const base = this.contentExtent();
    const factor = ev.deltaY > 0 ? 1.15 : 1 / 1.15;
    const width = view.width * factor;
    // Zoom is bounded relative to the content, so neither gesture can strand the
    // user at a scale where nothing is findable.
    if (base.width / width < MIN_ZOOM || base.width / width > MAX_ZOOM) {
      return;
    }
    const height = view.height * factor;
    // Keep the point under the cursor fixed.
    const { x: px, y: py } = this.toSvgPoint(ev, view);
    this.viewOverride = {
      x: px - ((px - view.x) * width) / view.width,
      y: py - ((py - view.y) * height) / view.height,
      width,
      height,
    };
  };

  private contentExtent(): Extent {
    const nodes: LayoutNode[] = this.visibleAreas().map((area) => ({
      areaId: area.area_id,
      floorId: this.areaFloor(area.area_id),
    }));
    return computeLayout(nodes, this.floorOrder(), {
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    }).extent;
  }

  /** Map a pointer event to viewBox coordinates. */
  private toSvgPoint(ev: MouseEvent, view: Extent): Point {
    const svgEl = ev.currentTarget as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return { x: view.x, y: view.y };
    }
    // `xMidYMid meet` scales uniformly and centres the leftover space.
    const scale = Math.min(rect.width / view.width, rect.height / view.height);
    const offsetX = (rect.width - view.width * scale) / 2;
    const offsetY = (rect.height - view.height * scale) / 2;
    return {
      x: view.x + (ev.clientX - rect.left - offsetX) / scale,
      y: view.y + (ev.clientY - rect.top - offsetY) / scale,
    };
  }

  private onPointerDown = (ev: PointerEvent): void => {
    // Only start a pan on empty canvas; a node or edge owns its own click.
    if ((ev.target as Element).closest(".node, .edge") !== null) {
      return;
    }
    const view = this.currentView();
    this.panStart = { pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, view };
    (ev.currentTarget as SVGSVGElement).setPointerCapture(ev.pointerId);
  };

  private onPointerMove = (ev: PointerEvent): void => {
    const start = this.panStart;
    if (start === null || start.pointerId !== ev.pointerId) {
      return;
    }
    const svgEl = ev.currentTarget as SVGSVGElement;
    const rect = svgEl.getBoundingClientRect();
    const scale = Math.min(rect.width / start.view.width, rect.height / start.view.height) || 1;
    this.viewOverride = {
      ...start.view,
      x: start.view.x - (ev.clientX - start.x) / scale,
      y: start.view.y - (ev.clientY - start.y) / scale,
    };
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (this.panStart?.pointerId === ev.pointerId) {
      this.panStart = null;
    }
  };

  private resetView = (): void => {
    this.viewOverride = null;
  };

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
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
    }
    svg {
      width: 100%;
      height: 100%;
      background: var(--card-background-color, #fff);
      border-radius: 12px;
      touch-action: none;
      cursor: grab;
    }
    svg:active {
      cursor: grabbing;
    }
    .overlay {
      position: absolute;
      right: 12px;
      bottom: 8px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      pointer-events: none;
    }
    .overlay button {
      pointer-events: auto;
      padding: 4px 10px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 14px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
      cursor: pointer;
      font-size: 0.8em;
    }
    .overlay p {
      margin: 0;
      font-size: 0.75em;
      color: var(--secondary-text-color, #727272);
    }
    .legend {
      position: absolute;
      top: 8px;
      left: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      pointer-events: none;
      font-size: 0.72em;
      color: var(--secondary-text-color, #727272);
    }
    .legend .group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .legend .caption {
      font-weight: 500;
    }
    .legend .item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .legend .swatch {
      display: inline-block;
      width: 14px;
      height: 10px;
      border: 2px solid var(--divider-color, #bdbdbd);
      border-radius: 3px;
      background: var(--card-background-color, #fff);
    }
    .legend .swatch.trust-private {
      background: var(--topology-trust-private, rgba(3, 169, 244, 0.14));
    }
    .legend .swatch.trust-shared {
      background: var(--topology-trust-shared, rgba(76, 175, 80, 0.14));
    }
    .legend .swatch.trust-public {
      background: var(--topology-trust-public, rgba(255, 152, 0, 0.14));
    }
    .legend .swatch.env-outdoor {
      border-style: dashed;
    }
    .legend .swatch.env-semi_outdoor {
      border-style: dotted;
    }
    .band rect {
      fill: var(--secondary-background-color, rgba(0, 0, 0, 0.04));
      stroke: none;
    }
    .band-label {
      fill: var(--secondary-text-color, #727272);
      font-size: 15px;
      dominant-baseline: auto;
    }
    .edge {
      stroke: var(--primary-text-color, #212121);
      stroke-width: 3;
      opacity: 0.8;
      cursor: pointer;
    }
    .edge:focus,
    .edge.selected {
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
    .edge.flagged {
      stroke: var(--error-color, #f44336);
      stroke-width: 5;
    }
    .connector {
      cursor: pointer;
    }
    .connector .stem,
    .connector .head {
      stroke: var(--primary-text-color, #212121);
      stroke-width: 3;
      fill: none;
      opacity: 0.8;
    }
    .connector.barrier-door .stem {
      stroke-dasharray: 10 6;
    }
    .connector.barrier-solid .stem {
      stroke-dasharray: 2 8;
      opacity: 0.5;
    }
    .connector.unknown .stem,
    .connector.unknown .head {
      opacity: 0.45;
    }
    .connector.flagged .stem,
    .connector.flagged .head {
      stroke: var(--error-color, #f44336);
    }
    .connector:focus,
    .connector.selected {
      outline: none;
    }
    .connector:focus .stem,
    .connector:focus .head,
    .connector.selected .stem,
    .connector.selected .head {
      stroke: var(--primary-color, #03a9f4);
      stroke-width: 5;
    }
    .connector-label {
      text-anchor: middle;
      fill: var(--secondary-text-color, #727272);
      font-size: 12px;
      pointer-events: none;
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
    .node:focus .node-body,
    .node.selected .node-body {
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
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 16px;
      text-align: center;
      color: var(--secondary-text-color, #727272);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-floor-map": TopologyFloorMap;
  }
}
