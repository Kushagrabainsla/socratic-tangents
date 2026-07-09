import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDark } from './theme';

// Browsers report a transparent background as rgba(0,0,0,0). Reading that naively as "black" would
// flip a light page to dark, so the transparent case must defer to the OS preference instead.

afterEach(() => {
  document.body.removeAttribute('style');
  document.documentElement.removeAttribute('style');
  vi.unstubAllGlobals();
});

function prefersDark(matches: boolean): void {
  vi.stubGlobal('matchMedia', () => ({ matches }) as MediaQueryList);
}

describe('isDark', () => {
  it('reads a dark background from the page body', () => {
    document.body.style.backgroundColor = 'rgb(42, 42, 42)';
    expect(isDark()).toBe(true);
  });

  it('reads a light background from the page body', () => {
    document.body.style.backgroundColor = 'rgb(255, 255, 255)';
    expect(isDark()).toBe(false);
  });

  it('ignores a fully transparent body and falls back to the OS preference', () => {
    document.body.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    prefersDark(false);
    expect(isDark()).toBe(false);
    prefersDark(true);
    expect(isDark()).toBe(true);
  });
});
