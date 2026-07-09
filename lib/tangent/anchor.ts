import type { LLMAdapter } from '../adapters/types';
import { hashText, type Anchor } from './model';

// Turn a selection into a durable Anchor, and find that message again later. Re-anchoring tries the
// stable message id first, then falls back to matching the message text (for providers without ids).

export function createAnchor(adapter: LLMAdapter, msgEl: HTMLElement, quotedText: string): Anchor {
  return {
    messageId: adapter.messageId(msgEl),
    quotedText,
    textHash: hashText(messageText(msgEl)),
  };
}

export function resolveAnchor(adapter: LLMAdapter, anchor: Anchor): HTMLElement | null {
  const byId = adapter.findMessageById(anchor.messageId);
  if (byId) return byId;
  return adapter.messageElements().find((el) => adapter.isAssistant(el) && matchesByText(el, anchor)) ?? null;
}

function matchesByText(el: HTMLElement, anchor: Anchor): boolean {
  const text = messageText(el);
  if (hashText(text) === anchor.textHash) return true;
  return anchor.quotedText.length > 0 && text.includes(anchor.quotedText);
}

/** The message's own text, excluding any extension UI (e.g. the tangent marker badge) nested inside
 *  it. Without this, appending a marker would change the message's textContent and break re-anchoring
 *  on providers that have no stable message id (Claude). */
function messageText(el: HTMLElement): string {
  if (!el.querySelector('[data-st-ui]')) return el.textContent ?? '';
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('[data-st-ui]').forEach((n) => n.remove());
  return clone.textContent ?? '';
}
