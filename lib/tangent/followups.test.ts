import { describe, expect, it } from 'vitest';
import { parseFollowups, stripFollowups } from './followups';

function node(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('parseFollowups', () => {
  it('splits on the separator, trims, and drops blanks', () => {
    expect(parseFollowups(' a? | b? |  | c? ')).toEqual(['a?', 'b?', 'c?']);
  });

  it('caps at three questions', () => {
    expect(parseFollowups('a | b | c | d | e')).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for empty input', () => {
    expect(parseFollowups('   ')).toEqual([]);
  });
});

describe('stripFollowups', () => {
  it('extracts the questions and removes the sentinel block from the answer', () => {
    const el = node('<p>The answer.</p><p>↪FOLLOWUPS: What next? | Why?</p>');
    const questions = stripFollowups(el);
    expect(questions).toEqual(['What next?', 'Why?']);
    expect(el.textContent).toBe('The answer.');
    expect(el.querySelector('p')?.textContent).toBe('The answer.');
  });

  it('returns nothing and leaves the answer untouched when there is no sentinel', () => {
    const el = node('<p>Just an answer.</p>');
    expect(stripFollowups(el)).toEqual([]);
    expect(el.textContent).toBe('Just an answer.');
  });

  it('handles a plain-text answer by trimming the sentinel off the text', () => {
    const el = document.createElement('div');
    el.textContent = 'A short answer. ↪FOLLOWUPS: More? | Less?';
    expect(stripFollowups(el)).toEqual(['More?', 'Less?']);
    expect(el.textContent).toBe('A short answer.');
  });
});
