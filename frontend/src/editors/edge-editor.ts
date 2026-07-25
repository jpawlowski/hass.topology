/**
 * Edge / connection editor (Phase 7 §2.6). Reads an `edge_out` + the shipped
 * `presets` table, writes `topology/upsert_edge` / `topology/delete_edge`. The
 * preset picker expands to `passage`+`barrier` via the server table (never a
 * hardcoded map); multi-connection bundles (stair + lift) are editable.
 *
 * The per-connection detail — side, glazing, the bound open/close sensor,
 * perimeter override — lives in `<topology-connection-fields>`, shared with the
 * exterior editor. Without the sensor field the perimeter binary sensor had
 * nothing to observe and could never leave `off`.
 *
 * Panel-only (write layer, §4.2).
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ConnectionOut, EdgeOut, PresetOut } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { expandPreset } from "./preset";
import { localize } from "../i18n/localize";
import { toast } from "./toast";

import "./connection-fields";

@customElement("topology-edge-editor")
export class TopologyEdgeEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public edge!: EdgeOut;
  @property({ attribute: false }) public presets: PresetOut[] = [];

  @state() private connections: ConnectionOut[] = [];

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("edge") && this.edge) {
      this.connections = this.edge.connections.map((connection) => ({ ...connection }));
    }
  }

  private replaceConnection(index: number, connection: ConnectionOut): void {
    const next = [...this.connections];
    next[index] = connection;
    this.connections = next;
  }

  private addConnection(): void {
    const interior = this.presets.filter((preset) => preset.scope === "interior");
    const first = interior[0];
    const connection: ConnectionOut =
      first !== undefined
        ? (expandPreset(this.presets, first.preset_name) as ConnectionOut)
        : { passage: "level", barrier: "open" };
    this.connections = [...this.connections, connection];
  }

  private removeConnection(index: number): void {
    this.connections = this.connections.filter((_, i) => i !== index);
  }

  private async save(): Promise<void> {
    if (this.connections.length === 0) {
      // An interior edge must carry a non-empty bundle; empty means delete.
      await this.deleteEdge();
      return;
    }
    try {
      await this.client.upsertEdge(this.edge.area_a, this.edge.area_b, this.connections);
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  private async deleteEdge(): Promise<void> {
    try {
      await this.client.deleteEdge(this.edge.edge_id);
      // The edge is gone, so nothing can re-resolve the selection to it.
      this.dispatchEvent(new CustomEvent("selection-cleared", { bubbles: true, composed: true }));
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  private areaName(areaId: string): string {
    return this.hass?.areas?.[areaId]?.name ?? areaId;
  }

  /** How the two ends sit relative to each other, in words. */
  private axisSummary(): string {
    const edge = this.edge;
    if (edge.axis === "unknown" || edge.level_delta === null) {
      return localize("editor.edge.axis.unknown");
    }
    if (edge.level_delta === 0) {
      return localize("editor.edge.axis.horizontal");
    }
    const key = edge.level_delta > 0 ? "editor.edge.axis.vertical_up" : "editor.edge.axis.vertical_down";
    return localize(key, {
      a: this.areaName(edge.area_a),
      b: this.areaName(edge.area_b),
      levels: Math.abs(edge.level_delta),
    });
  }

  protected override render() {
    return html`
      <div class="editor">
        <h3>${localize("editor.edge.title")}</h3>
        <p class="axis">${this.axisSummary()}</p>
        <p class="hint">${localize("editor.edge.hint")}</p>
        ${this.connections.map(
          (connection, index) => html`
            <div class="connection">
              <topology-connection-fields
                .hass=${this.hass}
                .connection=${connection}
                .presets=${this.presets}
                .scope=${"interior"}
                .allowOverride=${true}
                @connection-changed=${(ev: CustomEvent<{ connection: ConnectionOut }>) => {
                  ev.stopPropagation();
                  this.replaceConnection(index, ev.detail.connection);
                }}
              ></topology-connection-fields>
              <button class="remove" @click=${() => this.removeConnection(index)}>
                ${localize("action.remove")}
              </button>
            </div>
          `,
        )}
        ${this.connections.length === 0
          ? html`<p class="warn">${localize("editor.edge.delete")}</p>`
          : nothing}
        <div class="actions">
          <button @click=${this.addConnection}>${localize("editor.edge.add")}</button>
          <button class="danger" @click=${this.deleteEdge}>${localize("editor.edge.delete")}</button>
          <button class="primary" @click=${this.save}>${localize("action.save")}</button>
        </div>
      </div>
    `;
  }

  public static override styles = css`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .axis {
      margin: 0;
      font-size: 0.85em;
    }
    .hint,
    .warn {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .warn {
      color: var(--warning-color, #ff9800);
    }
    .connection {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px;
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 8px;
    }
    .remove {
      align-self: flex-end;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }
    button {
      padding: 6px 14px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
      cursor: pointer;
    }
    button.primary {
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      border: none;
    }
    button.danger {
      color: var(--error-color, #f44336);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-edge-editor": TopologyEdgeEditor;
  }
}
