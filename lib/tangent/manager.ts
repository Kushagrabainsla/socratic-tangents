import type { LLMAdapter } from '../adapters/types';
import { createAnchor, resolveAnchor } from './anchor';
import { openBubble } from './bubble';
import { Launcher } from './launcher';
import { clearMarkers, renderMarkers } from './markers';
import { newId, type Tangent } from './model';
import { onUrlChange } from './nav';
import { initSelection } from './selection';
import { listByConversation, onTangentsChanged, saveTangent } from './store';

/**
 * Owns tangents for the active conversation: loads and persists them, renders markers and the
 * launcher, opens bubbles, and re-anchors when the user navigates between conversations.
 */
export class TangentManager {
  private conversationId: string;
  private tangents: Tangent[] = [];
  private readonly launcher: Launcher;

  constructor(private readonly adapter: LLMAdapter) {
    this.conversationId = adapter.conversationId();
    this.launcher = new Launcher((id) => this.reopen(id));
  }

  async start(): Promise<void> {
    await this.reload();
    initSelection(this.adapter, (passage, msgEl, rect) => this.create(passage, msgEl, rect));
    onUrlChange(() => void this.handleNavigation());
    onTangentsChanged(() => void this.reload());
  }

  private async reload(): Promise<void> {
    this.tangents = await listByConversation(this.conversationId);
    this.renderAll();
  }

  private renderAll(): void {
    const withMessages = this.tangents.filter((t) => t.messages.length > 0);
    renderMarkers(this.adapter, withMessages, (id) => this.reopen(id));
    this.launcher.render(withMessages);
  }

  private create(passage: string, msgEl: HTMLElement, rect: DOMRect): void {
    const now = Date.now();
    const tangent: Tangent = {
      id: newId(),
      conversationId: this.conversationId,
      anchor: createAnchor(this.adapter, msgEl, passage),
      messages: [],
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
    });
  }

  private async persist(tangent: Tangent): Promise<void> {
    tangent.updatedAt = Date.now();
    await saveTangent(tangent);
    this.renderAll();
  }

  private async handleNavigation(): Promise<void> {
    const current = this.adapter.conversationId();
    if (current === this.conversationId) return;
    this.conversationId = current;
    clearMarkers();
    await this.reload();
  }
}
