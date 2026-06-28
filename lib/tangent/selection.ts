import type { LLMAdapter } from '../adapters/types';
import { isDark } from './theme';

export type CreateTangent = (passage: string, msgEl: HTMLElement, rect: DOMRect) => void;

interface Selected {
  text: string;
  msgEl: HTMLElement;
  rect: DOMRect;
}

/** The current selection if it sits inside an assistant reply, else null. */
function selectedPassage(adapter: LLMAdapter): Selected | null {
  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? '';
  if (!sel || !text || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const msgEl = adapter.assistantMessageContaining(range.commonAncestorContainer);
  if (!msgEl) return null;
  return { text, msgEl, rect: range.getBoundingClientRect() };
}

/** Show a "↳ Tangent" affordance when text is selected inside an assistant reply, and call
 *  `onCreate` on click or the Alt+T shortcut. Provider-agnostic: the adapter decides what counts
 *  as an assistant message. */
export function initSelection(adapter: LLMAdapter, onCreate: CreateTangent): void {
  const btn = document.createElement('button');
  btn.className = 'st-tangent-btn';
  btn.textContent = '↳ Tangent';
  btn.title = 'Start a tangent (Alt+T)';
  btn.setAttribute('aria-label', 'Start a tangent from the selected text');
  document.body.appendChild(btn);

  let pending: Selected | null = null;
  const hide = () => {
    btn.style.display = 'none';
    pending = null;
  };

  const trigger = (found: Selected) => {
    onCreate(found.text, found.msgEl, found.rect);
    window.getSelection()?.removeAllRanges();
    hide();
  };

  const update = () => {
    const found = selectedPassage(adapter);
    if (!found) return hide();
    pending = found;
    btn.dataset.stTheme = isDark() ? 'dark' : 'light';
    btn.style.display = 'block';
    btn.style.top = `${Math.min(found.rect.bottom + 6, window.innerHeight - 34)}px`;
    btn.style.left = `${Math.min(Math.max(8, found.rect.left), window.innerWidth - 96)}px`;
  };

  document.addEventListener('mouseup', () => setTimeout(update, 10));
  document.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => {
    // Alt+T from a live selection. Use e.code so the mac Option-key character (†) is irrelevant, and
    // bail unless the selection is inside an assistant reply so we never hijack normal typing.
    if (!e.altKey || e.ctrlKey || e.metaKey || e.code !== 'KeyT') return;
    const found = selectedPassage(adapter);
    if (!found) return;
    e.preventDefault();
    trigger(found);
  });

  btn.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection alive
  btn.addEventListener('click', () => {
    const found = selectedPassage(adapter) ?? pending;
    if (found) trigger(found);
  });
}
