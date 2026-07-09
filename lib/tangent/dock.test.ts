import { afterEach, describe, expect, it } from 'vitest';
import { dockPill, undockPill } from './dock';

const created: HTMLElement[] = [];
function pill(): HTMLElement {
  const el = document.createElement('div');
  created.push(el);
  return el;
}

afterEach(() => {
  for (const el of created) undockPill(el);
  created.length = 0;
});

describe('pill dock', () => {
  it('places the first pill at the resting position', () => {
    const a = pill();
    dockPill(a);
    expect(a.style.bottom).toBe('96px');
  });

  it('stacks additional pills so they do not overlap', () => {
    const [a, b, c] = [pill(), pill(), pill()];
    dockPill(a);
    dockPill(b);
    dockPill(c);
    expect([a.style.bottom, b.style.bottom, c.style.bottom]).toEqual(['96px', '140px', '184px']);
  });

  it('is idempotent when the same pill docks twice', () => {
    const [a, b] = [pill(), pill()];
    dockPill(a);
    dockPill(b);
    dockPill(a);
    expect([a.style.bottom, b.style.bottom]).toEqual(['96px', '140px']);
  });

  it('re-flows the stack and clears the offset when a pill leaves', () => {
    const [a, b, c] = [pill(), pill(), pill()];
    dockPill(a);
    dockPill(b);
    dockPill(c);
    undockPill(b);
    expect(b.style.bottom).toBe('');
    expect([a.style.bottom, c.style.bottom]).toEqual(['96px', '140px']);
  });

  it('ignores undocking a pill that was never docked', () => {
    const a = pill();
    expect(() => undockPill(a)).not.toThrow();
    expect(a.style.bottom).toBe('');
  });
});
