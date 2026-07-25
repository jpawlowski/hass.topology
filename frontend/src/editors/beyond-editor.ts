/**
 * Beyond (outer-wall) editor (Phase 7 §2.6). Per-side (N/E/S/W) selection of
 * what lies beyond, writing `topology/set_beyond` one side at a time.
 *
 * "Outer wall" is not a stored flag: a side is interior when it borders one of
 * your own areas (an edge exists) and exterior when you say what is beyond it.
 * The editor therefore shows, per side, which neighbour already occupies it —
 * declaring a beyond class for a side that is already an interior wall is exactly
 * what the `contradictory_bearings` check flags.
 *
 * Note the label: the beyond class `outdoor` reads as "Open air", because the
 * area's own `environment` has a value spelled `outdoor` too and the two mean
 * different things on different axes.
 *
 * Panel-only.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import type { AreaOut, BeyondClass, CardinalSide, EdgeOut, OccupancyExtent } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { enumLabel, localize } from "../i18n/localize";
import { toast } from "./toast";

const SIDES: CardinalSide[] = ["N", "E", "S", "W"];
const BEYOND: BeyondClass[] = ["outdoor", "neighbor", "earth"];

/**
 * A connection's `side` is recorded from `area_a`'s point of view; the far area
 * meets that same wall from the opposite bearing (master §1), so the far side of
 * an edge must be mirrored before it is compared with this area's sides.
 */
const OPPOSITE: Record<CardinalSide, CardinalSide> = { N: "S", S: "N", E: "W", W: "E" };

/**
 * What the home's occupancy extent makes the likely answer for a free outer wall:
 * a standalone property is surrounded by open air, a unit inside a building
 * mostly borders other units.
 *
 * This drives a *suggestion* only. Nothing is stored until the user picks it, and
 * no derivation treats an unset side as anything — the extent had driven no logic
 * at all before, and silently inferring outer walls the user never confirmed
 * would put claims into the model that nobody made.
 */
const EXTENT_SUGGESTION: Record<OccupancyExtent, BeyondClass> = {
  whole_property: "outdoor",
  unit_within_building: "neighbor",
};

@customElement("topology-beyond-editor")
export class TopologyBeyondEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public area!: AreaOut;
  @property({ attribute: false }) public edges: EdgeOut[] = [];
  /** Drives the per-side suggestion; `null` shows no suggestion at all. */
  @property({ attribute: false }) public occupancyExtent: OccupancyExtent | null = null;

  private async setSide(side: CardinalSide, value: string): Promise<void> {
    try {
      await this.client.setBeyond(this.area.area_id, side, value === "" ? null : value);
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  /** Area names already bordering each side of this area over an interior edge. */
  private interiorSides(): Map<CardinalSide, string[]> {
    const result = new Map<CardinalSide, string[]>();
    const areaId = this.area.area_id;
    for (const edge of this.edges) {
      if (edge.orphaned_at !== null) {
        continue;
      }
      const isA = edge.area_a === areaId;
      const isB = edge.area_b === areaId;
      if (!isA && !isB) {
        continue;
      }
      const otherId = isA ? edge.area_b : edge.area_a;
      const otherName = this.hass?.areas?.[otherId]?.name ?? otherId;
      for (const connection of edge.connections) {
        if (connection.side === undefined) {
          continue;
        }
        const mySide = isA ? connection.side : OPPOSITE[connection.side];
        const names = result.get(mySide) ?? [];
        if (!names.includes(otherName)) {
          names.push(otherName);
        }
        result.set(mySide, names);
      }
    }
    return result;
  }

  protected override render() {
    const interior = this.interiorSides();
    return html`
      <div class="editor">
        <h3>${localize("editor.beyond.title")}</h3>
        <p class="hint">${localize("editor.beyond.hint")}</p>
        ${SIDES.map((side) => {
          const borders = interior.get(side);
          const current = this.area.beyond[side];
          // Only suggest for a side that is still unset and is not already an
          // interior wall — suggesting a beyond class for a side that borders
          // another room is exactly what the bearing check flags.
          const suggestion =
            current === undefined && borders === undefined && this.occupancyExtent !== null
              ? EXTENT_SUGGESTION[this.occupancyExtent]
              : null;
          return html`
            <div class="side">
              <label>
                <span class="side-name">${enumLabel("side", side)}</span>
                <select
                  .value=${live(current ?? "")}
                  @change=${(ev: Event) => this.setSide(side, (ev.target as HTMLSelectElement).value)}
                >
                  <option value="" .selected=${current === undefined}>
                    ${localize("editor.beyond.unset")}
                  </option>
                  ${BEYOND.map(
                    (value) => html`
                      <option value=${value} .selected=${current === value}>
                        ${enumLabel("beyond", value)}
                      </option>
                    `,
                  )}
                </select>
              </label>
              ${borders !== undefined
                ? html`<p class="interior">
                    ${localize("editor.beyond.interior", { areas: borders.join(", ") })}
                  </p>`
                : nothing}
              ${suggestion !== null
                ? html`<p class="suggestion">
                    <button class="link" @click=${() => this.setSide(side, suggestion)}>
                      ${localize("editor.beyond.suggest", {
                        value: enumLabel("beyond", suggestion),
                      })}
                    </button>
                  </p>`
                : nothing}
            </div>
          `;
        })}
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
    }
    h3 {
      margin: 0;
    }
    .hint {
      margin: 0 0 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.9em;
    }
    .side-name {
      min-width: 4.5em;
    }
    select {
      flex: 1;
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .interior,
    .suggestion {
      margin: 0 0 2px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.72em;
    }
    button.link {
      padding: 0;
      border: none;
      background: none;
      color: var(--primary-color, #03a9f4);
      cursor: pointer;
      font: inherit;
      text-align: left;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-beyond-editor": TopologyBeyondEditor;
  }
}
