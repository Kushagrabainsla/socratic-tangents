import { describe, expect, it } from 'vitest';
import type { Tangent } from './model';
import { exportFilename, toJson, toMarkdown } from './export';

function tangent(overrides: Partial<Tangent> = {}): Tangent {
  return {
    id: 't1',
    conversationId: 'conv-12345678-abcd',
    anchor: { messageId: 'm1', quotedText: 'the passage', textHash: 'h' },
    messages: [
      { role: 'user', text: 'why?' },
      { role: 'assistant', text: 'because reasons' },
    ],
    hiddenTurnIds: [],
    title: 'why?',
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

describe('toMarkdown', () => {
  it('renders the title, quoted passage, and the exchange', () => {
    const md = toMarkdown([tangent()]);
    expect(md).toContain('## why?');
    expect(md).toContain('> the passage');
    expect(md).toContain('**You:** why?');
    expect(md).toContain('because reasons');
  });

  it('separates multiple tangents with a rule', () => {
    const md = toMarkdown([tangent({ id: 'a' }), tangent({ id: 'b', title: 'second' })]);
    expect(md).toContain('---');
    expect(md).toContain('## second');
  });

  it('uses a placeholder title when missing', () => {
    expect(toMarkdown([tangent({ title: '' })])).toContain('## Untitled tangent');
  });
});

describe('toJson', () => {
  it('round-trips the tangents', () => {
    const tangents = [tangent()];
    expect(JSON.parse(toJson(tangents))).toEqual(tangents);
  });
});

describe('exportFilename', () => {
  const date = new Date('2026-06-26T10:00:00Z');

  it('includes a short conversation id and the date', () => {
    expect(exportFilename('conv-12345678-abcd', 'md', date)).toBe('socratic-tangents-conv-123-2026-06-26.md');
  });

  it('omits the id segment when there is no conversation', () => {
    expect(exportFilename('', 'json', date)).toBe('socratic-tangents-2026-06-26.json');
  });
});
