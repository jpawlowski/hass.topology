/**
 * `<topology-panel>` — the admin sidebar panel element (Phase 7 §2). HA sets
 * `hass` / `narrow` / `route` / `panel` on this element (A.5); it constructs the
 * frozen-v1 WS client + the client store, renders the per-floor 2D map beside a
 * contextual editor, resolves the `?focus=` deep-link (§2.2/§3), and re-seeds on
 * reconnect. Native look & feel via HA theme variables (§2.8).
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
import { parseRoute, type FocusScope, type PanelView } from "./router";
import { localize } from "./i18n/localize";
import { OUTDOOR_BUCKET } from "./map/floor-map";

import "./map/floor-map";
import "./editors/area-editor";
import "./editors/edge-editor";
import "./editors/beyond-editor";
import "./editors/exterior-editor";
import "./editors/floor-editor";
import "./editors/home-config-editor";
import "./editors/orphans-view";

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
  @state() private selectedArea: AreaOut | null = null;
  @state() private selectedEdge: EdgeOut | null = null;
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
  }

  public override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeListener?.();
    void this.store?.dispose();
    this.removeEventListener("topology-toast", this.onToast as EventListener);
    this.removeEventListener("area-selected", this.onAreaSelected as EventListener);
    this.removeEventListener("edge-selected", this.onEdgeSelected as EventListener);
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
    this.selectedArea = ev.detail.area;
    this.selectedEdge = null;
  };

  private onEdgeSelected = (ev: CustomEvent<{ edge: EdgeOut }>): void => {
    this.selectedEdge = ev.detail.edge;
    this.selectedArea = null;
  };

  private get snapshot(): ListAnnotationsResult | null {
    return this.store?.state.snapshot ?? null;
  }

  private get health(): HealthResult | null {
    return this.store?.state.health ?? null;
  }

  /** Floor ids present in the snapshot plus the outdoor/unfloored bucket. */
  private floorButtons(): { id: string; label: string }[] {
    const snapshot = this.snapshot;
    const buttons = (snapshot?.floors ?? []).map((floor) => ({
      id: floor.floor_id,
      label: this.hass.floors?.[floor.floor_id]?.name ?? floor.floor_id,
    }));
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
        ${state?.error
          ? html`<div class="banner error">${localize("banner.error")}</div>`
          : nothing}
        <header>
          <h1>${localize("panel.title")}</h1>
          <nav class="floors">
            ${this.floorButtons().map(
              (floor) => html`
                <button
                  class=${this.activeFloor === floor.id ? "active" : ""}
                  @click=${() => {
                    this.activeFloor = floor.id;
                  }}
                >
                  ${floor.label}
                </button>
              `,
            )}
          </nav>
        </header>
        <div class="body">
          <div class="map">${this.renderMap()}</div>
          <aside class="side">${this.renderSide()}</aside>
        </div>
        ${this.toastMessage
          ? html`<div class="toast" role="alert">${this.toastMessage}</div>`
          : nothing}
      </div>
    `;
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
      ></topology-floor-map>
    `;
  }

  private renderSide() {
    const snapshot = this.snapshot;
    if (snapshot === null || this.client === null) {
      return nothing;
    }
    if (this.selectedEdge !== null) {
      return html`
        <topology-edge-editor
          .client=${this.client}
          .edge=${this.selectedEdge}
          .presets=${snapshot.presets}
        ></topology-edge-editor>
      `;
    }
    if (this.selectedArea !== null) {
      const flagged =
        this.focusScope === "exterior" &&
        (this.health?.exterior_on_non_outdoor_side ?? []).includes(this.selectedArea.area_id);
      return html`
        <topology-area-editor .client=${this.client} .area=${this.selectedArea}></topology-area-editor>
        <topology-beyond-editor
          .client=${this.client}
          .area=${this.selectedArea}
        ></topology-beyond-editor>
        <topology-exterior-editor
          .client=${this.client}
          .area=${this.selectedArea}
          .presets=${snapshot.presets}
          .flagged=${flagged}
        ></topology-exterior-editor>
      `;
    }
    // No selection: the focus/view drives the default side content.
    if (this.view === "floors") {
      return html`
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
        <topology-orphans-view
          .client=${this.client}
          .hass=${this.hass}
          .areas=${snapshot.areas}
          .edges=${snapshot.edges}
        ></topology-orphans-view>
      `;
    }
    return html`
      ${this.renderFlagged()}
      <topology-home-config-editor
        .client=${this.client}
        .homeConfig=${snapshot.home_config}
      ></topology-home-config-editor>
    `;
  }

  /** Render the focus-scoped flagged list beside the map (§2.5 overlay). */
  private renderFlagged() {
    if (this.focusScope === null || this.health === null) {
      return nothing;
    }
    const key =
      this.focusScope === "unannotated"
        ? "unannotated_areas"
        : this.focusScope === "isolated"
          ? "isolated_areas"
          : this.focusScope === "bearings"
            ? "contradictory_bearings"
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
          : localize("sidebar.bearings");
    return html`
      <div class="flagged-list">
        <h3>${title}</h3>
        ${ids.length === 0
          ? html`<p>${localize("sidebar.none")}</p>`
          : html`<ul>
              ${ids.map((id) => html`<li>${this.hass.areas?.[id]?.name ?? id}</li>`)}
            </ul>`}
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
    nav.floors {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    nav.floors button {
      padding: 6px 12px;
      border: none;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.2);
      color: inherit;
      cursor: pointer;
    }
    nav.floors button.active {
      background: rgba(255, 255, 255, 0.9);
      color: var(--primary-color, #03a9f4);
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
