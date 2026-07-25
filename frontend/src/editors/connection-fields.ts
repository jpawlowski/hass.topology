/**
 * `<topology-connection-fields>` — the editable detail of a single connection,
 * shared by the interior-edge and exterior-opening editors (Phase 7 §2.6).
 *
 * These fields exist in the model and are what make a connection *mean*
 * something, but no editor offered them before, which left the panel able to
 * create only inert data: an exterior opening without a `side` is skipped by both
 * derivations that consume openings, and a door without a bound
 * `sensor_entity_id` can never move the perimeter binary sensor off `off`.
 *
 * The preset picker is filtered by `scope` from the server-shipped table — an
 * interior door and an outside door expand to the same passage/barrier, so the
 * client cannot tell them apart on its own and must not guess.
 *
 * Panel-only (write layer, §4.2). Emits `connection-changed` with the updated
 * connection; the owning editor decides when to persist.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import type { CardinalSide, ConnectionOut, PresetOut, PresetScope } from "../api/types";
import type { HomeAssistant } from "../ha";
import { enumLabel, localize } from "../i18n/localize";
import { expandPreset, presetAllowsSensor } from "./preset";

const SIDES: CardinalSide[] = ["N", "E", "S", "W"];

/** Device classes that plausibly report an opening, offered first in the picker. */
const OPENING_CLASSES = new Set(["door", "garage_door", "window", "opening"]);

@customElement("topology-connection-fields")
export class TopologyConnectionFields extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public connection!: ConnectionOut;
  @property({ attribute: false }) public presets: PresetOut[] = [];
  /** Which presets to offer: interior edges vs exterior openings. */
  @property({ attribute: false }) public scope: PresetScope = "interior";
  /** Exterior openings may carry `inline_trust`; interior edges may not. */
  @property({ attribute: false }) public allowInlineTrust = false;
  /** Interior edges may force perimeter membership. */
  @property({ attribute: false }) public allowOverride = false;

  private get scopedPresets(): PresetOut[] {
    return this.presets.filter((preset) => preset.scope === this.scope);
  }

  private get sensorAllowed(): boolean {
    const name = this.connection.preset_name;
    if (name !== undefined && this.presets.length > 0) {
      return presetAllowsSensor(this.presets, name);
    }
    // Falls back to the model rule the backend enforces: only a door may carry one.
    return this.connection.barrier === "door";
  }

  /** Binary sensors, opening-ish device classes first, then the rest by name. */
  private sensorCandidates(): { entityId: string; label: string }[] {
    const states = this.hass?.states ?? {};
    const rows = Object.values(states)
      .filter((state) => state.entity_id.startsWith("binary_sensor."))
      .map((state) => ({
        entityId: state.entity_id,
        label: state.attributes.friendly_name ?? state.entity_id,
        preferred: OPENING_CLASSES.has(state.attributes.device_class ?? ""),
      }));
    rows.sort((a, b) => {
      if (a.preferred !== b.preferred) {
        return a.preferred ? -1 : 1;
      }
      return a.label.localeCompare(b.label);
    });
    return rows.map(({ entityId, label }) => ({ entityId, label }));
  }

  private emit(patch: Partial<ConnectionOut>, removed: (keyof ConnectionOut)[] = []): void {
    const next: ConnectionOut = { ...this.connection, ...patch };
    for (const key of removed) {
      delete next[key];
    }
    this.dispatchEvent(
      new CustomEvent("connection-changed", {
        detail: { connection: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private onPreset(ev: Event): void {
    const name = (ev.target as HTMLSelectElement).value;
    const expanded = expandPreset(this.presets, name);
    if (expanded === null) {
      return;
    }
    // A kind that cannot carry a sensor must not keep a stale binding, or the
    // backend rejects the whole save with `invalid_connection`.
    const dropSensor = !presetAllowsSensor(this.presets, name);
    this.emit(expanded, dropSensor ? ["sensor_entity_id"] : []);
  }

  private onSide(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    if (value === "") {
      this.emit({}, ["side"]);
      return;
    }
    this.emit({ side: value as CardinalSide });
  }

  private onSensor(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    if (value === "") {
      this.emit({}, ["sensor_entity_id"]);
      return;
    }
    this.emit({ sensor_entity_id: value });
  }

  private onInlineTrust(ev: Event): void {
    const value = (ev.target as HTMLSelectElement).value;
    if (value === "") {
      this.emit({}, ["inline_trust"]);
      return;
    }
    this.emit({ inline_trust: value as ConnectionOut["inline_trust"] });
  }

  protected override render() {
    const connection = this.connection;
    return html`
      <div class="fields">
        <label>
          ${localize("editor.edge.preset")}
          <select .value=${live(connection.preset_name ?? "")} @change=${this.onPreset}>
            <option value="" .selected=${connection.preset_name === undefined}></option>
            ${this.scopedPresets.map(
              (preset) => html`
                <option
                  value=${preset.preset_name}
                  .selected=${connection.preset_name === preset.preset_name}
                >
                  ${enumLabel("preset", preset.preset_name)}
                </option>
              `,
            )}
          </select>
        </label>
        <p class="axes">
          ${enumLabel("passage", connection.passage)} · ${enumLabel("barrier", connection.barrier)}
        </p>
        <label>
          ${localize("editor.connection.side")}
          <select .value=${live(connection.side ?? "")} @change=${this.onSide}>
            <option value="" .selected=${connection.side === undefined}>
              ${localize("editor.beyond.unset")}
            </option>
            ${SIDES.map(
              (side) => html`
                <option value=${side} .selected=${connection.side === side}>
                  ${enumLabel("side", side)}
                </option>
              `,
            )}
          </select>
        </label>
        <label class="check">
          <input
            type="checkbox"
            .checked=${live(connection.glazed ?? false)}
            @change=${(ev: Event) => this.emit({ glazed: (ev.target as HTMLInputElement).checked })}
          />
          <span>${localize("editor.connection.glazed")}</span>
        </label>
        <label>
          ${localize("editor.connection.sensor")}
          ${this.sensorAllowed
            ? html`
                <select .value=${live(connection.sensor_entity_id ?? "")} @change=${this.onSensor}>
                  <option value="" .selected=${connection.sensor_entity_id === undefined}>
                    ${localize("editor.connection.sensor.none")}
                  </option>
                  ${this.sensorCandidates().map(
                    (row) => html`
                      <option
                        value=${row.entityId}
                        .selected=${connection.sensor_entity_id === row.entityId}
                      >
                        ${row.label}
                      </option>
                    `,
                  )}
                </select>
              `
            : html`<span class="disabled">${localize("editor.connection.sensor.unavailable")}</span>`}
        </label>
        ${this.sensorAllowed ? html`<p class="hint">${localize("editor.connection.sensor.hint")}</p>` : nothing}
        ${this.allowInlineTrust
          ? html`
              <label>
                ${localize("editor.exterior.beyond_trust")}
                <select .value=${live(connection.inline_trust ?? "")} @change=${this.onInlineTrust}>
                  <option value="" .selected=${connection.inline_trust === undefined}></option>
                  ${(["private", "shared", "public"] as const).map(
                    (trust) => html`
                      <option value=${trust} .selected=${connection.inline_trust === trust}>
                        ${enumLabel("trust", trust)}
                      </option>
                    `,
                  )}
                </select>
              </label>
              <p class="hint">${localize("editor.exterior.beyond_trust.hint")}</p>
            `
          : nothing}
        ${this.allowOverride
          ? html`
              <label class="check">
                <input
                  type="checkbox"
                  .checked=${live(connection.perimeter_override ?? false)}
                  @change=${(ev: Event) =>
                    this.emit({ perimeter_override: (ev.target as HTMLInputElement).checked })}
                />
                <span>${localize("editor.connection.override")}</span>
              </label>
              <p class="hint">${localize("editor.connection.override.hint")}</p>
            `
          : nothing}
      </div>
    `;
  }

  public static override styles = css`
    .fields {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.85em;
    }
    label.check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    select,
    input[type="text"] {
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .axes {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
    }
    .hint {
      margin: 0 0 2px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.75em;
      line-height: 1.4;
    }
    .disabled {
      color: var(--secondary-text-color, #727272);
      font-style: italic;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-connection-fields": TopologyConnectionFields;
  }
}
