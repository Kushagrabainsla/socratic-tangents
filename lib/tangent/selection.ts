import type { LLMAdapter } from '../adapters/types';
import { isDark } from './theme';

export type CreateTangent = (passage: string, msgEl: HTMLElement, rect: DOMRect) => void;

/** Show a "↳ Tangent" affordance when text is selected inside an assistant reply, and call
 *  `onCreate` on click. Provider-agnostic: the adapter decides what counts as an assistant message. */
export function initSelection(adapter: LLMAdapter, onCreate: CreateTangent): void {
  const btn = document.createElement('button');
  btn.className = 'st-tangent-btn';
  btn.textContent = '↳ Tangent';
  document.body.appendChild(btn);

  let pending: { text: string; msgEl: HTMLElement } | null = null;
  const hide = () => {
    btn.style.display = 'none';
    pending = null;
  };

  function update() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (!sel || !text || sel.rangeCount === 0) return hide();
    const msgEl = adapter.assistantMessageContaining(sel.getRangeAt(0).commonAncestorContainer);
    if (!msgEl) return hide();
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    btn.dataset.stTheme = isDark() ? 'dark' : 'light';
    btn.style.display = 'block';
    btn.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - 34)}px`;
    btn.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - 96)}px`;
    pending = { text, msgEl };
  }

  document.addEventListener('mouseup', () => setTimeout(update, 10));
  document.addEventListener('scroll', hide, true);
  btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection alive
  btn.addEventListener('click', () => {
    if (!pending) return;
    const sel = window.getSelection();
    const rect = sel && sel.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : pending.msgEl.getBoundingClientRect();
    onCreate(pending.text, pending.msgEl, rect);
    window.getSelection()?.removeAllRanges();
    hide();
  });
}
