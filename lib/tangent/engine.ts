import type { LLMAdapter } from '../adapters/types';
import { sleep } from './dom';

const ANSWER_TIMEOUT_MS = 150_000;
const STABLE_MS = 700;

/** How a tangent question is phrased to the model (passage as focused context). */
export function composePrompt(passage: string, question: string): string {
  const p = passage.trim();
  const q = question.trim();
  return p ? `Regarding this part: "${p}"\n\n${q}` : q;
}

/** The clean answer node plus the provider ids of the turns this ask added (so they can be re-hidden). */
export interface TangentAnswer {
  node: HTMLElement;
  turnIds: string[];
}

/**
 * Ask a tangent question and return the clean answer node. The send goes through the provider's
 * own composer (so it handles anti-abuse); the resulting turns are hidden from the main thread so
 * it stays visually untouched. Provider-agnostic: works for any LLMAdapter.
 */
export async function askTangent(
  adapter: LLMAdapter,
  passage: string,
  question: string,
  onProgress?: (text: string) => void,
): Promise<TangentAnswer> {
  const before = currentMessageIds(adapter);
  const hideObserver = hideNewTurns(adapter, before);
  try {
    await adapter.send(composePrompt(passage, question));
    const answerNode = await waitForAnswer(adapter, before, onProgress);
    return { node: adapter.cleanAnswer(answerNode), turnIds: newTurnIds(adapter, before) };
  } finally {
    hideObserver.disconnect();
  }
}

function currentMessageIds(adapter: LLMAdapter): Set<string> {
  return new Set(adapter.messageElements().map((el) => adapter.messageId(el)));
}

/** The ids of every turn added since `before` (the tangent's question and answer turns). */
function newTurnIds(adapter: LLMAdapter, before: Set<string>): string[] {
  return adapter
    .messageElements()
    .map((el) => adapter.messageId(el))
    .filter((id) => !before.has(id));
}

/** Re-hide previously-sent tangent turns (e.g. after a reload) so they leave no trace in the thread. */
export function hideTurns(adapter: LLMAdapter, ids: ReadonlySet<string>): void {
  if (ids.size === 0) return;
  for (const el of adapter.messageElements()) {
    if (ids.has(adapter.messageId(el))) adapter.turnWrapper(el).style.display = 'none';
  }
}

/** Hide every turn added after `before`, so a sent tangent leaves no trace in the thread. */
function hideNewTurns(adapter: LLMAdapter, before: Set<string>): MutationObserver {
  const hide = () => {
    for (const el of adapter.messageElements()) {
      if (!before.has(adapter.messageId(el))) adapter.turnWrapper(el).style.display = 'none';
    }
  };
  hide();
  const observer = new MutationObserver(hide);
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

/** Wait for a new assistant message to appear and finish streaming; return its element.
 *  `onProgress` is called with the growing text so callers can stream it live. */
async function waitForAnswer(
  adapter: LLMAdapter,
  before: Set<string>,
  onProgress?: (text: string) => void,
  timeoutMs = ANSWER_TIMEOUT_MS,
): Promise<HTMLElement> {
  const start = Date.now();
  let lastText = '';
  let stableSince = 0;
  while (Date.now() - start < timeoutMs) {
    const fresh = adapter
      .messageElements()
      .filter((el) => adapter.isAssistant(el) && !before.has(adapter.messageId(el)));
    const target = fresh[fresh.length - 1];
    // Hidden nodes report '' from innerText, so use textContent for stability checks.
    const text = target ? (target.textContent ?? '').trim() : '';
    if (text && text !== lastText) onProgress?.(text);
    if (target && text && !adapter.isStreaming() && text === lastText) {
      if (!stableSince) stableSince = Date.now();
      else if (Date.now() - stableSince > STABLE_MS) return target;
    } else {
      stableSince = 0;
    }
    lastText = text;
    await sleep(250);
  }
  throw new Error('timed out waiting for response');
}
