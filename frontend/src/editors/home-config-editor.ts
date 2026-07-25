/**
 * Home-config editor (Phase 7 §2.6). Reads `home_config`, writes
 * `topology/update_home_config` — `occupancy_extent`, projection toggles, and
 * `unannotated_repair_threshold`, edited without the reconfigure flow (§4.9).
 * This is the Phase-7 config surface (`config_panel_domain` routes "Configure"
 * here); the flow itself is not slimmed in Phase 7 (D14). Panel-only.
 */

import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import type { HomeConfigOut, OccupancyExtent } from "../api/types";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { enumLabel, localize } from "../i18n/localize";
import { toast } from "./toast";

const OCCUPANCY: OccupancyExtent[] = ["whole_property", "unit_within_building"];

@customElement("topology-home-config-editor")
export class TopologyHomeConfigEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public homeConfig!: HomeConfigOut;

  @state() private occupancy: OccupancyExtent = "whole_property";
  @state() private threshold = 3;
  @state() private projectEnvironment = false;
  @state() private projectType = false;
  @state() private projectTrust = false;

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("homeConfig") && this.homeConfig) {
      this.occupancy = this.homeConfig.occupancy_extent;
      this.threshold = this.homeConfig.unannotated_repair_threshold;
      this.projectEnvironment = this.homeConfig.projection_toggles.environment;
      this.projectType = this.homeConfig.projection_toggles.type;
      this.projectTrust = this.homeConfig.projection_toggles.trust;
    }
  }

  private async save(): Promise<void> {
    try {
      await this.client.updateHomeConfig({
        occupancy_extent: this.occupancy,
        unannotated_repair_threshold: this.threshold,
        projection_toggles: {
          environment: this.projectEnvironment,
          type: this.projectType,
          trust: this.projectTrust,
        },
      });
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  protected override render() {
    return html`
      <div class="editor">
        <h3>${localize("editor.home.title")}</h3>
        <label>
          ${localize("editor.home.occupancy")}
          <select
            .value=${live(this.occupancy)}
            @change=${(ev: Event) => {
              this.occupancy = (ev.target as HTMLSelectElement).value as OccupancyExtent;
            }}
          >
            ${OCCUPANCY.map(
              (value) => html`
                <option value=${value} .selected=${this.occupancy === value}>
                  ${enumLabel("occupancy", value)}
                </option>
              `,
            )}
          </select>
        </label>
        <p class="hint">${localize("editor.home.occupancy.hint")}</p>
        <label>
          ${localize("editor.home.threshold")}
          <input
            type="number"
            min="1"
            max="100"
            .value=${live(String(this.threshold))}
            @change=${(ev: Event) => {
              this.threshold = Number.parseInt((ev.target as HTMLInputElement).value, 10) || 1;
            }}
          />
        </label>
        <p class="hint">${localize("editor.home.threshold.hint")}</p>
        <h4>${localize("editor.home.projection")}</h4>
        <p class="hint">${localize("editor.home.projection.hint")}</p>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${live(this.projectEnvironment)}
            @change=${(ev: Event) => {
              this.projectEnvironment = (ev.target as HTMLInputElement).checked;
            }}
          />
          ${localize("editor.home.project_environment")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${live(this.projectType)}
            @change=${(ev: Event) => {
              this.projectType = (ev.target as HTMLInputElement).checked;
            }}
          />
          ${localize("editor.home.project_type")}
        </label>
        <label class="checkbox">
          <input
            type="checkbox"
            .checked=${live(this.projectTrust)}
            @change=${(ev: Event) => {
              this.projectTrust = (ev.target as HTMLInputElement).checked;
            }}
          />
          ${localize("editor.home.project_trust")}
        </label>
        <div class="actions">
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
    h4 {
      margin: 8px 0 0;
    }
    .hint {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
    }
    label.checkbox {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    select,
    input[type="number"] {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    button.primary {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-home-config-editor": TopologyHomeConfigEditor;
  }
}
