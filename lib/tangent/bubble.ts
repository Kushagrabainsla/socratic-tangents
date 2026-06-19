import type { LLMAdapter } from '../adapters/types';
import { askTangent } from './engine';
import { titleFrom, type Tangent } from './model';
import { isDark } from './theme';

const MAX_WIDTH = 420;
const REFOCUS_DELAY_MS = 350;
const ANCHORED_CLASS = 'st-anchored';

const CARD_TEMPLATE = `
  <div class="st-card-head">
    <span class="st-card-label">↳ Tangent</span>
    <button class="st-card-close" title="Close tangent">✕</button>
  </div>
  <div class="st-quote"></div>
  <div class="st-thread"></div>
  <div class="st-composer">
    <textarea class="st-input" rows="1" placeholder="Ask about this…"></textarea>
    <button class="st-send" title="Send">↑</button>
  </div>`;

export interface BubbleParams {
  adapter: LLMAdapter;
  tangent: Tangent;
  msgEl: HTMLElement;
  rect: DOMRect;
  /** Persist the tangent after each exchange. */
  onUpdate: (tangent: Tangent) => void;
}

/**
 * Open a floating "thought bubble" anchored to `msgEl`. Restores any saved messages, tracks the
 * passage as the page scrolls, collapses to a side pill when off-screen, and persists each exchange.
 */
export function openBubble({ adapter, tangent, msgEl, rect, onUpdate }: BubbleParams): void {
  const already = document.querySelector<HTMLElement>(`.st-card[data-tangent-id="${tangent.id}"]`);
  if (already) {
    focusInput(already);
    return;
  }

  const card = createCard(tangent);
  document.body.appendChild(card);
  msgEl.classList.add(ANCHORED_CLASS);

  const thread = card.querySelector('.st-thread') as HTMLElement;
  tangent.messages.forEach((m) => appendMessage(thread, m.role, m.text));

  const stopTracking = trackToPassage(card, msgEl, rect);
  wireClose(card, () => {
    stopTracking();
    msgEl.classList.remove(ANCHORED_CLASS);
  });
  wirePillExpand(card, msgEl);
  wireComposer(card, { adapter, tangent, msgEl, onUpdate });
  focusInput(card);
}

function createCard(tangent: Tangent): HTMLElement {
  const card = document.createElement('div');
  card.className = 'st-card';
  card.dataset.tangentId = tangent.id;
  card.dataset.stTheme = isDark() ? 'dark' : 'light';
  card.innerHTML = CARD_TEMPLATE;
  (card.querySelector('.st-quote') as HTMLElement).textContent = tangent.anchor.quotedText;
  return card;
}

// ── tracking ─────────────────────────────────────────────────────────────
// Hosts scroll an inner container (window.scrollY stays 0), so we follow the message element's
// live viewport rect each frame and collapse to a side pill when it leaves the screen.

interface Anchor {
  offsetX: number;
  offsetY: number;
  width: number;
}

function trackToPassage(card: HTMLElement, msgEl: HTMLElement, rect: DOMRect): () => void {
  const origin = msgEl.getBoundingClientRect();
  const anchor: Anchor = {
    offsetX: rect.left - origin.left,
    offsetY: rect.bottom - origin.top,
    width: Math.min(MAX_WIDTH, window.innerWidth - 24),
  };
  let running = true;
  const step = () => {
    if (!running) return;
    placeCard(card, msgEl, anchor);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => {
    running = false;
  };
}

function placeCard(card: HTMLElement, msgEl: HTMLElement, anchor: Anchor): void {
  const m = msgEl.getBoundingClientRect();
  const desiredTop = m.top + anchor.offsetY;
  if (isOnScreen(desiredTop, m)) {
    card.classList.remove('st-min');
    card.style.width = `${anchor.width}px`;
    card.style.left = `${clampLeft(m.left + anchor.offsetX, anchor.width)}px`;
    // Keep the whole bubble on screen even when it is tall or near the bottom edge.
    card.style.top = `${clampTop(desiredTop, card.offsetHeight)}px`;
  } else {
    card.classList.add('st-min');
    card.style.removeProperty('width');
    card.style.removeProperty('left');
    card.style.removeProperty('top');
  }
}

function isOnScreen(top: number, m: DOMRect): boolean {
  return top > 8 && top < window.innerHeight - 80 && m.bottom > 0 && m.top < window.innerHeight;
}

const MARGIN = 12;

function clampLeft(left: number, width: number): number {
  return Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
}

function clampTop(top: number, height: number): number {
  return Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN));
}

function scrollToPassage(msgEl: HTMLElement): void {
  msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ── wiring ───────────────────────────────────────────────────────────────

function wireClose(card: HTMLElement, onClose: () => void): void {
  card.querySelector('.st-card-close')!.addEventListener('click', (e) => {
    e.stopPropagation();
    onClose();
    card.remove();
  });
}

function wirePillExpand(card: HTMLElement, msgEl: HTMLElement): void {
  card.addEventListener('click', () => {
    if (card.classList.contains('st-min')) scrollToPassage(msgEl);
  });
}

interface TangentContext {
  adapter: LLMAdapter;
  tangent: Tangent;
  msgEl: HTMLElement;
  onUpdate: (tangent: Tangent) => void;
}

function wireComposer(card: HTMLElement, ctx: TangentContext): void {
  const input = card.querySelector('.st-input') as HTMLTextAreaElement;
  const send = card.querySelector('.st-send') as HTMLButtonElement;
  const thread = card.querySelector('.st-thread') as HTMLElement;
  const submit = () => askQuestion(ctx, input, send, thread);

  input.addEventListener('input', () => autoGrow(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  });
  send.addEventListener('click', () => void submit());
}

async function askQuestion(
  ctx: TangentContext,
  input: HTMLTextAreaElement,
  send: HTMLButtonElement,
  thread: HTMLElement,
): Promise<void> {
  const question = input.value.trim();
  if (!question || send.disabled) return;
  resetInput(input);

  appendMessage(thread, 'user', question);
  const answer = appendMessage(thread, 'assistant', '…');
  answer.classList.add('st-thinking');
  send.disabled = true;
  try {
    const node = await askTangent(ctx.adapter, ctx.tangent.anchor.quotedText, question);
    answer.classList.remove('st-thinking');
    answer.replaceChildren(node);
    recordExchange(ctx.tangent, question, node.textContent ?? '');
    ctx.onUpdate(ctx.tangent);
  } catch (err) {
    answer.classList.remove('st-thinking');
    answer.textContent = `⚠️ ${describeError(err)}`;
  } finally {
    send.disabled = false;
    scrollToPassage(ctx.msgEl); // back to the passage we tangented upon
    setTimeout(() => input.focus(), REFOCUS_DELAY_MS);
  }
}

function recordExchange(tangent: Tangent, question: string, answer: string): void {
  tangent.messages.push({ role: 'user', text: question }, { role: 'assistant', text: answer });
  if (!tangent.title) tangent.title = titleFrom(question);
}

// ── small view helpers ───────────────────────────────────────────────────

function appendMessage(thread: HTMLElement, role: 'user' | 'assistant', text: string): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = `st-msg st-${role}`;
  bubble.textContent = text;
  thread.appendChild(bubble);
  return bubble;
}

function autoGrow(input: HTMLTextAreaElement): void {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function resetInput(input: HTMLTextAreaElement): void {
  input.value = '';
  input.style.height = 'auto';
}

function focusInput(card: HTMLElement): void {
  requestAnimationFrame(() => (card.querySelector('.st-input') as HTMLTextAreaElement).focus());
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
