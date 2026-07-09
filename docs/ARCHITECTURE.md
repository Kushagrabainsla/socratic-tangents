# Architecture

Socratic Tangents is a single Manifest V3 **content script** that runs in the page's ISOLATED
world. It does not forge API requests (ChatGPT guards sends with single-use tokens and device-level
detection, so forging them is brittle and risks the user's account); instead it **drives the site's
own composer**, so the page runs its real pipeline and there's no account risk.

## Layout

```
entrypoints/
  tangents.content.ts      # entry: pick the adapter for this host, then init the feature
lib/
  adapters/                # everything provider-specific lives here
    types.ts               #   LLMAdapter interface
    base.ts                #   BaseDomAdapter: all behaviour, driven by selectors
    chatgpt.ts             #   ChatGPTAdapter (selectors only)
    claude.ts              #   ClaudeAdapter  (selectors only)
    registry.ts            #   the adapter list + host → adapter, + manifest match patterns
  tangent/                 # provider-agnostic core (never needs to change per provider)
    manager.ts             #   controller: loads/persists tangents, wires selection, nav, health
    selection.ts           #   "↳ Tangent" affordance on text selection
    bubble.ts              #   the floating thought-bubble UI: a drill-down stack of nested tangents
    placement.ts           #   pure rule for follow / pinned / minimized each frame
    dock.ts                #   stacks minimized pills so they never overlap
    engine.ts              #   ask orchestration: send → hide turns → await answer → clean
    followups.ts           #   parse suggested follow-ups piggybacked on the answer
    anchor.ts              #   turn a selection into a durable anchor, and resolve it later
    markers.ts             #   per-message badges that reopen a message's tangents
    launcher.ts            #   floating tree of the conversation's tangents (+ export/import)
    tree.ts                #   the tangent forest: roots, paths, descendants (parent/child)
    store.ts               #   local persistence in extension storage
    model.ts               #   the Tangent data model and small pure helpers
    export.ts / import.ts  #   Markdown/JSON export and validated re-import
    sanitize.ts            #   allowlist HTML sanitizer for persisted/imported answers
    nav.ts                 #   detect SPA conversation changes so tangents re-anchor
    notice.ts              #   dismissible toast notices (warnings, hints, results)
    icons.ts               #   inline monochrome SVG icons
    styles.ts              #   injected CSS (theme-aware)
    theme.ts               #   dark/light detection from the host
    dom.ts                 #   tiny shared helpers
```

## How it works

1. **Selection** ([selection.ts](../lib/tangent/selection.ts)) shows the affordance when text is
   selected inside an assistant message (the adapter decides what that is).
2. **Bubble** ([bubble.ts](../lib/tangent/bubble.ts)) opens a floating card anchored to that message,
   tracks it as you scroll, and collapses to a side pill when it's off-screen.
3. **Engine** ([engine.ts](../lib/tangent/engine.ts)) on ask: snapshots message ids → `adapter.send()`
   → hides any new turns from the thread → waits for the new answer to finish → returns
   `adapter.cleanAnswer()`. The bubble renders that node and scrolls back to the passage.
4. **Nesting** ([bubble.ts](../lib/tangent/bubble.ts), [tree.ts](../lib/tangent/tree.ts)) — selecting
   text inside a tangent's answer branches a _child_ tangent (`parentId`). One card holds the whole
   drill path: the visible top drives the thread, a breadcrumb pops back, and the launcher renders the
   forest as a tree. Quick-action chips and parsed follow-up suggestions make going deeper one tap.

The core talks only to the [`LLMAdapter`](../lib/adapters/types.ts) interface, so it is completely
provider-agnostic. Design notes: single responsibility (adapter = DOM knowledge, engine =
orchestration, bubble = UI), open/closed (new providers add code, don't modify it), and DRY (all
adapter behaviour is shared in `BaseDomAdapter`; adapters supply only selectors).

## Add a new LLM

Usually three small steps, with no changes to the engine or UI:

1. **Create an adapter** in `lib/adapters/<name>.ts` extending `BaseDomAdapter`, filling in
   `id`, `name`, `hostPatterns`, and `selectors`:

   ```ts
   import { BaseDomAdapter, type AdapterSelectors } from './base';

   export class GeminiAdapter extends BaseDomAdapter {
     readonly id = 'gemini';
     readonly name = 'Gemini';
     readonly hostPatterns = ['gemini.google.com'];
     protected readonly selectors: AdapterSelectors = {
       assistantMessage: 'model-response',
       anyMessage: 'user-query, model-response',
       turnWrapper: '.conversation-turn',
       messageIdAttr: '', // '' → synthetic ids when the site has none
       answerContent: ['.markdown', '.prose'],
       composer: ['div[contenteditable="true"]', 'textarea'],
       sendButton: ['button[aria-label*="Send" i]'],
       streaming: ['button[aria-label*="Stop" i]'],
     };
   }
   ```

2. **Register it** in [registry.ts](../lib/adapters/registry.ts) (`ADAPTERS` array). Match patterns
   and `host_permissions` follow automatically.

3. **Allow the host** in [wxt.config.ts](../wxt.config.ts) `host_permissions`, then tune the
   selectors against the live DOM (expect a round or two, since provider DOMs are undocumented).

If a provider is unusual (e.g. a non-standard composer), override the relevant method in your
adapter instead of changing the core.

## Tests

Vitest covers the parts worth protecting (`*.test.ts` next to each module). The provider-agnostic
core is unit-tested: model helpers, anchoring, prompt composition, storage, export, and import
validation. Adapters get **contract tests** ([adapters.test.ts](../lib/adapters/adapters.test.ts))
that run each adapter's selectors against a small HTML fixture, so selector rot fails the build
instead of reaching users. The same risk is also caught at runtime by `checkSelectors`, which warns
the user if the live page stops matching. Run `npm run test` during development and `npm run test:run`
for a single pass (what CI runs).
