/**
 * Area annotation editor (Phase 7 §2.6). Reads an `area_out`, writes
 * `topology/update_area`.
 *
 * `type` is a real select over the server-shipped catalog plus an explicit
 * "custom type" escape hatch, not a free-text datalist input: a datalist filters
 * its own suggestions by what is already typed, so after picking `bedroom` the
 * other twelve options were unreachable without clearing the field first.
 *
 * Picking a type pre-fills `environment`/`trust` from the shipped cascade. That
 * is *all* a type does — nothing derives from it — so the hint says so, and the
 * cascade never overwrites a value the user has already chosen.
 *
 * Every `<option>` carries its own `.selected` binding rather than relying on
 * `.value` on the `<select>`. Lit commits the select's own parts before the child
 * parts that create the options, so a `.value` binding lands on an option-less
 * element and is dropped — which is why stored values used to render blank on the
 * first open. `live()` stays on the select to keep later renders honest.
 *
 * Panel-only (write layer, §4.2). Errors surface as a `topology-toast` event.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import type { AreaOut, AreaTypesOut, Environment, Trust } from "../api/types";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { enumLabel, localize } from "../i18n/localize";
import { toast } from "./toast";

const ENVIRONMENTS: Environment[] = ["indoor", "outdoor", "semi_outdoor"];
const TRUSTS: Trust[] = ["private", "shared", "public"];

/** Sentinel option value that reveals the free-text field for an off-catalog type. */
const CUSTOM = "__custom__";

@customElement("topology-area-editor")
export class TopologyAreaEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public area!: AreaOut;
  /** Catalog + cascade as shipped by `list_annotations` (never hardcoded here). */
  @property({ attribute: false }) public areaTypes: AreaTypesOut = { catalog: [], cascade: {} };

  @state() private type = "";
  @state() private environment: Environment | "" = "";
  @state() private trust: Trust | "" = "";
  @state() private custom = false;

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("area") && this.area) {
      this.type = this.area.type ?? "";
      this.environment = this.area.environment ?? "";
      this.trust = this.area.trust ?? "";
      this.custom = this.type !== "" && !this.areaTypes.catalog.includes(this.type);
    }
  }

  private get dirty(): boolean {
    return (
      this.type !== (this.area.type ?? "") ||
      this.environment !== (this.area.environment ?? "") ||
      this.trust !== (this.area.trust ?? "")
    );
  }

  private onTypeSelect(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    if (value === CUSTOM) {
      this.custom = true;
      this.type = "";
      return;
    }
    this.custom = false;
    this.applyType(value);
  }

  private onCustomInput(ev: Event): void {
    // A custom type is outside the catalog by definition, so it cascades nothing.
    this.type = (ev.target as HTMLInputElement).value;
  }

  /** Set the type and pre-fill the dimensions it suggests, without clobbering. */
  private applyType(value: string): void {
    this.type = value;
    const cascade = this.areaTypes.cascade[value];
    if (cascade === undefined) {
      return;
    }
    if (cascade.environment !== null && this.environment === "") {
      this.environment = cascade.environment;
    }
    if (cascade.trust !== null && this.trust === "") {
      this.trust = cascade.trust;
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
          <select .value=${live(this.custom ? CUSTOM : this.type)} @change=${this.onTypeSelect}>
            <option value="" .selected=${!this.custom && this.type === ""}></option>
            ${this.areaTypes.catalog.map(
              (type) => html`
                <option value=${type} .selected=${!this.custom && this.type === type}>
                  ${enumLabel("type", type)}
                </option>
              `,
            )}
            <option value=${CUSTOM} .selected=${this.custom}>
              ${localize("editor.area.type.custom")}
            </option>
          </select>
        </label>
        ${this.custom
          ? html`<label>
              ${localize("editor.area.type.custom_label")}
              <input .value=${live(this.type)} @input=${this.onCustomInput} />
            </label>`
          : nothing}
        <p class="hint">${localize("editor.area.type.hint")}</p>
        <label>
          ${localize("editor.area.environment")}
          <select
            .value=${live(this.environment)}
            @change=${(ev: Event) => {
              this.environment = (ev.target as HTMLSelectElement).value as Environment | "";
            }}
          >
            <option value="" .selected=${this.environment === ""}></option>
            ${ENVIRONMENTS.map(
              (env) => html`
                <option value=${env} .selected=${this.environment === env}>
                  ${enumLabel("environment", env)}
                </option>
              `,
            )}
          </select>
        </label>
        <p class="hint">${localize("editor.area.environment.hint")}</p>
        <label>
          ${localize("editor.area.trust")}
          <select
            .value=${live(this.trust)}
            @change=${(ev: Event) => {
              this.trust = (ev.target as HTMLSelectElement).value as Trust | "";
            }}
          >
            <option value="" .selected=${this.trust === ""}></option>
            ${TRUSTS.map(
              (trust) => html`
                <option value=${trust} .selected=${this.trust === trust}>
                  ${enumLabel("trust", trust)}
                </option>
              `,
            )}
          </select>
        </label>
        <p class="hint">${localize("editor.area.trust.hint")}</p>
        ${this.area.orphaned_at ? html`<p class="orphan">${localize("map.orphaned")}</p>` : nothing}
        <div class="actions">
          ${this.dirty ? html`<span class="dirty">${localize("editor.area.unsaved")}</span>` : nothing}
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
    }
    h3 {
      margin: 0 0 4px;
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
    .hint {
      margin: 0 0 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .orphan {
      color: var(--error-color, #f44336);
    }
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 4px;
    }
    .dirty {
      color: var(--warning-color, #ff9800);
      font-size: 0.85em;
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
