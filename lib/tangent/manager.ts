import type { LLMAdapter, SelectorReport } from '../adapters/types';
import { createAnchor, resolveAnchor } from './anchor';
import { openBubble } from './bubble';
import { hideTurns } from './engine';
import { Launcher } from './launcher';
import { clearMarkers, ensureMarkers, renderMarkers } from './markers';
import { newId, type Tangent } from './model';
import { onUrlChange } from './nav';
import { showNotice } from './notice';
import { initSelection } from './selection';
import { parseTangents } from './import';
import {
  hasOnboarded,
  listByConversation,
  markOnboarded,
  onTangentsChanged,
  removeTangent,
  saveTangent,
} from './store';

const REATTACH_THROTTLE_MS = 400;

/** When to re-check that the provider's DOM still matches, after load. Spaced out to let the SPA hydrate. */
const HEALTH_CHECK_DELAYS_MS = [2000, 4000, 8000];

/** Delay before the first-run hint, so it doesn't compete with the page loading. */
const ONBOARD_DELAY_MS = 1200;

/**
 * Owns tangents for the active conversation: loads and persists them, renders markers and the
 * launcher, opens bubbles, and re-anchors when the user navigates between conversations.
 */
export class TangentManager {
  private conversationId: string;
  private tangents: Tangent[] = [];
  private readonly launcher: Launcher;
  private hideObserver: MutationObserver | null = null;
  private reHideScheduled = 0;

  constructor(private readonly adapter: LLMAdapter) {
    this.conversationId = adapter.conversationId();
    this.launcher = new Launcher(
      (id) => this.reopen(id),
      (id) => void this.delete(id),
      (json) => void this.importTangents(json),
    );
  }

  async start(): Promise<void> {
    await this.reload();
    initSelection(this.adapter, (passage, msgEl, rect) => this.create(passage, msgEl, rect));
    onUrlChange(() => void this.handleNavigation());
    onTangentsChanged(() => void this.reload());
    this.watchReRenders();
    this.scheduleHealthCheck();
    void this.maybeOnboard();
  }

  /** Show a one-time hint explaining how to start a tangent. */
  private async maybeOnboard(): Promise<void> {
    if (await hasOnboarded()) return;
    await markOnboarded();
    window.setTimeout(() => {
      showNotice(
        'Tip: select text in any reply, then click ↳ Tangent (or press Alt+T) to branch off without losing your place.',
        { actionLabel: 'Got it' },
      );
    }, ONBOARD_DELAY_MS);
  }

  private async reload(): Promise<void> {
    this.tangents = await listByConversation(this.conversationId);
    this.reHide();
    this.syncHideObserver();
    this.renderAll();
  }

  private get visibleTangents(): Tangent[] {
    return this.tangents.filter((t) => t.messages.length > 0);
  }

  private renderAll(): void {
    renderMarkers(this.adapter, this.visibleTangents, (id) => this.reopen(id));
    this.launcher.render(this.visibleTangents);
  }

  /** Re-attach markers after the page virtualizes/re-renders messages on scroll. */
  private watchReRenders(): void {
    let scheduled = 0;
    document.addEventListener(
      'scroll',
      () => {
        if (scheduled) return;
        scheduled = window.setTimeout(() => {
          scheduled = 0;
          ensureMarkers(this.adapter, this.visibleTangents, (id) => this.reopen(id));
        }, REATTACH_THROTTLE_MS);
      },
      true,
    );
  }

  /** Once the page has settled, confirm the provider's DOM still matches our selectors. If not,
   *  the site likely changed and the extension needs an update; tell the user instead of failing
   *  silently. Retries a few times so slow hydration isn't mistaken for breakage. */
  private scheduleHealthCheck(attempt = 0): void {
    window.setTimeout(() => {
      const report = this.adapter.checkSelectors();
      if (report.ok) return;
      if (attempt < HEALTH_CHECK_DELAYS_MS.length - 1) this.scheduleHealthCheck(attempt + 1);
      else this.reportBroken(report);
    }, HEALTH_CHECK_DELAYS_MS[attempt]);
  }

  private reportBroken(report: SelectorReport): void {
    const { name } = this.adapter;
    console.warn(
      `[Socratic Tangents] ${name}: the page no longer matches the expected selectors ` +
        `(missing: ${report.missing.join(', ')}). ${name} likely changed its layout; the extension may need an update.`,
    );
    showNotice(`Socratic Tangents may need an update for ${name}. Some controls weren't found on this page.`);
  }

  /** Every turn id this conversation's tangents have hidden, so reloads keep the thread clean. */
  private get hiddenTurnIds(): Set<string> {
    const ids = new Set<string>();
    for (const tangent of this.tangents) {
      for (const id of tangent.hiddenTurnIds) ids.add(id);
    }
    return ids;
  }

  private reHide(): void {
    hideTurns(this.adapter, this.hiddenTurnIds);
  }

  /** Watch for late-rendered turns (initial load, virtualization) only while there are any to hide. */
  private syncHideObserver(): void {
    const hasHidden = this.tangents.some((t) => t.hiddenTurnIds.length > 0);
    if (hasHidden && !this.hideObserver) {
      this.hideObserver = new MutationObserver(() => {
        if (this.reHideScheduled) return;
        this.reHideScheduled = window.setTimeout(() => {
          this.reHideScheduled = 0;
          this.reHide();
        }, REATTACH_THROTTLE_MS);
      });
      this.hideObserver.observe(document.body, { childList: true, subtree: true });
    } else if (!hasHidden && this.hideObserver) {
      this.hideObserver.disconnect();
      this.hideObserver = null;
    }
  }

  private async delete(id: string): Promise<void> {
    await removeTangent(id);
    this.tangents = this.tangents.filter((t) => t.id !== id);
    document.querySelector(`.st-card[data-tangent-id="${id}"]`)?.remove();
    this.syncHideObserver();
    this.renderAll();
  }

  private create(passage: string, msgEl: HTMLElement, rect: DOMRect): void {
    const now = Date.now();
    const tangent: Tangent = {
      id: newId(),
      conversationId: this.conversationId,
      anchor: createAnchor(this.adapter, msgEl, passage),
      messages: [],
      hiddenTurnIds: [],
      title: '',
      createdAt: now,
      updatedAt: now,
    };
    this.tangents.push(tangent);
    this.show(tangent, msgEl, rect);
  }

  private reopen(id: string): void {
    const tangent = this.tangents.find((t) => t.id === id);
    if (!tangent) return;
    const msgEl = resolveAnchor(this.adapter, tangent.anchor);
    if (!msgEl) return; // passage no longer on the page; left as a no-op for now
    msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.show(tangent, msgEl, msgEl.getBoundingClientRect());
  }

  private show(tangent: Tangent, msgEl: HTMLElement, rect: DOMRect): void {
    openBubble({
      adapter: this.adapter,
      tangent,
      msgEl,
      rect,
      onUpdate: (t) => void this.persist(t),
      onDelete: (id) => void this.delete(id),
    });
  }

  private async persist(tangent: Tangent): Promise<void> {
    tangent.updatedAt = Date.now();
    await saveTangent(tangent);
    this.syncHideObserver();
    this.renderAll();
  }

  /** Restore tangents from an exported JSON file. They keep their original conversation ids, so each
   *  reappears on the conversation it belongs to; any for the current one show up immediately. */
  private async importTangents(json: string): Promise<void> {
    let parsed: Tangent[];
    try {
      parsed = parseTangents(json);
    } catch {
      showNotice('Import failed: that file is not a valid tangents export.');
      return;
    }
    if (parsed.length === 0) {
      showNotice('Nothing to import: no tangents found in that file.');
      return;
    }
    for (const tangent of parsed) await saveTangent(tangent);
    await this.reload();
    showNotice(`Imported ${parsed.length} tangent${parsed.length === 1 ? '' : 's'}.`);
  }

  private async handleNavigation(): Promise<void> {
    const current = this.adapter.conversationId();
    if (current === this.conversationId) return;
    this.conversationId = current;
    clearMarkers();
    await this.reload();
  }
}
