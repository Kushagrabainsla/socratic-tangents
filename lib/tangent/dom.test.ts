import { describe, expect, it } from 'vitest';
import { hostMatches, pick, sleep } from './dom';

describe('hostMatches', () => {
  it('matches an exact bare host', () => {
    expect(hostMatches('claude.ai', 'claude.ai')).toBe(true);
  });

  it('matches subdomains of a bare host', () => {
    expect(hostMatches('claude.ai', 'www.claude.ai')).toBe(true);
  });

  it('treats a wildcard pattern like its bare host', () => {
    expect(hostMatches('*.chatgpt.com', 'chatgpt.com')).toBe(true);
    expect(hostMatches('*.chatgpt.com', 'app.chatgpt.com')).toBe(true);
  });

  it('does not match a lookalike host', () => {
    expect(hostMatches('chatgpt.com', 'evilchatgpt.com')).toBe(false);
    expect(hostMatches('claude.ai', 'notclaude.ai')).toBe(false);
  });
});

describe('pick', () => {
  it('returns the first matching selector in order', () => {
    const root = document.createElement('div');
    root.innerHTML = '<span class="a">A</span><span class="b">B</span>';
    expect(pick(root, ['.missing', '.b', '.a'])?.textContent).toBe('B');
  });

  it('returns null when nothing matches', () => {
    const root = document.createElement('div');
    expect(pick(root, ['.nope'])).toBeNull();
  });

  it("ignores the extension's own injected UI (data-st-ui)", () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div data-st-ui="1"><button class="x">ours</button></div><button class="x">page</button>';
    expect(pick(root, ['.x'])?.textContent).toBe('page');
  });
});

describe('sleep', () => {
  it('resolves after the given delay', async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });
});
