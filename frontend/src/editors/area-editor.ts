/**
 * Area annotation editor (Phase 7 §2.6). Reads an `area_out`, writes
 * `topology/update_area`. `type` is an open catalog; picking a catalog type
 * pre-fills `environment`/`trust` as editable defaults (the type-cascade,
 * mirroring the service/import cascade — pre-filled, never forced).
 *
 * Panel-only (write layer, §4.2). Errors surface as a `topology-toast` event.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { AreaOut, Environment, Trust } from "../api/types";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { localize } from "../i18n/localize";
import { toast } from "./toast";

/** Shipped area-type catalog (`data.AREA_TYPE_CATALOG`). */
const TYPE_CATALOG = [
  "bedroom",
  "living",
  "kitchen",
  "dining",
  "bathroom",
  "hallway",
  "office",
  "utility",
  "storage",
  "garage",
  "balcony",
  "terrace",
  "outdoor",
];

/** Type-cascade defaults (`data.TYPE_CASCADE`): editable, not forced. */
const TYPE_CASCADE: Record<string, { environment: Environment | null; trust: Trust | null }> = {
  bedroom: { environment: "indoor", trust: "private" },
  living: { environment: "indoor", trust: "private" },
  kitchen: { environment: "indoor", trust: "private" },
  dining: { environment: "indoor", trust: "private" },
  bathroom: { environment: "indoor", trust: "private" },
  hallway: { environment: "indoor", trust: "shared" },
  office: { environment: "indoor", trust: "private" },
  utility: { environment: "indoor", trust: "private" },
  storage: { environment: "indoor", trust: "private" },
  garage: { environment: "indoor", trust: "private" },
  balcony: { environment: "semi_outdoor", trust: null },
  terrace: { environment: "outdoor", trust: null },
  outdoor: { environment: "outdoor", trust: null },
};

const ENVIRONMENTS: Environment[] = ["indoor", "outdoor", "semi_outdoor"];
const TRUSTS: Trust[] = ["private", "shared", "public"];

@customElement("topology-area-editor")
export class TopologyAreaEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public area!: AreaOut;

  @state() private type = "";
  @state() private environment: Environment | "" = "";
  @state() private trust: Trust | "" = "";

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("area") && this.area) {
      this.type = this.area.type ?? "";
      this.environment = this.area.environment ?? "";
      this.trust = this.area.trust ?? "";
    }
  }

  private onType(ev: Event): void {
    const value = (ev.target as HTMLInputElement).value;
    this.type = value;
    // Type-cascade: pre-fill environment/trust as editable defaults (§2.6).
    const cascade = TYPE_CASCADE[value];
    if (cascade) {
      if (cascade.environment) {
        this.environment = cascade.environment;
      }
      if (cascade.trust) {
        this.trust = cascade.trust;
      }
    }
  }

  private async save(): Promise<void> {
    try {
      await this.client.updateArea(this.area.area_id, {
        type: this.type === "" ? null : this.type,
        environment: this.environment === "" ? null : this.environment,
        trust: this.trust === "" ? null : this.trust,
      });
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  protected override render() {
    return html`
      <div class="editor">
        <h3>${localize("editor.area.title")}</h3>
        <label>
          ${localize("editor.area.type")}
          <input
            list="topology-type-catalog"
            .value=${this.type}
            @change=${this.onType}
          />
          <datalist id="topology-type-catalog">
            ${TYPE_CATALOG.map((type) => html`<option value=${type}></option>`)}
          </datalist>
        </label>
        <label>
          ${localize("editor.area.environment")}
          <select
            .value=${this.environment}
            @change=${(ev: Event) => {
              this.environment = (ev.target as HTMLSelectElement).value as Environment | "";
            }}
          >
            <option value=""></option>
            ${ENVIRONMENTS.map((env) => html`<option value=${env}>${env}</option>`)}
          </select>
        </label>
        <label>
          ${localize("editor.area.trust")}
          <select
            .value=${this.trust}
            @change=${(ev: Event) => {
              this.trust = (ev.target as HTMLSelectElement).value as Trust | "";
            }}
          >
            <option value=""></option>
            ${TRUSTS.map((trust) => html`<option value=${trust}>${trust}</option>`)}
          </select>
        </label>
        ${this.area.orphaned_at ? html`<p class="orphan">${localize("map.orphaned")}</p>` : nothing}
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
    }
    h3 {
      margin: 0;
      color: var(--primary-text-color, #212121);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
    input,
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .orphan {
      color: var(--error-color, #f44336);
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
    "topology-area-editor": TopologyAreaEditor;
  }
}
