import { browser } from 'wxt/browser';
import type { Tangent } from './model';

// Local persistence for tangents. Single responsibility: read/write the model to extension
// storage. Everything is keyed under one entry; swap this file for IndexedDB later without
// touching callers.

const KEY = 'st:tangents';

/** Flag for whether the first-run hint has been shown. */
const ONBOARDED_KEY = 'st:onboarded';

/** Upper bound on stored tangents. We can't see deleted conversations, so cap total and evict the
 *  least-recently-updated first. Generous enough that normal use never hits it. */
const MAX_TANGENTS = 1000;

type TangentMap = Record<string, Tangent>;

async function readAll(): Promise<TangentMap> {
  const result = await browser.storage.local.get(KEY);
  return (result[KEY] as TangentMap | undefined) ?? {};
}

async function writeAll(all: TangentMap, keepId?: string): Promise<void> {
  try {
    await browser.storage.local.set({ [KEY]: all });
  } catch {
    // Most likely the storage quota. If we know which save to protect, drop the oldest quarter and
    // retry once; otherwise leave storage as-is rather than crash the page.
    if (!keepId) return;
    pruneToLimit(all, keepId, Math.floor(MAX_TANGENTS * 0.75));
    try {
      await browser.storage.local.set({ [KEY]: all });
    } catch {
      /* still full after pruning: drop this save rather than throw inside the page */
    }
  }
}

/** Keep at most `limit` tangents, evicting the least-recently-updated first. Never drops `keepId`. */
function pruneToLimit(all: TangentMap, keepId: string, limit: number): void {
  const entries = Object.values(all);
  let excess = entries.length - limit;
  if (excess <= 0) return;
  const oldestFirst = entries.filter((t) => t.id !== keepId).sort((a, b) => a.updatedAt - b.updatedAt);
  for (const tangent of oldestFirst) {
    if (excess <= 0) break;
    delete all[tangent.id];
    excess--;
  }
}

/** Older stored tangents predate some fields; fill defaults so callers see a complete model. */
function normalize(tangent: Tangent): Tangent {
  return { ...tangent, hiddenTurnIds: tangent.hiddenTurnIds ?? [] };
}

export async function listByConversation(conversationId: string): Promise<Tangent[]> {
  if (!conversationId) return [];
  const all = await readAll();
  return Object.values(all)
    .filter((tangent) => tangent.conversationId === conversationId)
    .map(normalize)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveTangent(tangent: Tangent): Promise<void> {
  const all = await readAll();
  all[tangent.id] = tangent;
  pruneToLimit(all, tangent.id, MAX_TANGENTS);
  await writeAll(all, tangent.id);
}

export async function removeTangent(id: string): Promise<void> {
  const all = await readAll();
  delete all[id];
  await writeAll(all);
}

type ChangeHandler = Parameters<typeof browser.storage.onChanged.addListener>[0];

/** Call `onChange` whenever tangents change (e.g. edited in another tab). Returns an unsubscribe. */
export function onTangentsChanged(onChange: () => void): () => void {
  const handler: ChangeHandler = (changes, area) => {
    if (area === 'local' && KEY in changes) onChange();
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}

export async function hasOnboarded(): Promise<boolean> {
  const result = await browser.storage.local.get(ONBOARDED_KEY);
  return result[ONBOARDED_KEY] === true;
}

export async function markOnboarded(): Promise<void> {
  await browser.storage.local.set({ [ONBOARDED_KEY]: true });
}
