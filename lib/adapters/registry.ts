import { ChatGPTAdapter } from './chatgpt';
import { ClaudeAdapter } from './claude';
import type { LLMAdapter } from './types';

// The single place that knows which adapters exist. Add a provider here and nowhere else.
const ADAPTERS: LLMAdapter[] = [new ChatGPTAdapter(), new ClaudeAdapter()];

/** The adapter for the current host, or null if the site isn't supported. */
export function getAdapter(host: string): LLMAdapter | null {
  return ADAPTERS.find((adapter) => adapter.matchesHost(host)) ?? null;
}

/** Manifest content-script match patterns, derived from the registered adapters. */
export const PROVIDER_MATCH_PATTERNS = ADAPTERS.flatMap((a) =>
  a.hostPatterns.flatMap((p) => [`https://${p}/*`, `https://*.${p}/*`]),
);
