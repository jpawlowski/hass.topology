/**
 * Exterior-connections editor (Phase 7 §2.6). Reads `area_out.exterior_connections`,
 * writes `topology/set_exterior_connections` as a full-list replace (windows /
 * outside doors). `inline_trust` is allowed here and only here. No hard reject on
 * a non-outdoor side — the consistency overlay flags it instead (matches
 * Phase-2 §4.7). Panel-only.
 *
 * Only exterior-scoped presets are offered. The list used to include every
 * preset, so `interior_door`, `lift` and `shared_wall` were on offer as
 * "windows / outside doors"; the scope now comes from the shipped table.
 *
 * Each opening also needs its `side`: both derivations that give an exterior
 * opening meaning (`connections_facing_outdoor` and the
 * `exterior_on_non_outdoor_side` check) skip an opening whose side is unset, so
 * a sideless one is stored but inert. The editor therefore says so rather than
 * quietly accepting it.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AreaOut, ConnectionOut, PresetOut } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { expandPreset } from "./preset";
import { enumLabel, localize } from "../i18n/localize";
import { toast } from "./toast";

import "./connection-fields";

@customElement("topology-exterior-editor")
export class TopologyExteriorEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public area!: AreaOut;
  @property({ attribute: false }) public presets: PresetOut[] = [];
  @property({ attribute: false }) public flagged = false;

  @state() private connections: ConnectionOut[] = [];

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("area") && this.area) {
      this.connections = this.area.exterior_connections.map((connection) => ({ ...connection }));
    }
  }

  private get exteriorPresets(): PresetOut[] {
    return this.presets.filter((preset) => preset.scope === "exterior");
  }

  private addConnection(): void {
    const exterior = this.exteriorPresets;
    const first = exterior.find((preset) => preset.preset_name === "window") ?? exterior[0];
    const connection: ConnectionOut =
      first !== undefined
        ? (expandPreset(this.presets, first.preset_name) as ConnectionOut)
        : { passage: "none", barrier: "door" };
    this.connections = [...this.connections, connection];
  }

  private replaceConnection(index: number, connection: ConnectionOut): void {
    const next = [...this.connections];
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

  /** Sides the user declared as outer walls — where an opening can sit. */
  private declaredSides(): string[] {
    return Object.keys(this.area.beyond);
  }

  protected override render() {
    const sidelessCount = this.connections.filter((connection) => connection.side === undefined).length;
    return html`
      <div class="editor ${this.flagged ? "flagged" : ""}">
        <h3>${localize("editor.exterior.title")}</h3>
        <p class="hint">${localize("editor.exterior.hint")}</p>
        ${this.connections.length === 0
          ? html`<p class="empty">${localize("editor.exterior.none")}</p>`
          : nothing}
        ${this.connections.map(
          (connection, index) => html`
            <div class="connection">
              <topology-connection-fields
                .hass=${this.hass}
                .connection=${connection}
                .presets=${this.presets}
                .scope=${"exterior"}
                .allowInlineTrust=${true}
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
        ${sidelessCount > 0 ? html`<p class="warn">${localize("editor.exterior.sideless")}</p>` : nothing}
        ${this.declaredSides().length > 0
          ? html`<p class="hint">
              ${localize("editor.exterior.outer_sides", {
                sides: this.declaredSides()
                  .map((side) => enumLabel("side", side))
                  .join(", "),
              })}
            </p>`
          : nothing}
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
      gap: 8px;
      padding: 16px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
      color: var(--primary-text-color, #212121);
      border-radius: 8px;
    }
    .editor.flagged {
      outline: 2px solid var(--error-color, #f44336);
    }
    h3 {
      margin: 0;
    }
    .hint,
    .empty {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .warn {
      margin: 0;
      color: var(--warning-color, #ff9800);
      font-size: 0.78em;
      line-height: 1.4;
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
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-exterior-editor": TopologyExteriorEditor;
  }
}
