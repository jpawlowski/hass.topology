/**
 * First-run import card (PLAN-topology-phase2-followup-configflow.md §4.1).
 *
 * Replaces the two one-shot import opt-ins the config flow used to collect: a
 * per-source card shown in the map view while `home_config.imports_done_at.<source>`
 * is `null`, driving the existing `topology.import_from_core` service. Nothing
 * auto-runs — both buttons are explicit user actions, and the import is
 * fill-empty-only, so it never overwrites an existing annotation.
 *
 * Dismissal is client-local (`localStorage`, the Phase-7 §2.5 precedent), so
 * declining costs no backend state. The logic lives in `first-run-logic.ts`.
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { HomeConfigOut } from "../api/types";
import type { HomeAssistant } from "../ha";
import { TopologyError } from "../api/ws-client";
import { localize } from "../i18n/localize";
import { toast } from "./toast";
import {
  type ImportSource,
  pendingImportSources,
  persistDismissal,
  readDismissed,
  runImport,
} from "./first-run-logic";

@customElement("topology-first-run-card")
export class TopologyFirstRunCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @property({ attribute: false }) public homeConfig!: HomeConfigOut;

  @state() private dismissed: ReadonlySet<ImportSource> = new Set<ImportSource>();
  @state() private running: ImportSource | null = null;

  public override connectedCallback(): void {
    super.connectedCallback();
    this.dismissed = readDismissed(this.storage);
  }

  /** `localStorage` when the browser exposes it (absent in a test/SSR context). */
  private get storage(): Storage | null {
    try {
      return window.localStorage ?? null;
    } catch {
      return null;
    }
  }

  private async runSource(source: ImportSource): Promise<void> {
    this.running = source;
    try {
      await runImport(this.hass, source);
    } catch (err) {
      toast(this, err instanceof TopologyError ? err : new TopologyError("store_error", String(err)));
    } finally {
      this.running = null;
    }
  }

  private dismissSource(source: ImportSource): void {
    this.dismissed = persistDismissal(this.storage, source);
  }

  protected override render() {
    const pending = pendingImportSources(this.homeConfig, this.dismissed);
    if (pending.length === 0) {
      return nothing;
    }
    return html`
      <div class="card">
        <h3>${localize("first_run.title")}</h3>
        <p class="hint">${localize("first_run.hint")}</p>
        ${pending.map(
          (source) => html`
            <div class="row">
              <span class="label">${localize(`first_run.source.${source}`)}</span>
              <div class="actions">
                <button
                  class="primary"
                  ?disabled=${this.running !== null}
                  @click=${() => this.runSource(source)}
                >
                  ${this.running === source
                    ? localize("first_run.running")
                    : localize("first_run.import")}
                </button>
                <button
                  class="link"
                  ?disabled=${this.running !== null}
                  @click=${() => this.dismissSource(source)}
                >
                  ${localize("first_run.dismiss")}
                </button>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }

  public static override styles = css`
    .card {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      color: var(--primary-text-color, #212121);
    }
    h3 {
      margin: 0;
    }
    p.hint {
      margin: 0;
      color: var(--secondary-text-color, #727272);
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    button.primary {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      cursor: pointer;
    }
    button.link {
      padding: 8px;
      border: none;
      background: none;
      color: var(--secondary-text-color, #727272);
      cursor: pointer;
      text-decoration: underline;
    }
    button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    "topology-first-run-card": TopologyFirstRunCard;
  }
}
