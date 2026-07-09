import { describe, expect, it } from 'vitest';
import { parseTangents } from './import';
import { toJson } from './export';
import type { Tangent } from './model';

function tangent(overrides: Partial<Tangent> = {}): Tangent {
  return {
    id: 't1',
    conversationId: 'c1',
    anchor: { messageId: 'm1', quotedText: 'passage', textHash: 'h' },
    messages: [
      { role: 'user', text: 'why?' },
      { role: 'assistant', text: 'because' },
    ],
    hiddenTurnIds: ['turn-1'],
    title: 'why?',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('parseTangents', () => {
  it('round-trips a clean export', () => {
    const tangents = [tangent()];
    expect(parseTangents(toJson(tangents))).toEqual(tangents);
  });

  it('throws when the JSON is not an array', () => {
    expect(() => parseTangents('{"id":"t1"}')).toThrow();
  });

  it('skips entries without an id or conversation id', () => {
    const json = JSON.stringify([
      tangent({ id: 'good' }),
      { conversationId: 'c1' },
      { id: 'no-conv' },
      42,
      null,
    ]);
    const parsed = parseTangents(json);
    expect(parsed.map((t) => t.id)).toEqual(['good']);
  });

  it('drops malformed messages', () => {
    const json = JSON.stringify([
      {
        id: 't1',
        conversationId: 'c1',
        messages: [
          { role: 'user', text: 'ok' },
          { role: 'system', text: 'nope' },
          { role: 'assistant', text: 42 },
          'garbage',
        ],
      },
    ]);
    const [parsed] = parseTangents(json);
    expect(parsed?.messages).toEqual([{ role: 'user', text: 'ok' }]);
  });

  it('fills defaults for missing optional fields', () => {
    const json = JSON.stringify([
      { id: 't1', conversationId: 'c1', messages: [{ role: 'user', text: 'a long enough question' }] },
    ]);
    const [parsed] = parseTangents(json);
    expect(parsed?.hiddenTurnIds).toEqual([]);
    expect(parsed?.title).toBe('a long enough question');
    expect(typeof parsed?.createdAt).toBe('number');
    expect(parsed?.anchor.quotedText).toBe('');
  });

  it('keeps only string turn ids', () => {
    const json = JSON.stringify([{ id: 't1', conversationId: 'c1', hiddenTurnIds: ['a', 1, null, 'b'] }]);
    const [parsed] = parseTangents(json);
    expect(parsed?.hiddenTurnIds).toEqual(['a', 'b']);
  });

  it('preserves rich assistant html and drops non-string html', () => {
    const json = JSON.stringify([
      {
        id: 't1',
        conversationId: 'c1',
        messages: [
          { role: 'assistant', text: 'code', html: '<pre><code>x</code></pre>' },
          { role: 'user', text: 'q', html: 42 },
        ],
      },
    ]);
    const [parsed] = parseTangents(json);
    expect(parsed?.messages[0]).toEqual({
      role: 'assistant',
      text: 'code',
      html: '<pre><code>x</code></pre>',
    });
    expect(parsed?.messages[1]).toEqual({ role: 'user', text: 'q' });
  });
});
