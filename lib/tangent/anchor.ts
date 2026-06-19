import type { LLMAdapter } from '../adapters/types';
import { hashText, type Anchor } from './model';

// Turn a selection into a durable Anchor, and find that message again later. Re-anchoring tries the
// stable message id first, then falls back to matching the message text (for providers without ids).

export function createAnchor(adapter: LLMAdapter, msgEl: HTMLElement, quotedText: string): Anchor {
  return {
    messageId: adapter.messageId(msgEl),
    quotedText,
    textHash: hashText(msgEl.textContent ?? ''),
  };
}

export function resolveAnchor(adapter: LLMAdapter, anchor: Anchor): HTMLElement | null {
  const byId = adapter.findMessageById(anchor.messageId);
  if (byId) return byId;
  return adapter.messageElements().find((el) => adapter.isAssistant(el) && matchesByText(el, anchor)) ?? null;
}

function matchesByText(el: HTMLElement, anchor: Anchor): boolean {
  const text = el.textContent ?? '';
  if (hashText(text) === anchor.textHash) return true;
  return anchor.quotedText.length > 0 && text.includes(anchor.quotedText);
}
