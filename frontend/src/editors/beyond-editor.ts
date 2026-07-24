/**
 * Beyond (outer-wall) editor (Phase 7 §2.6). Per-side (N/E/S/W) selection of
 * `outdoor`/`neighbor`/`earth`/clear, writing `topology/set_beyond` one side at a
 * time. Constrains where the exterior editor may place openings. Panel-only.
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { AreaOut, BeyondClass, CardinalSide } from "../api/types";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { localize } from "../i18n/localize";
import { toast } from "./toast";

const SIDES: CardinalSide[] = ["N", "E", "S", "W"];
const BEYOND: BeyondClass[] = ["outdoor", "neighbor", "earth"];

@customElement("topology-beyond-editor")
export class TopologyBeyondEditor extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public area!: AreaOut;

  private async setSide(side: CardinalSide, value: string): Promise<void> {
    try {
      await this.client.setBeyond(this.area.area_id, side, value === "" ? null : value);
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  protected override render() {
    return html`
      <div class="editor">
        <h3>${localize("editor.beyond.title")}</h3>
        ${SIDES.map(
          (side) => html`
            <label>
              ${side}
              <select
                .value=${this.area.beyond[side] ?? ""}
                @change=${(ev: Event) => this.setSide(side, (ev.target as HTMLSelectElement).value)}
              >
                <option value="">${localize("action.clear")}</option>
                ${BEYOND.map((value) => html`<option value=${value}>${value}</option>`)}
              </select>
            </label>
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
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--secondary-text-color, #727272);
    }
    select {
      padding: 8px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-beyond-editor": TopologyBeyondEditor;
  }
}
