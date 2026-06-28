import { describe, expect, it } from 'vitest';
import type { LLMAdapter } from '../adapters/types';
import { createAnchor, resolveAnchor } from './anchor';

// A minimal adapter that only implements what anchoring touches. Each assistant element gets a stable
// id via a data attribute; everything else is left unimplemented.
function fakeAdapter(elements: HTMLElement[]): LLMAdapter {
  const byId = new Map(elements.map((el) => [el.dataset.id ?? '', el]));
  return {
    messageId: (el: HTMLElement) => el.dataset.id ?? '',
    findMessageById: (id: string) => byId.get(id) ?? null,
    messageElements: () => elements,
    isAssistant: (el: HTMLElement) => el.dataset.role === 'assistant',
  } as unknown as LLMAdapter;
}

function assistant(id: string, text: string): HTMLElement {
  const el = document.createElement('div');
  el.dataset.id = id;
  el.dataset.role = 'assistant';
  el.textContent = text;
  return el;
}

describe('createAnchor', () => {
  it('captures the message id, quoted text, and a text hash', () => {
    const el = assistant('m1', 'the full message body');
    const anchor = createAnchor(fakeAdapter([el]), el, 'full message');
    expect(anchor.messageId).toBe('m1');
    expect(anchor.quotedText).toBe('full message');
    expect(anchor.textHash).not.toBe('');
  });
});

describe('resolveAnchor', () => {
  it('resolves by stable id first', () => {
    const el = assistant('m1', 'hello there');
    const adapter = fakeAdapter([el]);
    const anchor = createAnchor(adapter, el, 'hello');
    expect(resolveAnchor(adapter, anchor)).toBe(el);
  });

  it('falls back to a full-text hash match when the id is gone', () => {
    const original = assistant('m1', 'a stable body of text');
    const anchor = createAnchor(fakeAdapter([original]), original, 'stable body');

    const reRendered = assistant('m2', 'a stable body of text');
    expect(resolveAnchor(fakeAdapter([reRendered]), anchor)).toBe(reRendered);
  });

  it('falls back to a quoted-text substring match', () => {
    const original = assistant('m1', 'the original body');
    const anchor = createAnchor(fakeAdapter([original]), original, 'original');

    const edited = assistant('m2', 'the original body, now with an edit appended');
    expect(resolveAnchor(fakeAdapter([edited]), anchor)).toBe(edited);
  });

  it('returns null when no message matches', () => {
    const original = assistant('m1', 'gone for good');
    const anchor = createAnchor(fakeAdapter([original]), original, 'gone');

    const unrelated = assistant('m2', 'completely different content');
    expect(resolveAnchor(fakeAdapter([unrelated]), anchor)).toBeNull();
  });
});
