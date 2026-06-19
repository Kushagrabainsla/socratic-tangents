import { getAdapter, PROVIDER_MATCH_PATTERNS } from '@/lib/adapters/registry';
import { initSelection } from '@/lib/tangent/selection';
import { injectStyles } from '@/lib/tangent/styles';

// The whole feature: pick the adapter for this LLM, then wire up inline tangents. Adding a provider
// is an adapter in lib/adapters/ — this entrypoint and the engine/UI never change.
export default defineContentScript({
  matches: PROVIDER_MATCH_PATTERNS,
  world: 'ISOLATED',
  main() {
    const adapter = getAdapter(location.host);
    if (!adapter) return;
    injectStyles();
    initSelection(adapter);
  },
});
