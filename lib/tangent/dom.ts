// Small DOM helpers shared across the tangent engine and adapters.

/** Return the first element matching any of `selectors`, or null. */
export function pick(root: ParentNode, selectors: string[]): HTMLElement | null {
  for (const selector of selectors) {
    const el = root.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}

/** Match a host against a bare-host pattern, e.g. 'claude.ai' or '*.chatgpt.com'. */
export function hostMatches(pattern: string, host: string): boolean {
  const base = pattern.startsWith('*.') ? pattern.slice(2) : pattern;
  return host === base || host.endsWith(`.${base}`);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
