import type { LLMAdapter } from '../adapters/types';
import { askTangent } from './engine';
import { dockPill, undockPill } from './dock';
import { stripFollowups } from './followups';
import { TRASH_ICON } from './icons';
import { titleFrom, type Tangent, type TangentMessage } from './model';
import { decidePlacement } from './placement';
import { sanitizeHtml, toSafeHtml } from './sanitize';
import { isDark } from './theme';

const MAX_WIDTH = 420;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 220;
const MAX_RESIZE_WIDTH = 680;
const MARGIN = 12;
const REFOCUS_DELAY_MS = 350;
const COPIED_RESET_MS = 1200;
const ANCHORED_CLASS = 'st-anchored';

/** Handles for every open bubble, keyed by its root tangent id. Lets the manager dispose, re-point,
 *  or reconcile a bubble's drill path without reaching into the DOM. */
interface OpenBubble {
  close: () => void;
  navigate: (stack: Tangent[], msgEl?: HTMLElement, rect?: DOMRect) => void;
  reconcile: (survivingIds: Set<string>) => void;
}
const openBubbles = new Map<string, OpenBubble>();

/** Close every open bubble (used when navigating between conversations). */
export function closeAllBubbles(): void {
  for (const bubble of [...openBubbles.values()]) bubble.close();
}

/** After a delete, trim every open bubble's drill path to the tangents that still exist. */
export function reconcileBubbles(survivingIds: Set<string>): void {
  for (const bubble of [...openBubbles.values()]) bubble.reconcile(survivingIds);
}

const CARD_TEMPLATE = `
  <div class="st-card-head">
    <button class="st-icon st-back" title="Back" aria-label="Back to parent tangent">‹</button>
    <span class="st-card-label">↳ Tangent</span>
    <div class="st-card-actions">
      <button class="st-icon st-regen" title="Regenerate last answer" aria-label="Regenerate last answer">↻</button>
      <button class="st-icon st-del" title="Delete tangent" aria-label="Delete tangent">${TRASH_ICON}</button>
      <button class="st-icon st-card-close" title="Close" aria-label="Close tangent">✕</button>
    </div>
  </div>
  <div class="st-quote"></div>
  <div class="st-thread" aria-live="polite"></div>
  <div class="st-quickbar">
    <button class="st-chip" data-q="Explain this more simply.">Simpler</button>
    <button class="st-chip" data-q="Give a concrete example.">Example</button>
    <button class="st-chip" data-q="Why does this matter?">Why?</button>
    <button class="st-chip" data-q="Go deeper on this.">Go deeper</button>
  </div>
  <div class="st-composer">
    <textarea class="st-input" rows="1" placeholder="Ask about this…" aria-label="Ask about this passage"></textarea>
    <button class="st-send" title="Send" aria-label="Send">↑</button>
  </div>
  <div class="st-resize" title="Resize" aria-hidden="true"></div>`;

export interface BubbleParams {
  adapter: LLMAdapter;
  /** The drill path to open at: root first, the tangent to show last. A single-element stack opens a
   *  root tangent; a longer one opens a nested tangent with its ancestors behind it. */
  stack: Tangent[];
  msgEl: HTMLElement;
  rect: DOMRect;
  onUpdate: (tangent: Tangent) => void;
  onDelete: (id: string) => void;
  /** Create a child tangent branched off `parentId`'s answer, or null if the parent is gone. */
  onCreateChild: (parentId: string, passage: string) => Tangent | null;
}

/** The bubble's live drill path (root .. current). The visible top drives the quote/thread/composer. */
interface Nav {
  stack: Tangent[];
}

function top(nav: Nav): Tangent {
  return nav.stack[nav.stack.length - 1]!;
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
  /** Set when the bubble is closed/deleted/navigated away, so an in-flight generation that resolves
   *  afterwards does not re-persist a deleted tangent or touch the removed card. */
  disposed: boolean;
}

/**
 * Open a floating thought bubble for a tangent, or navigate an already-open one to a new drill path.
 * The card holds a stack of tangents (root .. current): the visible top drives the quote, thread, and
 * composer; selecting text in an answer pushes a child, and the back button pops. It tracks the root's
 * passage, collapses to a side pill off-screen, streams answers live, and persists each exchange.
 */
export function openBubble(params: BubbleParams): void {
  const { adapter, stack, msgEl, rect } = params;
  const rootId = stack[0]!.id;

  const existing = openBubbles.get(rootId);
  if (existing) {
    existing.navigate(stack, msgEl, rect);
    return;
  }

  const card = createCard();
  card.dataset.rootId = rootId;
  document.body.appendChild(card);

  // The host element the card is anchored to. Mutable so reopening can retarget it after the provider
  // virtualizes and re-creates the message.
  const anchor = { el: msgEl };
  anchor.el.classList.add(ANCHORED_CLASS);

  const pin: Pin = { active: false, left: 0, top: 0 };
  const size: Size = { width: Math.min(MAX_WIDTH, window.innerWidth - 24), height: 0 };
  const session: Session = { generating: false, lastQuestion: '', lastAnswer: null, disposed: false };
  const nav: Nav = { stack: [...stack] };
  const thread = card.querySelector('.st-thread') as HTMLElement;

  const drill = wireDrill(thread, session, (passage) => {
    const child = params.onCreateChild(top(nav).id, passage);
    if (!child) return;
    nav.stack.push(child);
    render();
    focusInput(card);
  });
  const render = () => {
    drill.hide(); // clear any pending drill affordance so it can't attach to the wrong parent
    renderView(card, thread, nav, session);
  };

  const ctx: ComposerContext = {
    adapter,
    nav,
    thread,
    session,
    msgEl: anchor.el,
    // Keep the header/pill label in step with the title once the first answer names the tangent.
    onUpdate: (updated) => {
      setCardLabel(card, top(nav));
      params.onUpdate(updated);
    },
  };

  let stopTracking = trackToPassage(card, anchor.el, rect, pin, size);

  const close = () => {
    if (!openBubbles.has(rootId)) return;
    openBubbles.delete(rootId);
    session.disposed = true;
    stopTracking();
    drill.dispose();
    undockPill(card);
    anchor.el.classList.remove(ANCHORED_CLASS);
    card.remove();
  };
  const back = () => {
    if (session.generating || nav.stack.length <= 1) return;
    nav.stack.pop();
    render();
    focusInput(card);
  };
  const navigate = (path: Tangent[], nextEl?: HTMLElement, nextRect?: DOMRect) => {
    if (session.generating || path.length === 0) return; // don't yank the view mid-generation
    nav.stack = [...path];
    if (nextEl && nextEl !== anchor.el) {
      anchor.el.classList.remove(ANCHORED_CLASS);
      nextEl.classList.add(ANCHORED_CLASS);
      stopTracking();
      anchor.el = nextEl;
      ctx.msgEl = nextEl;
      pin.active = false;
      stopTracking = trackToPassage(card, nextEl, nextRect ?? nextEl.getBoundingClientRect(), pin, size);
    }
    render();
    focusInput(card);
  };
  const reconcile = (surviving: Set<string>) => {
    let keep = 0;
    while (keep < nav.stack.length && surviving.has(nav.stack[keep]!.id)) keep++;
    if (keep === nav.stack.length) return; // nothing in this stack was removed
    // A removed node is always the shown top (deleting a stack node cascades to its deeper path). If
    // the top is generating, closing disposes the in-flight ask so it can't re-save a deleted tangent.
    if (keep === 0 || session.generating) {
      close();
      return;
    }
    nav.stack = nav.stack.slice(0, keep);
    render();
  };

  openBubbles.set(rootId, { close, navigate, reconcile });

  wireHeader(card, pin, close, back, () => params.onDelete(top(nav).id));
  enableResize(card.querySelector('.st-resize') as HTMLElement, card, size);
  wirePillExpand(card, () => anchor.el);
  wireKeyboard(card, () => (nav.stack.length > 1 && !session.generating ? back() : close()));
  wireComposer(card, ctx);
  render();
  focusInput(card);
}

function createCard(): HTMLElement {
  const card = document.createElement('div');
  card.className = 'st-card';
  card.dataset.stUi = '1';
  card.dataset.stTheme = isDark() ? 'dark' : 'light';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Tangent');
  card.innerHTML = CARD_TEMPLATE;
  return card;
}

/** Paint the card for the current top of the stack: label, quoted passage, back button, and thread. */
function renderView(card: HTMLElement, thread: HTMLElement, nav: Nav, session: Session): void {
  const current = top(nav);
  card.dataset.topTangentId = current.id;
  setCardLabel(card, current);
  (card.querySelector('.st-quote') as HTMLElement).textContent = current.anchor.quotedText;
  (card.querySelector('.st-back') as HTMLElement).style.display = nav.stack.length > 1 ? 'block' : 'none';
  session.lastQuestion = '';
  session.lastAnswer = null;
  thread.replaceChildren();
  restore(thread, current, session);
}

/** The header caption doubles as the pill label, so it shows the tangent's title once it has one. */
function setCardLabel(card: HTMLElement, tangent: Tangent): void {
  (card.querySelector('.st-card-label') as HTMLElement).textContent = `↳ ${tangent.title || 'Tangent'}`;
}

/** Show a "↳ Tangent" affordance when the user selects text inside this bubble's answer, so they can
 *  branch a nested tangent off it. Disabled while generating. Returns a cleanup for its listeners. */
function wireDrill(
  thread: HTMLElement,
  session: Session,
  onDrill: (passage: string) => void,
): { hide: () => void; dispose: () => void } {
  const btn = document.createElement('button');
  btn.className = 'st-tangent-btn';
  btn.dataset.stUi = '1';
  btn.textContent = '↳ Tangent';
  btn.title = 'Branch a tangent off this part';
  btn.setAttribute('aria-label', 'Branch a tangent off the selected answer text');
  btn.style.display = 'none';
  document.body.appendChild(btn);

  let pending = '';
  const hide = () => {
    btn.style.display = 'none';
    pending = '';
  };
  const update = () => {
    if (session.generating) return hide();
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (!sel || !text || sel.rangeCount === 0) return hide();
    const container = sel.getRangeAt(0).commonAncestorContainer;
    const el = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
    const answer = el?.closest('.st-assistant');
    if (!answer || !thread.contains(answer)) return hide();
    pending = text;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    btn.dataset.stTheme = isDark() ? 'dark' : 'light';
    btn.style.display = 'block';
    btn.style.top = `${Math.min(r.bottom + 6, window.innerHeight - 34)}px`;
    btn.style.left = `${Math.min(Math.max(8, r.left), window.innerWidth - 110)}px`;
  };
  const onMouseUp = () => setTimeout(update, 10);
  const onScroll = () => hide();
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('scroll', onScroll, true);
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!pending) return;
    const passage = pending;
    window.getSelection()?.removeAllRanges();
    hide();
    onDrill(passage);
  });

  return {
    hide,
    dispose: () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('scroll', onScroll, true);
      btn.remove();
    },
  };
}

function restore(thread: HTMLElement, tangent: Tangent, session: Session): void {
  for (const message of tangent.messages) {
    if (message.role === 'user') {
      appendMessage(thread, 'user', message.text);
      session.lastQuestion = message.text;
    } else {
      const bubble = appendAssistant(thread, message);
      addAnswerActions(bubble, message.text);
      if (message.suggestions?.length) renderFollowups(bubble, message.suggestions);
      session.lastAnswer = bubble;
    }
  }
}

/** Render a saved assistant answer, preferring its sanitized rich HTML so code, lists, and tables
 *  survive a reload; falls back to plain text for older tangents that stored only text. */
function appendAssistant(thread: HTMLElement, message: TangentMessage): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = 'st-msg st-assistant';
  if (message.html) bubble.appendChild(sanitizeHtml(message.html));
  else bubble.textContent = message.text;
  thread.appendChild(bubble);
  return bubble;
}

// ── header: drag, regenerate, delete, close ────────────────────────────────

function wireHeader(
  card: HTMLElement,
  pin: Pin,
  close: () => void,
  back: () => void,
  deleteCurrent: () => void,
): void {
  const head = card.querySelector('.st-card-head') as HTMLElement;
  enableDrag(head, card, pin);

  card.querySelector('.st-back')!.addEventListener('click', (e) => {
    e.stopPropagation();
    back();
  });
  card.querySelector('.st-card-close')!.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  card.querySelector('.st-del')!.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCurrent();
  });
}

function enableDrag(handle: HTMLElement, card: HTMLElement, pin: Pin): void {
  handle.addEventListener('mousedown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const rect = card.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    // Pin only once the mouse actually moves, so a bare click (e.g. tapping a pill to expand it)
    // never freezes the bubble at a stale position.
    const move = (ev: MouseEvent) => {
      pin.active = true;
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

function wireKeyboard(card: HTMLElement, onEscape: () => void): void {
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onEscape();
  });
}

// ── tracking ───────────────────────────────────────────────────────────────

interface Anchor {
  offsetX: number;
  offsetY: number;
}

/** User-set bubble size. `height` of 0 means content-driven (capped by max-height). */
interface Size {
  width: number;
  height: number;
}

/** The last layout written to the card, so the per-frame loop only touches the DOM when something
 *  actually changed. Redundant style writes each frame would dirty layout and force a reflow on the
 *  next read, thrashing a busy chat page for every open bubble. */
interface Applied {
  min: boolean;
  left: string;
  top: string;
  width: string;
  height: string;
}

function trackToPassage(
  card: HTMLElement,
  msgEl: HTMLElement,
  rect: DOMRect,
  pin: Pin,
  size: Size,
): () => void {
  const origin = msgEl.getBoundingClientRect();
  const anchor: Anchor = {
    offsetX: rect.left - origin.left,
    offsetY: rect.bottom - origin.top,
  };
  const applied: Applied = { min: false, left: '', top: '', width: '', height: '' };
  let running = true;
  const step = () => {
    if (!running) return;
    placeCard(card, msgEl, anchor, pin, size, applied);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  return () => {
    running = false;
  };
}

function placeCard(
  card: HTMLElement,
  msgEl: HTMLElement,
  anchor: Anchor,
  pin: Pin,
  size: Size,
  applied: Applied,
): void {
  const m = msgEl.getBoundingClientRect();
  const desiredTop = m.top + anchor.offsetY;
  const placement = decidePlacement(m.top, m.bottom, desiredTop, pin.active, window.innerHeight);
  if (placement.releasePin) pin.active = false;
  if (placement.mode === 'min') {
    applyMinimized(card, applied);
  } else if (placement.mode === 'pinned') {
    applyExpanded(card, applied, clampLeft(pin.left, size.width), clampTop(pin.top, card.offsetHeight), size);
  } else {
    const left = clampLeft(m.left + anchor.offsetX, size.width);
    applyExpanded(card, applied, left, clampTop(desiredTop, card.offsetHeight), size);
  }
}

/** Position and size the open card, writing only the properties that changed since the last frame. */
function applyExpanded(card: HTMLElement, applied: Applied, left: number, top: number, size: Size): void {
  const width = `${size.width}px`;
  const height = size.height > 0 ? `${size.height}px` : '';
  const leftPx = `${left}px`;
  const topPx = `${top}px`;
  if (applied.min) {
    card.classList.remove('st-min');
    applied.min = false;
    undockPill(card);
  }
  if (applied.width !== width) {
    card.style.width = width;
    applied.width = width;
  }
  if (applied.height !== height) {
    if (height) card.style.height = height;
    else card.style.removeProperty('height');
    applied.height = height;
  }
  if (applied.left !== leftPx) {
    card.style.left = leftPx;
    applied.left = leftPx;
  }
  if (applied.top !== topPx) {
    card.style.top = topPx;
    applied.top = topPx;
  }
}

/** Collapse the card to its side pill, clearing inline geometry so the CSS pill styles take over.
 *  Idempotent: once minimized, later frames do no DOM work until the passage returns on-screen. */
function applyMinimized(card: HTMLElement, applied: Applied): void {
  if (applied.min) return;
  applied.min = true;
  applied.left = applied.top = applied.width = applied.height = '';
  card.classList.add('st-min');
  card.style.removeProperty('width');
  card.style.removeProperty('height');
  card.style.removeProperty('left');
  card.style.removeProperty('top');
  dockPill(card);
}

/** Drag the bottom-right corner to resize. Updates `size`, which the placement loop reads each frame. */
function enableResize(handle: HTMLElement, card: HTMLElement, size: Size): void {
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = card.offsetWidth;
    const startHeight = card.offsetHeight;
    const move = (ev: MouseEvent) => {
      size.width = clamp(
        startWidth + ev.clientX - startX,
        MIN_WIDTH,
        Math.min(MAX_RESIZE_WIDTH, window.innerWidth - 24),
      );
      size.height = clamp(startHeight + ev.clientY - startY, MIN_HEIGHT, window.innerHeight - 24);
    };
    const up = () => {
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
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

function wirePillExpand(card: HTMLElement, getMsgEl: () => HTMLElement): void {
  card.addEventListener('click', () => {
    if (card.classList.contains('st-min')) scrollToPassage(getMsgEl());
  });
}

// ── composer: send, stop, stream, regenerate ───────────────────────────────

interface ComposerContext {
  adapter: LLMAdapter;
  nav: Nav;
  thread: HTMLElement;
  session: Session;
  msgEl: HTMLElement;
  onUpdate: (tangent: Tangent) => void;
}

function wireComposer(card: HTMLElement, ctx: ComposerContext): void {
  const input = card.querySelector('.st-input') as HTMLTextAreaElement;
  const send = card.querySelector('.st-send') as HTMLButtonElement;
  const regen = card.querySelector('.st-regen') as HTMLButtonElement;

  const syncSend = () => {
    if (!ctx.session.generating) send.disabled = input.value.trim() === '';
  };
  const setGenerating = (on: boolean) => {
    ctx.session.generating = on;
    send.textContent = on ? '■' : '↑';
    send.title = on ? 'Stop' : 'Send';
    send.setAttribute('aria-label', on ? 'Stop' : 'Send');
    send.classList.toggle('st-stop', on);
    regen.disabled = on;
    card
      .querySelectorAll<HTMLButtonElement>('.st-chip, .st-del, .st-back')
      .forEach((button) => (button.disabled = on));
    if (on) send.disabled = false;
    else syncSend();
  };

  const generate = (question: string, answer: HTMLElement, recordUser: boolean) =>
    runGeneration(ctx, question, answer, recordUser, setGenerating, () => input.focus());
  const ask = (question: string) => void sendQuestion(ctx, question, generate);

  input.addEventListener('input', () => {
    autoGrow(input);
    syncSend();
  });
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
  // One delegated handler for every chip (quick-action and suggested follow-up, live or restored).
  card.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('.st-chip');
    if (chip?.dataset.q && !ctx.session.generating) {
      e.stopPropagation();
      ask(chip.dataset.q);
    }
  });
  syncSend();
}

async function submit(
  ctx: ComposerContext,
  input: HTMLTextAreaElement,
  generate: (q: string, a: HTMLElement, recordUser: boolean) => Promise<void>,
): Promise<void> {
  const question = input.value.trim();
  if (!question || ctx.session.generating) return;
  resetInput(input);
  await sendQuestion(ctx, question, generate);
}

/** Ask a question (from the composer or a chip): append it, add a placeholder answer, and generate. */
async function sendQuestion(
  ctx: ComposerContext,
  question: string,
  generate: (q: string, a: HTMLElement, recordUser: boolean) => Promise<void>,
): Promise<void> {
  const q = question.trim();
  if (!q || ctx.session.generating) return;
  appendMessage(ctx.thread, 'user', q);
  const answer = startAnswer(ctx.thread);
  await generate(q, answer, true);
}

async function regenerate(
  ctx: ComposerContext,
  generate: (q: string, a: HTMLElement, recordUser: boolean) => Promise<void>,
): Promise<void> {
  const { session } = ctx;
  const tangent = top(ctx.nav);
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
  const tangent = top(ctx.nav);
  setGenerating(true);
  try {
    const { node, turnIds } = await askTangent(ctx.adapter, tangent.anchor.quotedText, question, (text) =>
      streamInto(answer, text),
    );
    if (ctx.session.disposed) return; // bubble was closed/deleted while generating
    const suggestions = stripFollowups(node);
    answer.classList.remove('st-thinking');
    answer.replaceChildren(node);
    const text = node.textContent ?? '';
    const html = toSafeHtml(node);
    addAnswerActions(answer, text);
    renderFollowups(answer, suggestions);
    recordExchange(tangent, question, text, html, suggestions, recordUser);
    recordTurnIds(tangent, turnIds);
    ctx.session.lastQuestion = question;
    ctx.session.lastAnswer = answer;
    ctx.onUpdate(tangent);
  } catch (err) {
    if (ctx.session.disposed) return;
    answer.classList.remove('st-thinking');
    answer.textContent = `⚠️ ${describeError(err)}`;
  } finally {
    if (!ctx.session.disposed) {
      setGenerating(false);
      scrollToPassage(ctx.msgEl);
      setTimeout(refocus, REFOCUS_DELAY_MS);
    }
  }
}

function streamInto(answer: HTMLElement, text: string): void {
  answer.classList.remove('st-thinking');
  answer.textContent = text;
}

function recordExchange(
  tangent: Tangent,
  question: string,
  answer: string,
  answerHtml: string,
  suggestions: string[],
  recordUser: boolean,
): void {
  if (recordUser) tangent.messages.push({ role: 'user', text: question });
  const message: TangentMessage = { role: 'assistant', text: answer, html: answerHtml };
  if (suggestions.length > 0) message.suggestions = suggestions;
  tangent.messages.push(message);
  if (!tangent.title) tangent.title = titleFrom(question);
}

/** Remember the provider ids of the turns this ask added, so they can be re-hidden after a reload. */
function recordTurnIds(tangent: Tangent, turnIds: string[]): void {
  const seen = new Set(tangent.hiddenTurnIds);
  for (const id of turnIds) {
    if (!seen.has(id)) {
      seen.add(id);
      tangent.hiddenTurnIds.push(id);
    }
  }
}

/** Offer suggested follow-up questions as one-tap chips under an answer. A delegated click handler on
 *  the card (see wireComposer) turns a chip into a new question, so restored chips work too. */
function renderFollowups(bubble: HTMLElement, questions: string[]): void {
  if (questions.length === 0) return;
  const row = document.createElement('div');
  row.className = 'st-followups';
  for (const question of questions) {
    const chip = document.createElement('button');
    chip.className = 'st-chip st-followup';
    chip.textContent = question;
    chip.dataset.q = question;
    row.appendChild(chip);
  }
  bubble.appendChild(row);
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
