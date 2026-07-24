/**
 * Edge / connection editor (Phase 7 §2.6). Reads an `edge_out` + the shipped
 * `presets` table, writes `topology/upsert_edge` / `topology/delete_edge`. The
 * preset picker expands to `passage`+`barrier` via the server table (never a
 * hardcoded map); multi-connection bundles (stair + lift) are editable.
 *
 * Panel-only (write layer, §4.2).
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { ConnectionOut, EdgeOut, PresetOut } from "../api/types";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { expandPreset } from "./preset";
import { localize } from "../i18n/localize";
import { toast } from "./toast";

@customElement("topology-edge-editor")
export class TopologyEdgeEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public edge!: EdgeOut;
  @property({ attribute: false }) public presets: PresetOut[] = [];

  @state() private connections: ConnectionOut[] = [];

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("edge") && this.edge) {
      this.connections = this.edge.connections.map((connection) => ({ ...connection }));
    }
  }

  private applyPreset(index: number, presetName: string): void {
    const expanded = expandPreset(this.presets, presetName);
    if (expanded === null) {
      return;
    }
    const next = [...this.connections];
    next[index] = { ...next[index], ...expanded };
    this.connections = next;
  }

  private addConnection(): void {
    const first = this.presets[0];
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
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  protected override render() {
    return html`
      <div class="editor">
        <h3>${localize("editor.edge.title")}</h3>
        ${this.connections.map(
          (connection, index) => html`
            <div class="connection">
              <label>
                ${localize("editor.edge.preset")}
                <select
                  .value=${connection.preset_name ?? ""}
                  @change=${(ev: Event) =>
                    this.applyPreset(index, (ev.target as HTMLSelectElement).value)}
                >
                  <option value=""></option>
                  ${this.presets.map(
                    (preset) =>
                      html`<option value=${preset.preset_name}>${preset.preset_name}</option>`,
                  )}
                </select>
              </label>
              <span class="axes">${connection.passage} / ${connection.barrier}</span>
              <button @click=${() => this.removeConnection(index)}>×</button>
            </div>
          `,
        )}
        <div class="actions">
          <button @click=${this.addConnection}>${localize("editor.edge.add")}</button>
          <button class="danger" @click=${this.deleteEdge}>
            ${localize("editor.edge.delete")}
          </button>
          <button class="primary" @click=${this.save}>${localize("action.save")}</button>
        </div>
      </div>
    `;
  }

  public static override styles = css`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .connection {
      display: flex;
      align-items: flex-end;
      gap: 8px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .axes {
      font-family: var(--code-font-family, monospace);
      color: var(--secondary-text-color, #727272);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    button {
      padding: 8px 16px;
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
