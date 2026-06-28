import { beforeEach, describe, expect, it, vi } from 'vitest';

// An in-memory stand-in for extension storage. `raw` is the backing object so tests can seed legacy
// data directly; the mock reads and writes it the way browser.storage.local would.
const { raw, storage } = vi.hoisted(() => {
  const data: Record<string, unknown> = {};
  return {
    raw: data,
    storage: {
      local: {
        get: async (key: string) => ({ [key]: data[key] }),
        set: async (items: Record<string, unknown>) => {
          Object.assign(data, items);
        },
      },
      onChanged: { addListener: () => {}, removeListener: () => {} },
    },
  };
});

vi.mock('wxt/browser', () => ({ browser: { storage } }));

import type { Tangent } from './model';
import { listByConversation, removeTangent, saveTangent } from './store';

const KEY = 'st:tangents';

function tangent(overrides: Partial<Tangent> = {}): Tangent {
  return {
    id: 't1',
    conversationId: 'c1',
    anchor: { messageId: 'm1', quotedText: 'q', textHash: 'h' },
    messages: [{ role: 'user', text: 'hi' }],
    hiddenTurnIds: [],
    title: 'hi',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(raw)) delete raw[key];
});

describe('saveTangent / listByConversation', () => {
  it('saves and lists a tangent by conversation', async () => {
    await saveTangent(tangent({ id: 'a', conversationId: 'c1' }));
    const list = await listByConversation('c1');
    expect(list.map((t) => t.id)).toEqual(['a']);
  });

  it('filters by conversation and sorts by creation time', async () => {
    await saveTangent(tangent({ id: 'b', conversationId: 'c1', createdAt: 2 }));
    await saveTangent(tangent({ id: 'a', conversationId: 'c1', createdAt: 1 }));
    await saveTangent(tangent({ id: 'x', conversationId: 'c2', createdAt: 1 }));
    expect((await listByConversation('c1')).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('returns an empty list for a blank conversation id', async () => {
    await saveTangent(tangent({ id: 'a', conversationId: 'c1' }));
    expect(await listByConversation('')).toEqual([]);
  });

  it('normalizes legacy tangents that lack hiddenTurnIds', async () => {
    raw[KEY] = {
      a: {
        id: 'a',
        conversationId: 'c1',
        anchor: { messageId: 'm', quotedText: 'q', textHash: 'h' },
        messages: [],
        title: '',
        createdAt: 1,
        updatedAt: 1,
      },
    };
    const [restored] = await listByConversation('c1');
    expect(restored?.hiddenTurnIds).toEqual([]);
  });
});

describe('removeTangent', () => {
  it('removes a tangent', async () => {
    await saveTangent(tangent({ id: 'a', conversationId: 'c1' }));
    await removeTangent('a');
    expect(await listByConversation('c1')).toEqual([]);
  });
});

describe('storage cap', () => {
  it('evicts the least-recently-updated when over the limit', async () => {
    for (let i = 1; i <= 1001; i++) {
      await saveTangent(tangent({ id: `t${i}`, conversationId: 'c1', createdAt: i, updatedAt: i }));
    }
    const list = await listByConversation('c1');
    const ids = new Set(list.map((t) => t.id));
    expect(list).toHaveLength(1000);
    expect(ids.has('t1001')).toBe(true);
    expect(ids.has('t1')).toBe(false);
  });
});
