/**
 * Exterior-connections editor (Phase 7 §2.6). Reads `area_out.exterior_connections`,
 * writes `topology/set_exterior_connections` as a full-list replace (windows /
 * outside doors). `inline_trust` is allowed here and only here. No hard reject on
 * a non-outdoor side — the consistency overlay flags it instead (matches
 * Phase-2 §4.7). Panel-only.
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AreaOut, ConnectionOut, PresetOut, Trust } from "../api/types";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { expandPreset } from "./preset";
import { localize } from "../i18n/localize";
import { toast } from "./toast";

const TRUSTS: Trust[] = ["private", "shared", "public"];

@customElement("topology-exterior-editor")
export class TopologyExteriorEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public area!: AreaOut;
  @property({ attribute: false }) public presets: PresetOut[] = [];
  @property({ attribute: false }) public flagged = false;

  @state() private connections: ConnectionOut[] = [];

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("area") && this.area) {
      this.connections = this.area.exterior_connections.map((connection) => ({ ...connection }));
    }
  }

  private addConnection(): void {
    const first = this.presets.find((preset) => preset.preset_name === "window") ?? this.presets[0];
    const connection: ConnectionOut =
      first !== undefined
        ? (expandPreset(this.presets, first.preset_name) as ConnectionOut)
        : { passage: "none", barrier: "door" };
    this.connections = [...this.connections, connection];
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

  private setInlineTrust(index: number, value: string): void {
    const next = [...this.connections];
    const connection = { ...next[index] };
    if (value === "") {
      delete connection.inline_trust;
    } else {
      connection.inline_trust = value as Trust;
    }
    next[index] = connection;
    this.connections = next;
  }

  private removeConnection(index: number): void {
    this.connections = this.connections.filter((_, i) => i !== index);
  }

  private async save(): Promise<void> {
    try {
      await this.client.setExteriorConnections(this.area.area_id, this.connections);
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  protected override render() {
    return html`
      <div class="editor ${this.flagged ? "flagged" : ""}">
        <h3>${localize("editor.exterior.title")}</h3>
        ${this.connections.map(
          (connection, index) => html`
            <div class="connection">
              <select
                .value=${connection.preset_name ?? ""}
                @change=${(ev: Event) =>
                  this.applyPreset(index, (ev.target as HTMLSelectElement).value)}
              >
                <option value=""></option>
                ${this.presets.map(
                  (preset) => html`<option value=${preset.preset_name}>${preset.preset_name}</option>`,
                )}
              </select>
              <select
                .value=${connection.inline_trust ?? ""}
                @change=${(ev: Event) =>
                  this.setInlineTrust(index, (ev.target as HTMLSelectElement).value)}
              >
                <option value="">${localize("editor.area.trust")}</option>
                ${TRUSTS.map((trust) => html`<option value=${trust}>${trust}</option>`)}
              </select>
              <button @click=${() => this.removeConnection(index)}>×</button>
            </div>
          `,
        )}
        <div class="actions">
          <button @click=${this.addConnection}>${localize("editor.edge.add")}</button>
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
      border-radius: 8px;
    }
    .editor.flagged {
      outline: 2px solid var(--error-color, #f44336);
    }
    h3 {
      margin: 0;
    }
    .connection {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
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
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-exterior-editor": TopologyExteriorEditor;
  }
}
