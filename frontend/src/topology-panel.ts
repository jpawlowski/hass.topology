/**
 * `<topology-panel>` — the admin sidebar panel element (Phase 7 §2). HA sets
 * `hass` / `narrow` / `route` / `panel` on this element (A.5); it constructs the
 * frozen-v1 WS client + the client store, renders the 2D map beside a contextual
 * editor, resolves the `?focus=` deep-link (§2.2/§3), and re-seeds on reconnect.
 * Native look & feel via HA theme variables (§2.8).
 *
 * Selection is held as an **id**, not as the object that was clicked: a write
 * re-seeds a whole new snapshot, and a captured object would keep the sidebar
 * showing pre-save values until the user clicked the room again.
 *
 * Every view is reachable in both directions — the deep-link scopes open a view,
 * and the header nav plus the editors' close buttons lead back out. A panel you
 * can only navigate *into* needs a page reload to escape.
 *
 * This is the panel root — the one place route/panel props and the editor +
 * write layer come together (§4.2, D15): the read-only map, the WS client, the
 * types, and the layout stay card-clean; the wiring here does not.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AreaOut, EdgeOut, HealthResult, ListAnnotationsResult } from "./api/types";
import type { HomeAssistant, PanelInfo, Route } from "./ha";
import { TopologyWsClient } from "./api/ws-client";
import { TopologyStore } from "./state/store";
import { parseRoute, routeQuery, type FocusScope, type PanelView } from "./router";
import { localize } from "./i18n/localize";
import { OUTDOOR_BUCKET } from "./map/floor-map";

import "./map/floor-map";
import "./editors/area-editor";
import "./editors/edge-editor";
import "./editors/beyond-editor";
import "./editors/exterior-editor";
import "./editors/neighbors-editor";
import "./editors/floor-editor";
import "./editors/first-run";
import "./editors/home-config-editor";
import "./editors/orphans-view";

/** Sentinel for the "show every floor at once" chip. */
const ALL_FLOORS = "__all__";

@customElement("topology-panel")
export class TopologyPanel extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public narrow = false;
  @property({ attribute: false }) public route!: Route;
  @property({ attribute: false }) public panel!: PanelInfo;

  @state() private store: TopologyStore | null = null;
  @state() private view: PanelView = "map";
  @state() private focusScope: FocusScope | null = null;
  @state() private activeFloor: string | null = null;
  @state() private selectedAreaId: string | null = null;
  @state() private selectedEdgeId: string | null = null;
  @state() private toastMessage: string | null = null;

  private client: TopologyWsClient | null = null;
  private removeListener: (() => void) | null = null;

  public override connectedCallback(): void {
    super.connectedCallback();
    this.client = new TopologyWsClient(this.hass.connection);
    const store = new TopologyStore(this.client);
    this.store = store;
    this.removeListener = store.addListener(() => this.requestUpdate());
    const parsed = parseRoute(window.location.search);
    this.view = parsed.view;
    this.focusScope = parsed.focus;
    void store.connect();
    this.addEventListener("topology-toast", this.onToast as EventListener);
    this.addEventListener("area-selected", this.onAreaSelected as EventListener);
    this.addEventListener("edge-selected", this.onEdgeSelected as EventListener);
    this.addEventListener("selection-cleared", this.clearSelection);
    this.addEventListener("keydown", this.onKeyDown);
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeListener?.();
    void this.store?.dispose();
    this.removeEventListener("topology-toast", this.onToast as EventListener);
    this.removeEventListener("area-selected", this.onAreaSelected as EventListener);
    this.removeEventListener("edge-selected", this.onEdgeSelected as EventListener);
    this.removeEventListener("selection-cleared", this.clearSelection);
    this.removeEventListener("keydown", this.onKeyDown);
  }

  protected override willUpdate(changed: Map<string, unknown>): void {
    // React to the frontend connection lifecycle for the reconnect re-seed (§2.4).
    if (changed.has("hass") && this.store && this.hass) {
      this.store.handleConnectionState(this.hass.connection.connected ?? true);
    }
  }

  private onToast = (ev: CustomEvent<{ message: string }>): void => {
    this.toastMessage = ev.detail.message;
    window.setTimeout(() => {
      this.toastMessage = null;
    }, 4000);
  };

  private onAreaSelected = (ev: CustomEvent<{ area: AreaOut }>): void => {
    this.selectedAreaId = ev.detail.area.area_id;
    this.selectedEdgeId = null;
  };

  private onEdgeSelected = (ev: CustomEvent<{ edge: EdgeOut }>): void => {
    this.selectedEdgeId = ev.detail.edge.edge_id;
    this.selectedAreaId = null;
  };

  private clearSelection = (): void => {
    this.selectedAreaId = null;
    this.selectedEdgeId = null;
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape" && (this.selectedAreaId !== null || this.selectedEdgeId !== null)) {
      this.clearSelection();
    }
  };

  /** Leave any sub-view and any selection — the one way back to the default. */
  private goHome = (): void => {
    this.view = "map";
    this.focusScope = null;
    this.clearSelection();
    this.syncUrl();
  };

  /**
   * Mirror the current scope into the address bar.
   *
   * Without this the URL kept whatever `?focus=` the panel was opened with, so
   * a reload or a copied link reopened a view the user had already left, and the
   * browser's back button did nothing at all inside the panel.
   */
  private syncUrl(): void {
    const query = routeQuery(this.focusScope);
    const next = `${window.location.pathname}${query}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }

  private get snapshot(): ListAnnotationsResult | null {
    return this.store?.state.snapshot ?? null;
  }

  private get health(): HealthResult | null {
    return this.store?.state.health ?? null;
  }

  /** The selected area, re-resolved against the live snapshot (never captured). */
  private get selectedArea(): AreaOut | null {
    if (this.selectedAreaId === null) {
      return null;
    }
    return this.snapshot?.areas.find((area) => area.area_id === this.selectedAreaId) ?? null;
  }

  private get selectedEdge(): EdgeOut | null {
    if (this.selectedEdgeId === null) {
      return null;
    }
    return this.snapshot?.edges.find((edge) => edge.edge_id === this.selectedEdgeId) ?? null;
  }

  /**
   * Floor chips: "All floors", every floor in the snapshot's own order (already
   * top-down by effective level), then the outdoor/unfloored bucket.
   */
  private floorButtons(): { id: string; label: string }[] {
    const snapshot = this.snapshot;
    const buttons = [{ id: ALL_FLOORS, label: localize("panel.floor.all") }];
    for (const floor of snapshot?.floors ?? []) {
      buttons.push({
        id: floor.floor_id,
        label: this.hass.floors?.[floor.floor_id]?.name ?? floor.floor_id,
      });
    }
    buttons.push({ id: OUTDOOR_BUCKET, label: localize("panel.floor.outdoor") });
    return buttons;
  }

  protected override render() {
    const state = this.store?.state;
    return html`
      <div class="root">
        ${state && !state.connected
          ? html`<div class="banner reconnecting">${localize("banner.reconnecting")}</div>`
          : nothing}
        ${state?.error ? html`<div class="banner error">${localize("banner.error")}</div>` : nothing}
        <header>
          <h1>${localize("panel.title")}</h1>
          <nav class="views">
            <button
              class=${this.isHome() ? "active" : ""}
              @click=${this.goHome}
              title=${localize("panel.nav.back")}
            >
              ${localize("panel.nav.home")}
            </button>
            <button
              class=${this.view === "floors" ? "active" : ""}
              @click=${() => this.openView("floors")}
            >
              ${localize("panel.nav.floors")}
            </button>
            <button
              class=${this.view === "orphans" ? "active" : ""}
              @click=${() => this.openView("orphans")}
            >
              ${localize("panel.nav.orphans")}
            </button>
          </nav>
        </header>
        <nav class="floors">
          ${this.floorButtons().map(
            (floor) => html`
              <button
                class=${(this.activeFloor ?? ALL_FLOORS) === floor.id ? "active" : ""}
                @click=${() => {
                  this.activeFloor = floor.id === ALL_FLOORS ? null : floor.id;
                }}
              >
                ${floor.label}
              </button>
            `,
          )}
        </nav>
        <div class="body">
          <div class="map">${this.renderMap()}</div>
          <aside class="side">${this.renderSide()}</aside>
        </div>
        ${this.toastMessage ? html`<div class="toast" role="alert">${this.toastMessage}</div>` : nothing}
      </div>
    `;
  }

  /** True when the sidebar shows the home-configuration default. */
  private isHome(): boolean {
    return this.view === "map" && this.selectedAreaId === null && this.selectedEdgeId === null;
  }

  private openView(view: PanelView): void {
    this.view = view;
    // Keep the scope and the view in step: the floors and orphans views each own
    // a scope, so a deep-link out of the panel reproduces what is on screen.
    this.focusScope = view === "floors" ? "floors" : view === "orphans" ? "orphans" : null;
    this.clearSelection();
    this.syncUrl();
  }

  private renderMap() {
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return html`<div class="empty">…</div>`;
    }
    return html`
      <topology-floor-map
        .hass=${this.hass}
        .areas=${snapshot.areas}
        .edges=${snapshot.edges}
        .floors=${snapshot.floors}
        .health=${this.health}
        .activeFloor=${this.activeFloor}
        .focusScope=${this.focusScope}
        .selectedAreaId=${this.selectedAreaId}
        .selectedEdgeId=${this.selectedEdgeId}
      ></topology-floor-map>
    `;
  }

  private renderSide() {
    const snapshot = this.snapshot;
    if (snapshot === null || this.client === null) {
      return nothing;
    }
    const edge = this.selectedEdge;
    if (edge !== null) {
      return html`
        ${this.renderCloseBar(this.edgeTitle(edge))}
        <topology-edge-editor
          .client=${this.client}
          .hass=${this.hass}
          .edge=${edge}
          .presets=${snapshot.presets}
        ></topology-edge-editor>
      `;
    }
    const area = this.selectedArea;
    if (area !== null) {
      const flagged = (this.health?.exterior_on_non_outdoor_side ?? []).includes(area.area_id);
      return html`
        ${this.renderCloseBar(this.hass.areas?.[area.area_id]?.name ?? area.area_id)}
        <topology-area-editor
          .client=${this.client}
          .area=${area}
          .areaTypes=${snapshot.area_types}
        ></topology-area-editor>
        <topology-neighbors-editor
          .client=${this.client}
          .hass=${this.hass}
          .area=${area}
          .areas=${snapshot.areas}
          .edges=${snapshot.edges}
          .floors=${snapshot.floors}
          .presets=${snapshot.presets}
        ></topology-neighbors-editor>
        <topology-beyond-editor
          .client=${this.client}
          .hass=${this.hass}
          .area=${area}
          .edges=${snapshot.edges}
          .occupancyExtent=${snapshot.home_config.occupancy_extent}
        ></topology-beyond-editor>
        <topology-exterior-editor
          .client=${this.client}
          .hass=${this.hass}
          .area=${area}
          .presets=${snapshot.presets}
          .flagged=${flagged}
        ></topology-exterior-editor>
      `;
    }
    // No selection: the view drives the default side content.
    if (this.view === "floors") {
      return html`
        ${this.renderCloseBar(localize("panel.nav.floors"))}
        <topology-floor-editor
          .client=${this.client}
          .hass=${this.hass}
          .floors=${snapshot.floors}
          .flagged=${new Set(this.health?.indoor_areas_without_floor ?? [])}
        ></topology-floor-editor>
      `;
    }
    if (this.view === "orphans") {
      return html`
        ${this.renderCloseBar(localize("panel.nav.orphans"))}
        <topology-orphans-view
          .client=${this.client}
          .hass=${this.hass}
          .areas=${snapshot.areas}
          .edges=${snapshot.edges}
        ></topology-orphans-view>
      `;
    }
    // The first-run card replaces the flow's one-shot import opt-ins (§4.1): it
    // renders itself away once both sources are stamped or dismissed.
    return html`
      ${this.renderFlagged()}
      <topology-first-run-card
        .hass=${this.hass}
        .homeConfig=${snapshot.home_config}
      ></topology-first-run-card>
      <topology-home-config-editor
        .client=${this.client}
        .homeConfig=${snapshot.home_config}
      ></topology-home-config-editor>
    `;
  }

  /** Header of a drilled-in sidebar, with the way back out. */
  private renderCloseBar(title: string) {
    return html`
      <div class="close-bar">
        <span class="crumb">${title}</span>
        <button @click=${this.goHome} title=${localize("panel.nav.back")}>
          ${localize("action.close")}
        </button>
      </div>
    `;
  }

  private edgeTitle(edge: EdgeOut): string {
    const name = (areaId: string): string => this.hass.areas?.[areaId]?.name ?? areaId;
    return localize("editor.edge.between", { a: name(edge.area_a), b: name(edge.area_b) });
  }

  /** Render the focus-scoped flagged list beside the map (§2.5 overlay). */
  private renderFlagged() {
    if (this.focusScope === null || this.health === null) {
      return nothing;
    }
    if (this.focusScope === "geometry") {
      return this.renderFlaggedEdges();
    }
    const key =
      this.focusScope === "unannotated"
        ? "unannotated_areas"
        : this.focusScope === "isolated"
          ? "isolated_areas"
          : this.focusScope === "bearings"
            ? "contradictory_bearings"
            : this.focusScope === "exterior"
              ? "exterior_on_non_outdoor_side"
              : null;
    if (key === null) {
      return nothing;
    }
    const ids = this.health[key as keyof HealthResult] as string[];
    const title =
      this.focusScope === "unannotated"
        ? localize("sidebar.unannotated")
        : this.focusScope === "isolated"
          ? localize("sidebar.isolated")
          : this.focusScope === "bearings"
            ? localize("sidebar.bearings")
            : localize("editor.exterior.title");
    return html`
      <div class="flagged-list">
        <h3>${title}</h3>
        ${ids.length === 0
          ? html`<p>${localize("sidebar.none")}</p>`
          : html`<ul>
              ${ids.map(
                (id) => html`<li>
                  <button
                    class="link"
                    @click=${() => {
                      this.selectedAreaId = id;
                      this.selectedEdgeId = null;
                    }}
                  >
                    ${this.hass.areas?.[id]?.name ?? id}
                  </button>
                </li>`,
              )}
            </ul>`}
      </div>
    `;
  }

  /**
   * The geometry scope lists flagged *edges*, so it needs its own renderer: the
   * area list resolves ids through `hass.areas`, which would show an edge id raw.
   */
  private renderFlaggedEdges() {
    const health = this.health;
    const snapshot = this.snapshot;
    if (health === null || snapshot === null) {
      return nothing;
    }
    const groups = [
      { title: localize("sidebar.spanning"), ids: health.edges_spanning_multiple_floors ?? [] },
      {
        title: localize("sidebar.no_climb"),
        ids: health.vertical_edges_without_vertical_passage ?? [],
      },
    ];
    return html`
      <div class="flagged-list">
        ${groups.map(
          (group) => html`
            <h3>${group.title}</h3>
            ${group.ids.length === 0
              ? html`<p>${localize("sidebar.none")}</p>`
              : html`<ul>
                  ${group.ids.map((edgeId) => {
                    const edge = snapshot.edges.find((row) => row.edge_id === edgeId);
                    return html`<li>
                      <button
                        class="link"
                        @click=${() => {
                          this.selectedEdgeId = edgeId;
                          this.selectedAreaId = null;
                        }}
                      >
                        ${edge !== undefined ? this.edgeTitle(edge) : edgeId}
                      </button>
                    </li>`;
                  })}
                </ul>`}
          `,
        )}
      </div>
    `;
  }

  public static override styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--primary-background-color, #fafafa);
      color: var(--primary-text-color, #212121);
    }
    .root {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 16px;
      background: var(--app-header-background-color, var(--primary-color, #03a9f4));
      color: var(--app-header-text-color, #fff);
    }
    h1 {
      margin: 0;
      font-size: 1.2em;
    }
    nav.views {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    nav.views button {
      padding: 6px 12px;
      border: none;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.2);
      color: inherit;
      cursor: pointer;
    }
    nav.views button.active {
      background: rgba(255, 255, 255, 0.9);
      color: var(--primary-color, #03a9f4);
    }
    nav.floors {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 8px 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff);
    }
    nav.floors button {
      padding: 4px 12px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 16px;
      background: transparent;
      color: var(--primary-text-color, #212121);
      cursor: pointer;
      font-size: 0.9em;
    }
    nav.floors button.active {
      background: var(--primary-color, #03a9f4);
      border-color: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .map {
      flex: 2;
      padding: 16px;
      min-width: 0;
    }
    aside.side {
      flex: 1;
      max-width: 420px;
      overflow-y: auto;
      border-left: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff);
    }
    .close-bar {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff);
    }
    .close-bar .crumb {
      font-weight: 500;
    }
    .close-bar button {
      padding: 4px 12px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: transparent;
      color: var(--primary-text-color, #212121);
      cursor: pointer;
    }
    .banner {
      padding: 8px 16px;
      text-align: center;
      color: #fff;
    }
    .banner.reconnecting {
      background: var(--warning-color, #ff9800);
    }
    .banner.error {
      background: var(--error-color, #f44336);
    }
    .empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--secondary-text-color, #727272);
    }
    .flagged-list {
      padding: 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    .flagged-list h3 {
      margin: 0 0 8px;
    }
    .flagged-list ul {
      margin: 0;
      padding-left: 18px;
    }
    button.link {
      padding: 0;
      border: none;
      background: none;
      color: var(--primary-color, #03a9f4);
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 8px;
      background: var(--error-color, #f44336);
      color: #fff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    @media (max-width: 870px) {
      .body {
        flex-direction: column;
      }
      aside.side {
        max-width: none;
        border-left: none;
        border-top: 1px solid var(--divider-color, #e0e0e0);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-panel": TopologyPanel;
  }
}
