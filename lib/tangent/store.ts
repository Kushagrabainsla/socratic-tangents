import { browser } from 'wxt/browser';
import type { Tangent } from './model';

// Local persistence for tangents. Single responsibility: read/write the model to extension
// storage. Everything is keyed under one entry; swap this file for IndexedDB later without
// touching callers.

const KEY = 'st:tangents';

type TangentMap = Record<string, Tangent>;

async function readAll(): Promise<TangentMap> {
  const result = await browser.storage.local.get(KEY);
  return (result[KEY] as TangentMap | undefined) ?? {};
}

async function writeAll(all: TangentMap): Promise<void> {
  await browser.storage.local.set({ [KEY]: all });
}

export async function listByConversation(conversationId: string): Promise<Tangent[]> {
  if (!conversationId) return [];
  const all = await readAll();
  return Object.values(all)
    .filter((tangent) => tangent.conversationId === conversationId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveTangent(tangent: Tangent): Promise<void> {
  const all = await readAll();
  all[tangent.id] = tangent;
  await writeAll(all);
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
