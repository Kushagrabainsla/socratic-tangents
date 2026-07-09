import { getAdapter, PROVIDER_MATCH_PATTERNS } from '@/lib/adapters/registry';
import { TangentManager } from '@/lib/tangent/manager';
import { injectStyles } from '@/lib/tangent/styles';

// The whole feature: pick the adapter for this LLM, then start the tangent manager. Adding a
// provider is an adapter in lib/adapters/. This entrypoint and the engine/UI never change.
export default defineContentScript({
  matches: PROVIDER_MATCH_PATTERNS,
  // Content scripts run in the isolated world by default, so we don't set `world`: omitting it keeps
  // the Firefox MV2 manifest free of an MV3-only key (cleaner AMO lint) with no behaviour change.
  main() {
    const adapter = getAdapter(location.host);
    if (!adapter) return;
    injectStyles();
    void new TangentManager(adapter).start();
  },
});
