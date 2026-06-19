import type { LLMAdapter } from '../adapters/types';
import { askTangent } from './engine';
import { isDark } from './theme';

const MAX_WIDTH = 420;

/**
 * Open a floating "thought bubble" anchored to `msgEl`, about `passage`. It tracks the passage as
 * the page scrolls and collapses to a side pill when the passage is off-screen. Asking drives the
 * provider's composer and renders the captured answer natively. Provider-agnostic via `adapter`.
 */
export function openBubble(adapter: LLMAdapter, passage: string, msgEl: HTMLElement, rect: DOMRect): void {
  const card = document.createElement('div');
  card.className = 'st-card';
  card.dataset.stTheme = isDark() ? 'dark' : 'light';
  card.innerHTML = `
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
  (card.querySelector('.st-quote') as HTMLElement).textContent = passage;
  document.body.appendChild(card);

  const thread = card.querySelector('.st-thread') as HTMLElement;
  const input = card.querySelector('.st-input') as HTMLTextAreaElement;
  const send = card.querySelector('.st-send') as HTMLButtonElement;

  // ── tracking ──────────────────────────────────────────────────────────────
  // Hosts scroll an inner container (window.scrollY stays 0), so we follow the message element's
  // live viewport rect each frame and collapse to a side pill when it leaves the screen.
  const width = Math.min(MAX_WIDTH, window.innerWidth - 24);
  const origin = msgEl.getBoundingClientRect();
  const offsetX = rect.left - origin.left;
  const offsetY = rect.bottom - origin.top;
  let running = true;
  function place() {
    const m = msgEl.getBoundingClientRect();
    const topVp = m.top + offsetY;
    const onScreen = topVp > 8 && topVp < window.innerHeight - 80 && m.bottom > 0 && m.top < window.innerHeight;
    if (onScreen) {
      card.classList.remove('st-min');
      card.style.width = `${width}px`;
      card.style.left = `${Math.max(12, Math.min(m.left + offsetX, window.innerWidth - width - 12))}px`;
      card.style.top = `${topVp}px`;
    } else {
      card.classList.add('st-min');
      card.style.removeProperty('width');
      card.style.removeProperty('left');
      card.style.removeProperty('top');
    }
  }
  (function loop() {
    if (!running) return;
    place();
    requestAnimationFrame(loop);
  })();

  card.addEventListener('click', () => {
    if (card.classList.contains('st-min')) msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  card.querySelector('.st-card-close')!.addEventListener('click', (e) => {
    e.stopPropagation();
    running = false;
    card.remove();
  });

  // ── composer ──────────────────────────────────────────────────────────────
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void ask();
    }
  });
  send.addEventListener('click', () => void ask());
  requestAnimationFrame(() => input.focus());

  async function ask() {
    const question = input.value.trim();
    if (!question || send.disabled) return;
    input.value = '';
    input.style.height = 'auto';

    addBubble(thread, 'user', question).textContent = question;
    const answer = addBubble(thread, 'assistant', '…');
    answer.classList.add('st-thinking');
    send.disabled = true;
    try {
      const node = await askTangent(adapter, passage, question);
      answer.classList.remove('st-thinking');
      answer.replaceChildren(node);
    } catch (err) {
      answer.classList.remove('st-thinking');
      answer.textContent = `⚠️ ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      send.disabled = false;
      msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); // back to the passage
      setTimeout(() => input.focus(), 350);
    }
  }
}

function addBubble(thread: HTMLElement, role: 'user' | 'assistant', text: string): HTMLElement {
  const bubble = document.createElement('div');
  bubble.className = `st-msg st-${role}`;
  bubble.textContent = text;
  thread.appendChild(bubble);
  return bubble;
}
