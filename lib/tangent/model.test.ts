import { describe, expect, it } from 'vitest';
import { hashText, newId, titleFrom } from './model';

describe('hashText', () => {
  it('is stable for the same text', () => {
    expect(hashText('hello world')).toBe(hashText('hello world'));
  });

  it('ignores surrounding and collapsed whitespace', () => {
    expect(hashText('  hello   world  ')).toBe(hashText('hello world'));
    expect(hashText('hello\nworld')).toBe(hashText('hello world'));
  });

  it('differs for different text', () => {
    expect(hashText('hello world')).not.toBe(hashText('hello there'));
  });

  it('returns a base36 string', () => {
    expect(hashText('anything')).toMatch(/^[0-9a-z]+$/);
  });
});

describe('titleFrom', () => {
  it('keeps a short question as-is', () => {
    expect(titleFrom('What is recursion?')).toBe('What is recursion?');
  });

  it('collapses whitespace', () => {
    expect(titleFrom('  what   is\nthis  ')).toBe('what is this');
  });

  it('truncates long questions with an ellipsis at 48 chars', () => {
    const long = 'a'.repeat(100);
    const title = titleFrom(long);
    expect(title).toHaveLength(48);
    expect(title.endsWith('…')).toBe(true);
  });
});

describe('newId', () => {
  it('is prefixed and unique across calls', () => {
    const a = newId();
    const b = newId();
    expect(a.startsWith('t_')).toBe(true);
    expect(a).not.toBe(b);
  });
});
