# Socratic Tangents — Project Plan

> **Status (v1 shipped):** the spike's "forge our own request" approach was abandoned after live
> testing hit ChatGPT's anti-abuse wall (see [RESEARCH-FINDINGS.md](RESEARCH-FINDINGS.md), findings
> 12–14). v1 instead drives the page's own composer and renders tangents **inline as floating
> thought-bubbles** (the side panel is gone). For the as-built design and how to add an LLM, see
> [ARCHITECTURE.md](ARCHITECTURE.md). The product vision and UX tenets below still hold; treat the
> side-panel/hidden-conversation mechanics as superseded.


> A browser extension that adds **branching ("chat-in-chat") conversations** to any LLM web
> chat. Branch off any single reply, explore a focused sub-thread that *inherits the full
> context up to that point*, and keep every tangent organized as a tree — without ever
> losing or polluting your main conversation.

---

## 1. The problem (in the user's words)

> "When I study I get a comprehensive report, then ask questions step by step. Either I open
> a new chat (no context) or use the same chat and keep scrolling back to the main report to
> follow through. I want a 'chat in chat' that connects replies into a separate tree thread
> for each reply — via an extension that overlays this onto any LLM."

The pain has two parts:
1. **Context loss** — a new chat forgets the report; the same chat drowns the report in noise.
2. **Navigation loss** — there is no structure; deep dives and the main thread are tangled
   in one linear scroll.

Branching solves both: each tangent is *seeded with the exact context it needs* and *lives in
its own visually separate thread*.

---

## 2. Locked product decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Answer engine** | Reuse the user's logged-in web session via the provider's internal API (no key, no payment) | "Zero friction for adoption." Target users are subscription (Plus/Pro) users who *do not have API keys* — so an API key is **not** part of this product. |
| **UI surface** | Docked **side panel** (`chrome.sidePanel`) showing tree + active branch; main chat untouched | Most stable, least breakage on site redesigns. |
| **Targets (v1)** | **ChatGPT web** (chatgpt.com) + **Claude web** (claude.ai); **Chromium** (Chrome/Edge) first | Largest reach; single Manifest V3 codebase. |
| **Storage** | **Local-first** (IndexedDB), export/import JSON; optional cloud sync later | Private, no backend, fastest to ship. |

Product name: **Socratic Tangents** (Socratic step-by-step questioning; tangents = branches).

---

## 3. Core UX walkthrough

1. User reads a long report reply in ChatGPT/Claude as normal.
2. A small **"⌥ Branch"** affordance appears on hover over **any message** (and, stretch goal,
   over a **selected passage** within a message).
3. Clicking it opens the side panel with a **new branch node** anchored to that message. The
   source message gets a colored highlight + gutter marker in the page.
4. The user asks a follow-up *in the panel*. It is answered with the **full context up to the
   anchored message** (plus the branch's own prior Q&A) — but the exchange stays in the panel,
   **never** appearing in the main chat.
5. Any reply *inside a branch* can itself be branched → arbitrarily deep tree.
6. The **tree view** (left of the panel) lets the user jump between branches; the **thread
   view** (right) shows the active branch's messages. Clicking a node scrolls the page to (and
   re-highlights) its anchor message.

```
+------------------ Provider page (chatgpt.com) ------------------+----- Side panel -----+
|                                                                 |  TREE    | THREAD    |
|  [system] Comprehensive report on X ........................... |  o root  | Q: explain|
|  [user]   Explain part 2 in depth          (highlighted anchor) |  +-o #5  |    part 2 |
|  [asst]   Part 2 is ...  <- branched from here  [⌥ Branch]      |    +-o   | A: ...    |
|  [user]   ...                                                   |  +-o #9  | Q: deeper |
|                                                                 |          | A: ...    |
+-----------------------------------------------------------------+----------------------+
```

---

## 4. System architecture

Manifest V3 extension, three cooperating contexts:

```
                         ┌─────────────────────────────────────────┐
                         │            SIDE PANEL (React)            │
                         │  Tree view · Thread view · Composer      │
                         │  State: Zustand · Persistence: Dexie     │
                         └───────────────┬─────────────────────────┘
                                         │ runtime messaging (typed RPC)
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                 │                                │
┌───────▼─────────┐            ┌──────────▼──────────┐          ┌──────────▼─────────┐
│ BACKGROUND (SW) │            │  CONTENT SCRIPT     │          │  CONTENT SCRIPT    │
│ - panel routing │            │  on chatgpt.com     │          │  on claude.ai      │
│ - tab/session   │            │  - ChatGPT adapter  │          │  - Claude adapter  │
│   lifecycle     │            │  - DOM anchor map   │          │  - DOM anchor map  │
│ - storage owner │            │  - same-origin fetch│          │  - same-origin     │
└─────────────────┘            └─────────────────────┘          └────────────────────┘
```

**Why the network calls run in the page's MAIN world (the key trick — corrected after research):**
An *isolated-world* content script is **not** a clean path here — research shows isolated worlds
have a divergent CSP/cookie context and `host_permissions` do not grant content-script fetches a
CORS bypass (see `docs/RESEARCH-FINDINGS.md`). The reliable mechanism is to inject a script into
the page's **MAIN world** (`world: "MAIN"`, Chrome 111+). A MAIN-world script *is* the page: it
runs under the page's own CSP, its `fetch()` to `/backend-api/...` is genuinely same-origin (cookies,
bearer token, Cloudflare clearance all included), **and it can reuse the page's own
Sentinel/proof-of-work token-generation code** instead of reimplementing it. That last point is the
decisive advantage over a server-side proxy, which would have to re-solve PoW *and* spoof TLS
fingerprints (`curl_cffi impersonate`) to get past Cloudflare.

Caveat: MAIN-world scripts have **no `chrome.*` APIs**. So we use a **dual-world bridge**:
- **MAIN world** script — performs provider API calls, streams tokens.
- **ISOLATED world** content script — has `chrome.runtime`; relays messages to the panel/SW.
- They talk via `window.postMessage` / `CustomEvent`. The side panel never touches provider auth.

**Component responsibilities**

- **Side panel (UI):** all rendering, the tree/thread interaction, the composer, local
  persistence (Dexie/IndexedDB). Talks only to content scripts via the background router.
- **Content scripts (per provider adapter):** (a) read the page to build an **anchor map**
  (message DOM node ↔ provider message id), (b) execute provider API calls, (c) stream tokens
  back to the panel, (d) highlight/scroll anchors on request.
- **Background service worker:** opens/positions the side panel for the active tab, routes
  messages between panel and the correct content script, owns cross-tab coordination.

---

## 5. The branching engine (the hard part)

### 5.1 What "branch with full context" means

Both ChatGPT and Claude already model a conversation as a **tree of messages** internally
(each message has a `parent`). The web UIs simply render one root-to-leaf path. We exploit
this. Two strategies, chosen per provider/situation:

- **Strategy A — Native sibling branch (preferred when supported):** send a new message whose
  `parent_message_id` is the anchored message. The backend creates a real sibling under the
  same conversation. Context up to the anchor is preserved *server-side* (cheap, no re-sending,
  no context-window waste). We track our own node↔message-id map so our tree stays coherent
  even though the native UI only shows one path.
- **Strategy B — Seeded hidden conversation (fallback / isolation):** create a fresh
  conversation seeded with the transcript up to the anchor as context, then continue there.
  More tokens, possible context-limit pressure, but fully isolated and provider-agnostic.

**Default reversed after research → B is the safe default.** ChatGPT stores one `current_node`
pointer per conversation. Writing a native sibling (Strategy A) moves `current_node` to our branch,
so on the next reload the user's *real* thread would render our tangent as the active path — i.e. it
visibly pollutes/truncates their main conversation. Verified: omitting `conversation_id` on
`POST /backend-api/conversation` creates a **brand-new conversation**. So the default is **Strategy B**
— run each branch in a hidden, separately-seeded conversation, leaving the user's real thread 100%
untouched. Strategy A (native sibling, cheaper context) becomes an explicit opt-in for users who
*want* branches saved into the source conversation, with `current_node` restored afterward.
Strategy B also powers "branch from a selected passage" (seed = just that passage).

### 5.2 ChatGPT adapter (chatgpt.com)

- **Auth:** `GET /api/auth/session` → `accessToken` (bearer). Calls run from the content script
  so cookies are already attached.
- **Anti-bot:** ChatGPT gates `POST /backend-api/conversation` behind
  `/backend-api/sentinel/chat-requirements` (returns a token + sometimes a proof-of-work). The
  adapter must fetch requirements, solve the PoW, and attach the `OpenAI-Sentinel-Chat-*`
  headers — running same-origin in the page context makes this tractable. **This is the single
  biggest technical risk; isolate it behind the adapter interface.**
- **Read tree:** `GET /backend-api/conversation/{conversation_id}` → structured message map
  with ids + `parent` links (authoritative anchor source, better than DOM scraping).
- **Send/branch:** `POST /backend-api/conversation` with `parent_message_id` = anchor, SSE
  streamed response → forward tokens to panel.

### 5.3 Claude adapter (claude.ai)

- **Auth:** session cookie (`sessionKey`); org id via `GET /api/organizations`.
- **Read tree:** `GET /api/organizations/{org}/chat_conversations/{uuid}?tree=True` →
  messages with parent links.
- **Send/branch:** `POST .../chat_conversations/{uuid}/completion` with the parent message set
  to the anchor; SSE streamed response.

### 5.4 Adapter interface (provider-agnostic contract)

```ts
interface LLMAdapter {
  id: 'chatgpt' | 'claude';
  detectConversation(): Promise<{ conversationId: string; model: string } | null>;
  fetchMessageTree(conversationId: string): Promise<ProviderMessage[]>;
  buildAnchorMap(): Map<string /*providerMsgId*/, HTMLElement>;
  highlightAnchor(providerMsgId: string): void;
  scrollToAnchor(providerMsgId: string): void;
  sendInBranch(args: {
    conversationId: string;
    parentMessageId: string;       // the anchor (Strategy A)
    seedContext?: ProviderMessage[]; // Strategy B
    priorBranchTurns: BranchTurn[];  // this branch's own Q&A so far
    userText: string;
    onToken: (delta: string) => void;
  }): Promise<{ assistantText: string; newMessageId: string }>;
}
```

Adding Gemini/Perplexity/Copilot later = implement one more adapter. **No core changes.**

### 5.5 Anchoring that survives reloads & site redesigns

A branch must re-attach to its source message even after refresh or a provider DOM change.
Store a **3-layer anchor**:

```ts
type Anchor = {
  providerMessageId: string;  // primary key (stable server id)
  contentHash: string;        // sha256 of normalized message text (fallback)
  textPrefix: string;         // first ~120 chars (human-readable + fuzzy fallback)
};
```
Resolution order on load: exact `providerMessageId` → `contentHash` → fuzzy `textPrefix`. If
all fail, mark the branch **"orphaned"** (still readable; user can re-anchor manually).

---

## 6. Data model (local-first, Dexie/IndexedDB)

```ts
type Provider = 'chatgpt' | 'claude';

interface Workspace {            // one per provider conversation
  id: string;
  provider: Provider;
  conversationId: string;
  title: string;
  createdAt: number; updatedAt: number;
}

interface BranchNode {
  id: string;
  workspaceId: string;
  parentNodeId: string | null;   // null = a root branch off the main thread
  anchor: Anchor;                // which message this branched from
  title: string;                 // auto from first question, editable
  color: string;                 // for the page highlight + tree
  createdAt: number;
}

interface BranchTurn {           // a Q&A pair inside a branch
  id: string;
  branchNodeId: string;
  role: 'user' | 'assistant';
  text: string;
  providerMessageId?: string;    // if Strategy A produced a real server msg
  createdAt: number;
}
```

Export/import = JSON dump of these tables (portability + manual backup before any sync exists).

---

## 7. UI/UX detail (side panel)

- **Layout:** collapsible **tree** (left ~38%) + **thread** (right). Tree nodes show
  title, color dot, depth, message count; active node highlighted.
- **In-page affordances:** hover **"⌥ Branch"** button on each message; colored left-gutter
  bar + subtle background tint on any message that has branches; clicking the bar opens that
  branch.
- **Composer:** textarea with streaming send; shows which message/branch context is active
  ("Branching from: 'Part 2 is…'"). Model indicator + Strategy A/B badge.
- **Navigation:** click tree node → page scrolls to & re-highlights anchor; breadcrumb of the
  path from root.
- **Quality-of-life:** rename/recolor/delete branch, collapse subtrees, search across all
  branches, keyboard shortcuts (`b` branch from focused msg, `j/k` move tree, `⌘↵` send).
- **Empty/error states:** not-logged-in, conversation-not-detected, orphaned-anchor,
  provider-API-changed (graceful "we'll auto-recover" messaging).

---

## 8. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Extension framework | **WXT** (MV3) | Cross-browser builds (Chrome/Edge now, Firefox/Safari later) from one codebase; great DX. |
| Language | **TypeScript** (strict) | Safety across messaging boundaries. |
| UI | **React + Tailwind** | Fast, familiar, themeable to match each provider. |
| State | **Zustand** | Light, ergonomic for panel state. |
| Persistence | **Dexie** (IndexedDB) | Local-first, typed, migrations. |
| Streaming | SSE/fetch reader in content script → port messaging | Live token rendering. |
| Testing | Vitest (unit), Playwright (e2e against fixtures) | Adapter & UI confidence. |
| Build/CI | pnpm + GitHub Actions; zip artifacts per browser | Repeatable store uploads. |

---

## 9. Cross-browser & cross-LLM strategy

- **Browsers:** WXT targets emit Chrome/Edge (MV3) immediately; Firefox (MV3 + sidebar) and
  Safari (Xcode wrapper) are later targets sharing 90% of code. Keep all browser-specific bits
  (sidePanel vs sidebar API) behind a tiny `platform/` shim.
- **LLMs:** everything provider-specific lives in `adapters/<provider>/`. The core (tree, data
  model, UI, anchoring) is provider-neutral. New LLM = new adapter + a host-permission entry.

---

## 10. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Provider changes internal API / DOM | High | Adapter isolation; **remote-config "adapter recipes"** so we can ship endpoint/selector fixes without a store re-review; e2e canary tests; graceful degradation banners. |
| ChatGPT anti-bot (Sentinel/PoW) friction | High | Run in the page's MAIN world and **reuse the page's own PoW solver**; contain all of it in the ChatGPT adapter; if a *send* path breaks, fall back to **Strategy B** seeded conversations (still web-session, zero-key). |
| Terms-of-service gray area (automating own session) | Med–High | User acts on *their own* account/data; rate-limit to human-like cadence; no scraping of others' data; clear disclosure + opt-in. **Get explicit legal review before public launch.** |
| Context-window limits (Strategy B re-sends context) | Med | Prefer Strategy A; for B, truncate/summarize seed context, warn on overflow. |
| Manifest V3 service-worker lifecycle (SW sleeps) | Med | Keep state in panel/IndexedDB, not SW memory; reconnect ports on wake. |
| Branch anchors drift after edits | Med | 3-layer anchor resolution + manual re-anchor UI. |

**Honesty note:** the "zero friction" path depends on undocumented internal endpoints and
anti-bot handling. It is powerful but inherently fragile and ToS-sensitive. There is **no
API-key product hiding behind it** — our users are subscription users without keys, so if a
provider ever fully walls off web automation, serving a key-holding segment would be a *different
product for a different user*, decided then. Within the web-session world our fallbacks are:
prefer Strategy B (seeded hidden conversation), and only as a last resort drive the real
composer. The Phase 0 spike treats web-session viability as **existential**, not hedged.

---

## 11. Security & privacy

- 100% local by default; no telemetry without explicit opt-in.
- Never persist provider auth tokens to disk — read transiently in the content script per call.
- Minimal host permissions (`chatgpt.com`, `claude.ai` only); no broad `<all_urls>`.
- Export/import is plain JSON the user controls; clear "delete all data" action.
- Document the data flow plainly in the store listing and a privacy page.

---

## 12. Roadmap / milestones

**M0 — Spike (1–2 wks):** Prove the core risk. Content script on chatgpt.com that, using the
existing session, creates a native sibling branch off a chosen message and streams the reply
to the console. Repeat for claude.ai. *Go/no-go gate for the zero-friction approach.*

**M1 — Skeleton (1–2 wks):** WXT project, side panel opens, detects conversation, builds anchor
map, renders the existing thread read-only in the tree.

**M2 — Branch MVP (2–3 wks):** "⌥ Branch" on a message → panel branch node → ask follow-up →
streamed answer via Strategy A → persisted in IndexedDB. ChatGPT first, then Claude.

**M3 — Tree UX (2 wks):** nested branches, tree navigation, anchor highlight/scroll, rename/
recolor/delete, breadcrumbs, search, keyboard shortcuts.

**M4 — Resilience (1–2 wks):** 3-layer anchoring, orphan recovery, Strategy B fallback,
remote-config adapter recipes, error/empty states.

**M5 — Polish & beta (2 wks):** export/import, onboarding, theming per provider, perf,
Playwright e2e against recorded fixtures. Private beta with the people who reported the pain.

**M6 — Launch (1–2 wks):** Chrome Web Store + Edge Add-ons listing, privacy/legal review,
landing page. **Then:** Firefox/Safari, Gemini adapter, branch-from-
selection, cloud sync.

---

## 13. Success metrics

- **Activation:** % of installs that create ≥1 branch in week 1.
- **Depth:** avg branches per conversation; max tree depth (proxy for "real study use").
- **Retention:** W1/W4 return rate; branches reopened after first session.
- **Reliability:** adapter error rate per 1k sends; mean time-to-fix after a provider change.

---

## 14. Open questions to resolve before/at M0

1. **Branch-from-selection** (passage-level, Strategy B) — v1 or v2?
3. **Visibility of branches in the native account** — Strategy A branches *exist server-side*;
   acceptable, or must branches be invisible to the provider account (→ forces Strategy B)?
4. **Monetization** — free/OSS, or freemium (cloud sync + API-key convenience as paid)?
5. **Legal review timing** — recommend before any public (non-private-beta) distribution.
