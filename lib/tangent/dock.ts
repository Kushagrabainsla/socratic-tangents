// Stack minimized tangent pills so they never pile up on the same spot. Each minimized card sits in a
// vertical dock anchored to the bottom-right; opening, closing, or minimizing another one re-flows the
// rest so every pill stays reachable.

/** Resting position of the lowest pill, matching `.st-card.st-min` in styles.ts. */
const BOTTOM_PX = 96;
/** Vertical step between pills. Pills are single-line, so this fixed slot leaves a consistent gap. */
const SLOT_PX = 44;

const docked: HTMLElement[] = [];

/** Add a card to the pill dock (idempotent) and re-flow. */
export function dockPill(card: HTMLElement): void {
  if (!docked.includes(card)) docked.push(card);
  layout();
}

/** Remove a card from the dock, clear the offset we set, and re-flow the rest. */
export function undockPill(card: HTMLElement): void {
  const index = docked.indexOf(card);
  if (index === -1) return;
  docked.splice(index, 1);
  card.style.removeProperty('bottom');
  layout();
}

function layout(): void {
  docked.forEach((card, index) => {
    card.style.bottom = `${BOTTOM_PX + index * SLOT_PX}px`;
  });
}
