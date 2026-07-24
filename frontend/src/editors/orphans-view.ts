/**
 * Orphan review view (Phase 7 §2.6) — the `?focus=orphans` deep-link target.
 * Lists orphaned areas/edges and offers `topology/restore_edge` to re-adopt an
 * orphaned edge whose areas returned. Purge itself stays in the Phase-5 repair
 * fix-flow; this view is the inspect-before-purge surface. Panel-only.
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import type { AreaOut, EdgeOut } from "../api/types";
import type { HomeAssistant } from "../ha";
import type { TopologyWsClient } from "../api/ws-client";
import { TopologyError } from "../api/ws-client";
import { localize } from "../i18n/localize";
import { toast } from "./toast";

@customElement("topology-orphans-view")
export class TopologyOrphansView extends LitElement {
  @property({ attribute: false }) public client!: TopologyWsClient;
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public areas: AreaOut[] = [];
  @property({ attribute: false }) public edges: EdgeOut[] = [];

  private get orphanedAreas(): AreaOut[] {
    return this.areas.filter((area) => area.orphaned_at !== null);
  }

  private get orphanedEdges(): EdgeOut[] {
    return this.edges.filter((edge) => edge.orphaned_at !== null);
  }

  private areaLabel(areaId: string): string {
    return this.hass?.areas?.[areaId]?.name ?? areaId;
  }

  /** An orphaned edge is restorable only when both its areas exist again. */
  private restorable(edge: EdgeOut): boolean {
    return Boolean(this.hass?.areas?.[edge.area_a]) && Boolean(this.hass?.areas?.[edge.area_b]);
  }

  private async restore(edge: EdgeOut): Promise<void> {
    try {
      await this.client.restoreEdge(edge.edge_id);
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    }
  }

  protected override render() {
    const areas = this.orphanedAreas;
    const edges = this.orphanedEdges;
    if (areas.length === 0 && edges.length === 0) {
      return html`<div class="editor"><p>${localize("editor.orphans.empty")}</p></div>`;
    }
    return html`
      <div class="editor">
        <h3>${localize("editor.orphans.title")}</h3>
        ${areas.map(
          (area) => html`<div class="row"><span>${this.areaLabel(area.area_id)}</span></div>`,
        )}
        ${edges.map(
          (edge) => html`
            <div class="row">
              <span>${this.areaLabel(edge.area_a)} ↔ ${this.areaLabel(edge.area_b)}</span>
              <button
                ?disabled=${!this.restorable(edge)}
                @click=${() => this.restore(edge)}
              >
                ${localize("editor.orphans.restore")}
              </button>
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
      gap: 8px;
      padding: 16px;
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    button {
      padding: 6px 12px;
      border: 1px solid var(--divider-color, #bdbdbd);
      border-radius: 6px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #212121);
      cursor: pointer;
    }
    button[disabled] {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-orphans-view": TopologyOrphansView;
  }
}
