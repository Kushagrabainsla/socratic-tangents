import type { LLMAdapter } from '../adapters/types';
import { askTangent } from './engine';
import { titleFrom, type Tangent } from './model';
import { isDark } from './theme';

const MAX_WIDTH = 420;
const MARGIN = 12;
const REFOCUS_DELAY_MS = 350;
const COPIED_RESET_MS = 1200;
const ANCHORED_CLASS = 'st-anchored';

const CARD_TEMPLATE = `
  <div class="st-card-head">
    <span class="st-card-label">↳ Tangent</span>
    <div class="st-card-actions">
      <button class="st-icon st-regen" title="Regenerate last answer">↻</button>
      <button class="st-icon st-del" title="Delete tangent">🗑</button>
      <button class="st-icon st-card-close" title="Close">✕</button>
    </div>
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
  onUpdate: (tangent: Tangent) => void;
  onDelete: (id: string) => void;
}

interface Pin {
  active: boolean;
  left: number;
  top: number;
}

interface Session {
  generating: boolean;
  lastQuestion: string;
  lastAnswer: HTMLElement | null;
}

/**
 * Open a floating thought bubble for a tangent. Restores saved messages, tracks the passage,
 * collapses to a side pill when off-screen, streams answers live, and persists each exchange.
 */
export function openBubble(params: BubbleParams): void {
  const { tangent, msgEl, rect } = params;
  const already = document.querySelector<HTMLElement>(`.st-card[data-tangent-id="${tangent.id}"]`);
  if (already) {
    focusInput(already);
    return;
  }

  const card = createCard(tangent);
  document.body.appendChild(card);
  msgEl.classList.add(ANCHORED_CLASS);

  const pin: Pin = { active: false, left: 0, top: 0 };
  const session: Session = { generating: false, lastQuestion: '', lastAnswer: null };
  const thread = card.querySelector('.st-thread') as HTMLElement;
  restore(thread, tangent, session);

  const stopTracking = trackToPassage(card, msgEl, rect, pin);
  const close = () => {
    stopTracking();
    msgEl.classList.remove(ANCHORED_CLASS);
    card.remove();
  };

  wireHeader(card, params, pin, close);
  wirePillExpand(card, msgEl);
  wireKeyboard(card, close);
  wireComposer(card, { ...params, thread, session });
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

function restore(thread: HTMLElement, tangent: Tangent, session: Session): void {
  for (const message of tangent.messages) {
    const bubble = appendMessage(thread, message.role, message.text);
    if (message.role === 'user') {
      session.lastQuestion = message.text;
    } else {
      addAnswerActions(bubble, message.text);
      session.lastAnswer = bubble;
    }
  }
}

// ── header: drag, regenerate, delete, close ────────────────────────────────

function wireHeader(card: HTMLElement, params: BubbleParams, pin: Pin, close: () => void): void {
  const head = card.querySelector('.st-card-head') as HTMLElement;
  enableDrag(head, card, pin);

  card.querySelector('.st-card-close')!.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  card.querySelector('.st-del')!.addEventListener('click', (e) => {
    e.stopPropagation();
    params.onDelete(params.tangent.id);
    close();
  });
}

function enableDrag(handle: HTMLElement, card: HTMLElement, pin: Pin): void {
  handle.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const rect = card.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    pin.active = true;
    const move = (ev: MouseEvent) => {
      pin.left = ev.clientX - offsetX;
      pin.top = ev.clientY - offsetY;
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function wireKeyboard(card: HTMLElement, close: () => void): void {
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

// ── tracking ───────────────────────────────────────────────────────────────

interface Anchor {
  offsetX: number;
  offsetY: number;
  width: number;
}

function trackToPassage(card: HTMLElement, msgEl: HTMLElement, rect: DOMRect, pin: Pin): () => void {
  const origin = msgEl.getBoundingClientRect();
  const anchor: Anchor = {
    offsetX: rect.left - origin.left,
    offsetY: rect.bottom - origin.top,
    width: Math.min(MAX_WIDTH, window.innerWidth - 24),
  };
  let running = true;
  const step = () => {
    if (!running) return;
    placeCard(card, msgEl, anchor, pin);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => {
    running = false;
  };
}

function placeCard(card: HTMLElement, msgEl: HTMLElement, anchor: Anchor, pin: Pin): void {
  if (pin.active) {
    card.classList.remove('st-min');
    card.style.width = `${anchor.width}px`;
    card.style.left = `${clampLeft(pin.left, anchor.width)}px`;
    card.style.top = `${clampTop(pin.top, card.offsetHeight)}px`;
    return;
  }
  const m = msgEl.getBoundingClientRect();
  const desiredTop = m.top + anchor.offsetY;
  if (isOnScreen(desiredTop, m)) {
    card.classList.remove('st-min');
    card.style.width = `${anchor.width}px`;
    card.style.left = `${clampLeft(m.left + anchor.offsetX, anchor.width)}px`;
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

function clampLeft(left: number, width: number): number {
  return Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
}

function clampTop(top: number, height: number): number {
  return Math.max(MARGIN, Math.min(top, window.innerHeight - height - MARGIN));
}

function scrollToPassage(msgEl: HTMLElement): void {
  msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function wirePillExpand(card: HTMLElement, msgEl: HTMLElement): void {
  card.addEventListener('click', () => {
    if (card.classList.contains('st-min')) scrollToPassage(msgEl);
  });
}

// ── composer: send, stop, stream, regenerate ───────────────────────────────

interface ComposerContext extends BubbleParams {
  thread: HTMLElement;
  session: Session;
}

function wireComposer(card: HTMLElement, ctx: ComposerContext): void {
  const input = card.querySelector('.st-input') as HTMLTextAreaElement;
  const send = card.querySelector('.st-send') as HTMLButtonElement;
  const regen = card.querySelector('.st-regen') as HTMLButtonElement;

  const setGenerating = (on: boolean) => {
    ctx.session.generating = on;
    send.textContent = on ? '■' : '↑';
    send.title = on ? 'Stop' : 'Send';
    send.classList.toggle('st-stop', on);
    regen.disabled = on;
  };

  const generate = (question: string, answer: HTMLElement, recordUser: boolean) =>
    runGeneration(ctx, question, answer, recordUser, setGenerating, () => input.focus());

  input.addEventListener('input', () => autoGrow(input));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit(ctx, input, generate);
    }
  });
  send.addEventListener('click', () => {
    if (ctx.session.generating) ctx.adapter.stop();
    else void submit(ctx, input, generate);
  });
  regen.addEventListener('click', () => void regenerate(ctx, generate));
}

async function submit(
  ctx: ComposerContext,
  input: HTMLTextAreaElement,
  generate: (q: string, a: HTMLElement, recordUser: boolean) => Promise<void>,
): Promise<void> {
  const question = input.value.trim();
  if (!question || ctx.session.generating) return;
  resetInput(input);
  appendMessage(ctx.thread, 'user', question);
  const answer = startAnswer(ctx.thread);
  await generate(question, answer, true);
}

async function regenerate(
  ctx: ComposerContext,
  generate: (q: string, a: HTMLElement, recordUser: boolean) => Promise<void>,
): Promise<void> {
  const { session, tangent } = ctx;
  if (session.generating || !session.lastQuestion || !session.lastAnswer) return;
  if (tangent.messages.at(-1)?.role === 'assistant') tangent.messages.pop();
  session.lastAnswer.replaceChildren();
  session.lastAnswer.textContent = '…';
  session.lastAnswer.classList.add('st-thinking');
  await generate(session.lastQuestion, session.lastAnswer, false);
}

async function runGeneration(
  ctx: ComposerContext,
  question: string,
  answer: HTMLElement,
  recordUser: boolean,
  setGenerating: (on: boolean) => void,
  refocus: () => void,
): Promise<void> {
  setGenerating(true);
  try {
    const node = await askTangent(ctx.adapter, ctx.tangent.anchor.quotedText, question, (text) =>
      streamInto(answer, text),
    );
    answer.classList.remove('st-thinking');
    answer.replaceChildren(node);
    const text = node.textContent ?? '';
    addAnswerActions(answer, text);
    recordExchange(ctx.tangent, question, text, recordUser);
    ctx.session.lastQuestion = question;
    ctx.session.lastAnswer = answer;
    ctx.onUpdate(ctx.tangent);
  } catch (err) {
    answer.classList.remove('st-thinking');
    answer.textContent = `⚠️ ${describeError(err)}`;
  } finally {
    setGenerating(false);
    scrollToPassage(ctx.msgEl);
    setTimeout(refocus, REFOCUS_DELAY_MS);
  }
}

function streamInto(answer: HTMLElement, text: string): void {
  answer.classList.remove('st-thinking');
  answer.textContent = text;
}

function recordExchange(tangent: Tangent, question: string, answer: string, recordUser: boolean): void {
  if (recordUser) tangent.messages.push({ role: 'user', text: question });
  tangent.messages.push({ role: 'assistant', text: answer });
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

function startAnswer(thread: HTMLElement): HTMLElement {
  const answer = appendMessage(thread, 'assistant', '…');
  answer.classList.add('st-thinking');
  return answer;
}

function addAnswerActions(bubble: HTMLElement, text: string): void {
  const actions = document.createElement('div');
  actions.className = 'st-answer-actions';
  const copy = document.createElement('button');
  copy.className = 'st-mini';
  copy.textContent = 'Copy';
  copy.addEventListener('click', (e) => {
    e.stopPropagation();
    void copyText(text);
    copy.textContent = 'Copied';
    setTimeout(() => (copy.textContent = 'Copy'), COPIED_RESET_MS);
  });
  actions.appendChild(copy);
  bubble.appendChild(actions);
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* clipboard may be unavailable; ignore */
  }
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
