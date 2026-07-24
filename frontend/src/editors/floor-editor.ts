/**
 * Floor-level editor (Phase 7 §2.6). Reads `floors[]`, writes
 * `topology/set_floor_level`. An override is offered only where the registry
 * level is `None`; the row always shows the `effective_level` so the user sees
 * which value wins (registry level always dominates). Panel-only.
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { FloorOut } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { localize } from "../i18n/localize";
import { toast } from "./toast";

@customElement("topology-floor-editor")
export class TopologyFloorEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public floors: FloorOut[] = [];
  @property({ attribute: false }) public flagged: Set<string> = new Set();

  private floorName(floorId: string): string {
    return this.hass?.floors?.[floorId]?.name ?? floorId;
  }

  private async setLevel(floor: FloorOut, raw: string): Promise<void> {
    const level = raw.trim() === "" ? null : Number.parseInt(raw, 10);
    if (level !== null && Number.isNaN(level)) {
      return;
    }
    try {
      await this.client.setFloorLevel(floor.floor_id, level);
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  protected override render() {
    return html`
      <div class="editor">
        <h3>${localize("editor.floor.title")}</h3>
        ${this.floors.map(
          (floor) => html`
            <div class="row ${this.flagged.has(floor.floor_id) ? "flagged" : ""}">
              <span class="name">${this.floorName(floor.floor_id)}</span>
              ${floor.registry_level === null
                ? html`
                    <label>
                      ${localize("editor.floor.override")}
                      <input
                        type="number"
                        .value=${floor.level_override === null ? "" : String(floor.level_override)}
                        @change=${(ev: Event) =>
                          this.setLevel(floor, (ev.target as HTMLInputElement).value)}
                      />
                    </label>
                  `
                : html`<span class="registry">${floor.registry_level}</span>`}
              <span class="effective">
                ${localize("editor.floor.effective")}:
                ${floor.effective_level === null ? "—" : floor.effective_level}
              </span>
            </div>
          `,
        )}
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
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px;
      border-radius: 6px;
    }
    .row.flagged {
      outline: 2px solid var(--error-color, #f44336);
    }
    .name {
      flex: 1;
      font-weight: 500;
    }
    label {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
    }
    input {
      width: 64px;
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .effective,
    .registry {
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-floor-editor": TopologyFloorEditor;
  }
}
