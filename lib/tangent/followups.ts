// Suggested follow-up questions. Rather than spend an extra hidden turn asking for them, we piggyback
// on the answer itself: every tangent question asks the model to end with a sentinel line listing a
// few follow-ups. We then strip that line out of the rendered answer and offer the questions as
// one-tap chips. If the model omits the line (or formats it oddly), nothing shows — it degrades
// quietly and never leaves the sentinel visible.

const SENTINEL = '↪FOLLOWUPS:';

/** Appended to every tangent question so the answer ends with follow-up suggestions. */
export const FOLLOWUP_REQUEST =
  `After your answer, add one final line beginning with "${SENTINEL}" listing up to 3 short, ` +
  'specific follow-up questions I might ask next, separated by " | ". Omit the line if there are none.';

/** Parse the text after the sentinel into up to three clean questions. */
export function parseFollowups(tail: string): string[] {
  return tail
    .split('|')
    .map((question) => question.trim())
    .filter((question) => question.length > 0)
    .slice(0, 3);
}

/** Remove the follow-up line from a rendered answer node (mutating it) and return the questions. */
export function stripFollowups(node: HTMLElement): string[] {
  const text = node.textContent ?? '';
  const at = text.indexOf(SENTINEL);
  if (at === -1) return [];
  const questions = parseFollowups(text.slice(at + SENTINEL.length));
  removeSentinel(node);
  return questions;
}

function removeSentinel(node: HTMLElement): void {
  // The sentinel usually renders as its own trailing block; drop the last block that carries it.
  const blocks = [...node.children];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block && (block.textContent ?? '').includes(SENTINEL)) {
      block.remove();
      return;
    }
  }
  // Fallback: a plain-text answer — trim the sentinel off the text node that holds it.
  for (const child of [...node.childNodes]) {
    const value = child.textContent ?? '';
    if (child.nodeType === Node.TEXT_NODE && value.includes(SENTINEL)) {
      child.textContent = value.slice(0, value.indexOf(SENTINEL)).trimEnd();
    }
  }
}
