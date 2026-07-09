import { describe, expect, it } from 'vitest';
import { decidePlacement } from './placement';

const H = 1000; // viewport height for these cases

describe('decidePlacement', () => {
  it('follows the passage when it is on screen and the bubble fits', () => {
    expect(decidePlacement(300, 360, 380, false, H)).toEqual({ mode: 'follow', releasePin: false });
  });

  it('minimizes when the passage has scrolled off the top', () => {
    expect(decidePlacement(-200, -50, -30, false, H)).toEqual({ mode: 'min', releasePin: false });
  });

  it('minimizes when the passage is visible but the bubble would sit too low to fit', () => {
    expect(decidePlacement(950, 990, 990, false, H)).toEqual({ mode: 'min', releasePin: false });
  });

  it('keeps a pinned bubble in place while its passage is visible', () => {
    // desiredTop is irrelevant when pinned; the bubble stays where the user dragged it.
    expect(decidePlacement(200, 260, 999, true, H)).toEqual({ mode: 'pinned', releasePin: false });
  });

  it('collapses a pinned bubble and releases the pin once its passage leaves', () => {
    expect(decidePlacement(1200, 1300, 0, true, H)).toEqual({ mode: 'min', releasePin: true });
  });
});
