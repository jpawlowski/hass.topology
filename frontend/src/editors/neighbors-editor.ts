/**
 * `<topology-neighbors-editor>` — declare which areas border this one
 * (Phase 7 §2.6).
 *
 * This is the only way to *create* an edge from the panel. Before it existed the
 * edge editor opened solely by clicking a line that was already on the map, so on
 * a fresh install — where no edge exists — the adjacency graph, the whole point of
 * the integration, could only be built from Developer Tools.
 *
 * Candidates are grouped by how the two areas' floors relate, derived from the
 * shipped `effective_level`: same floor, one floor up, one floor down, then
 * anything further apart under an "unusual" heading. Two areas more than a storey
 * apart almost never share a boundary, so the grouping is the guard rail — the
 * backend still accepts such an edge, because a maisonette void or an atrium is a
 * real thing and this panel does not get to veto the user's house.
 *
 * The offered kinds are filtered the same way: a same-floor boundary is crossed
 * step-free, a vertical one needs stairs, a lift, a ladder or a hatch. That comes
 * from the shipped presets' `passage`, never from a table copied into the client.
 *
 * Panel-only (write layer, §4.2).
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import type { AreaOut, EdgeOut, FloorOut, PresetOut } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { expandPreset } from "./preset";
import { deltaFrom, presetsForRelation, relationFor, type Relation } from "./neighbors-logic";
import { enumLabel, localize } from "../i18n/localize";
import { toast } from "./toast";

interface Candidate {
  areaId: string;
  name: string;
  relation: Relation;
}

const GROUP_ORDER: Relation[] = ["same", "above", "below", "distant", "unknown"];

const GROUP_LABEL: Record<Relation, string> = {
  same: "editor.neighbors.group.same",
  above: "editor.neighbors.group.above",
  below: "editor.neighbors.group.below",
  distant: "editor.neighbors.group.distant",
  unknown: "editor.neighbors.group.unknown",
};

@customElement("topology-neighbors-editor")
export class TopologyNeighborsEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public area!: AreaOut;
  @property({ attribute: false }) public areas: AreaOut[] = [];
  @property({ attribute: false }) public edges: EdgeOut[] = [];
  @property({ attribute: false }) public floors: FloorOut[] = [];
  @property({ attribute: false }) public presets: PresetOut[] = [];

  @state() private pickedArea = "";
  @state() private pickedPreset = "";
  @state() private busy = false;

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has("area")) {
      this.pickedArea = "";
      this.pickedPreset = "";
    }
  }

  private areaName(areaId: string): string {
    return this.hass?.areas?.[areaId]?.name ?? areaId;
  }

  /** Effective level of an area, via its floor. `null` when not resolvable. */
  private levelOf(areaId: string): number | null {
    const floorId = this.hass?.areas?.[areaId]?.floor_id ?? null;
    if (floorId === null) {
      return null;
    }
    const floor = this.floors.find((row) => row.floor_id === floorId);
    return floor?.effective_level ?? null;
  }

  private relationTo(areaId: string): Relation {
    return relationFor(this.levelOf(this.area.area_id), this.levelOf(areaId));
  }

  /** Edges of the edited area, with the far side resolved. */
  private currentNeighbors(): { edge: EdgeOut; otherId: string }[] {
    return this.edges
      .filter(
        (edge) =>
          !edge.orphaned_at && (edge.area_a === this.area.area_id || edge.area_b === this.area.area_id),
      )
      .map((edge) => ({
        edge,
        otherId: edge.area_a === this.area.area_id ? edge.area_b : edge.area_a,
      }));
  }

  private candidates(): Candidate[] {
    const taken = new Set(this.currentNeighbors().map((row) => row.otherId));
    return this.areas
      .filter(
        (area) =>
          area.area_id !== this.area.area_id &&
          area.orphaned_at === null &&
          !taken.has(area.area_id) &&
          // An area only in the store (no registry entry) cannot be an endpoint.
          this.hass?.areas?.[area.area_id] !== undefined,
      )
      .map((area) => ({
        areaId: area.area_id,
        name: this.areaName(area.area_id),
        relation: this.relationTo(area.area_id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Presets that can cross the boundary implied by the picked area's relation. */
  private offeredPresets(): PresetOut[] {
    const relation = this.pickedArea === "" ? "unknown" : this.relationTo(this.pickedArea);
    return presetsForRelation(this.presets, relation);
  }

  private async addNeighbor(): Promise<void> {
    if (this.pickedArea === "" || this.pickedPreset === "") {
      return;
    }
    const connection = expandPreset(this.presets, this.pickedPreset);
    if (connection === null) {
      return;
    }
    this.busy = true;
    try {
      await this.client.upsertEdge(this.area.area_id, this.pickedArea, [connection]);
      this.pickedArea = "";
      this.pickedPreset = "";
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    } finally {
      this.busy = false;
    }
  }

  private select(edge: EdgeOut): void {
    this.dispatchEvent(
      new CustomEvent("edge-selected", { detail: { edge }, bubbles: true, composed: true }),
    );
  }

  /** One line describing how the two areas sit relative to each other. */
  private relationSummary(edge: EdgeOut, otherId: string): string {
    if (edge.axis === "unknown" || edge.level_delta === null) {
      return localize("editor.edge.axis.unknown");
    }
    if (edge.level_delta === 0) {
      return localize("editor.edge.axis.horizontal");
    }
    const deltaFromHere = deltaFrom(edge, this.area.area_id) ?? 0;
    const key = deltaFromHere > 0 ? "editor.edge.axis.vertical_up" : "editor.edge.axis.vertical_down";
    return localize(key, {
      a: this.areaName(this.area.area_id),
      b: this.areaName(otherId),
      levels: Math.abs(deltaFromHere),
    });
  }

  protected override render() {
    const neighbors = this.currentNeighbors();
    const candidates = this.candidates();
    const offered = this.offeredPresets();
    const distant = this.pickedArea !== "" && this.relationTo(this.pickedArea) === "distant";
    return html`
      <div class="editor">
        <h3>${localize("editor.neighbors.title")}</h3>
        <p class="hint">${localize("editor.neighbors.hint")}</p>
        ${neighbors.length === 0
          ? html`<p class="empty">${localize("editor.neighbors.none")}</p>`
          : html`<ul>
              ${neighbors.map(
                ({ edge, otherId }) => html`
                  <li>
                    <div class="row">
                      <button class="link" @click=${() => this.select(edge)}>
                        ${this.areaName(otherId)}
                      </button>
                      <span class="kinds">
                        ${edge.connections
                          .map((connection) =>
                            connection.preset_name !== undefined
                              ? enumLabel("preset", connection.preset_name)
                              : enumLabel("passage", connection.passage),
                          )
                          .join(", ")}
                      </span>
                    </div>
                    <p class="relation">${this.relationSummary(edge, otherId)}</p>
                  </li>
                `,
              )}
            </ul>`}
        ${candidates.length === 0
          ? nothing
          : html`
              <div class="add">
                <label>
                  ${localize("editor.neighbors.area")}
                  <select
                    .value=${live(this.pickedArea)}
                    @change=${(ev: Event) => {
                      this.pickedArea = (ev.target as HTMLSelectElement).value;
                      // The new relation may not permit the chosen kind any more.
                      this.pickedPreset = "";
                    }}
                  >
                    <option value="" .selected=${this.pickedArea === ""}>
                      ${localize("editor.neighbors.pick")}
                    </option>
                    ${GROUP_ORDER.map((relation) => {
                      const group = candidates.filter((row) => row.relation === relation);
                      if (group.length === 0) {
                        return nothing;
                      }
                      return html`
                        <optgroup label=${localize(GROUP_LABEL[relation])}>
                          ${group.map(
                            (row) => html`
                              <option value=${row.areaId} .selected=${this.pickedArea === row.areaId}>
                                ${row.name}
                              </option>
                            `,
                          )}
                        </optgroup>
                      `;
                    })}
                  </select>
                </label>
                ${distant ? html`<p class="warn">${localize("editor.neighbors.distant_warning")}</p>` : nothing}
                <label>
                  ${localize("editor.edge.preset")}
                  <select
                    .value=${live(this.pickedPreset)}
                    @change=${(ev: Event) => {
                      this.pickedPreset = (ev.target as HTMLSelectElement).value;
                    }}
                  >
                    <option value="" .selected=${this.pickedPreset === ""}></option>
                    ${offered.map(
                      (preset) => html`
                        <option
                          value=${preset.preset_name}
                          .selected=${this.pickedPreset === preset.preset_name}
                        >
                          ${enumLabel("preset", preset.preset_name)}
                        </option>
                      `,
                    )}
                  </select>
                </label>
                <div class="actions">
                  <button
                    class="primary"
                    ?disabled=${this.busy || this.pickedArea === "" || this.pickedPreset === ""}
                    @click=${this.addNeighbor}
                  >
                    ${localize("editor.neighbors.add")}
                  </button>
                </div>
              </div>
            `}
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
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      line-height: 1.4;
    }
    ul {
      margin: 4px 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .kinds {
      color: var(--secondary-text-color, #727272);
      font-size: 0.8em;
      text-align: right;
    }
    .relation {
      margin: 2px 0 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.75em;
    }
    .empty {
      margin: 0;
      color: var(--secondary-text-color, #727272);
      font-size: 0.85em;
    }
    .add {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 4px;
      padding-top: 8px;
      border-top: 1px dashed var(--divider-color, #e0e0e0);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: var(--secondary-text-color, #727272);
      font-size: 0.85em;
    }
    select {
      padding: 6px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
    .warn {
      margin: 0;
      color: var(--warning-color, #ff9800);
      font-size: 0.75em;
      line-height: 1.4;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
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
    button.primary {
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
    }
    button.primary[disabled] {
      opacity: 0.5;
      cursor: default;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-neighbors-editor": TopologyNeighborsEditor;
  }
}
