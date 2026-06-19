# Research & Fact-Proofing Log

Verifying the load-bearing assumptions in `PROJECT_PLAN.md` before committing engineering time.
Verdicts: ✅ confirmed · ⚠️ confirmed-but-changes-the-plan · ❌ wrong.

| # | Claim under test | Verdict | What the evidence says |
|---|---|---|---|
| 1 | A plain (isolated-world) content script can fetch the provider's internal API same-origin with cookies. | ❌ → ⚠️ | Isolated worlds have a **divergent cookie/CSP context** and `host_permissions` **do not** give content-script fetches a CORS bypass (that applies to the service worker / extension pages). The plan's original "run fetch from the content script" was **wrong**. |
| 2 | We can instead run requests in the page's **MAIN world** and inherit full auth. | ✅ | Chrome docs: *"When a content script is injected into the main world, the CSP of the page applies."* A MAIN-world script *is* the page → same-origin fetch carries cookies/bearer/Cloudflare clearance, and can call the page's own token code. **This becomes the architecture.** |
| 3 | MAIN-world scripts can still talk to the extension. | ⚠️ | They **cannot** — no `chrome.*` in MAIN world. Requires a **dual-world bridge**: MAIN (does fetch) ↔ ISOLATED (has `chrome.runtime`) via `window.postMessage`/`CustomEvent`. Well-established pattern. |
| 4 | ChatGPT stores conversations as a tree and supports sibling branching via `parent_message_id`. | ✅ | HAR analysis: conversation is a DAG (`mapping` + `current_node`); *"Regenerations/edits appear as alternative children under the same parent."* Branching is native. |
| 5 | We can branch without disturbing the user's visible thread. | ⚠️ | Only **one** `current_node` per conversation; a native sibling **moves it**, so the real thread would render our tangent on reload. Verified fix: **omit `conversation_id`** → creates a new conversation. → **Strategy B (seeded hidden conversation) becomes the default.** |
| 6 | ChatGPT gates sends behind Sentinel + proof-of-work. | ✅ | `POST /backend-api/sentinel/chat-requirements` (prepare/finalize), Turnstile + PoW; send needs `openai-sentinel-chat-requirements-token` + `openai-sentinel-proof-token` + bearer. **Moderately complex** — but MAIN-world lets us reuse the page's own solver instead of reimplementing it. |
| 7 | Claude has an equivalent internal completion endpoint usable via session. | ✅ | `POST /api/organizations/{org}/chat_conversations/{uuid}/completion`, `sessionKey` cookie, org id from `lastActiveOrg`/URL. External clients need TLS-fingerprint spoofing (`curl_cffi impersonate`) to pass Cloudflare — **in-browser MAIN world avoids that entirely.** |
| 8 | The side panel can be opened when the user clicks "Branch". | ⚠️ | `sidePanel.open()` works from a content-script click **but only inside a live user gesture** — not after an `await`. Known gotcha; use `mousedown` + a pre-opened SW port. **UX rule: open panel synchronously on click, fetch afterwards.** |
| 9 | The Chrome Web Store will allow this. | ⚠️ unresolved | Policy requires single-purpose, prominent data-use disclosure, limited-use, justified permissions, no broad `<all_urls>`. ChatGPT-interacting extensions do exist in the store. Provider **ToS** is a separate risk. → keep **API-key mode** as the compliant fallback; get legal review before public launch. |

## Net architectural changes vs. the original plan
1. **MAIN-world injection + dual-world bridge** replaces "fetch from content script." (claims 1–3)
2. **Strategy B (hidden seeded conversation) is now the default**, not Strategy A — to keep the user's real thread pristine. (claim 5)
3. **Biggest moat confirmed:** doing this *in the browser page* inherits Sentinel/PoW + Cloudflare/TLS for free — the exact things that make server-side reverse-engineered clients fragile. (claims 6–7)
4. **UX constraint:** panel open must be inside the click gesture, before any async work. (claim 8)

## Spike update (live testing) — the ChatGPT anti-abuse wall & the pivot

Testing against a real logged-in session retired the biggest unknown — and reversed a core assumption.

| # | Finding | Verdict | Evidence |
|---|---|---|---|
| 10 | The dual-world bridge works; we can run code as the page. | ✅ | `ping` round-trips MAIN↔ISOLATED↔panel. |
| 11 | We can read the session with zero friction. | ✅ | Bearer token harvested from the page's own `/backend-api/*` calls (`interceptedBearer: true`); direct `/api/auth/session` also 200 once warm. |
| 12 | **Forging our own send request is viable.** | ❌ | `POST /backend-api/f/conversation` (replayed) → **403 `"Unusual activity has been detected from your device"`**. |
| 13 | Why it fails: ChatGPT's send is hardened. | ✅ | Real flow = `/f/conversation/prepare` → **`conduit_token`** (JWT, ~60s, single-use, bound to the turn) → `sentinel/chat-requirements/prepare`→`finalize` → requirements token → send with proof + turnstile tokens. Tokens are single-use; there is **device-level behavioral anomaly detection** on top. |
| 14 | Forging is the wrong path for a consumer product. | ✅ (decision) | Even done perfectly it's a brittle arms race on an actively-evolving stack (`model: gpt-5-5-thinking`, `encodings: v1`), and risks **flagging the user's real account** — unacceptable for non-developers. |

**Pivot (chosen):** stop forging requests. **Drive the page's own composer / native branching** so the
official client runs the full prepare/conduit/PoW/turnstile pipeline itself — no forged tokens, no
account risk, robust to backend changes. The extension's value moves to **orchestration + a clean tree
view** over ChatGPT's (already tree-shaped) conversation, not secret request injection.

Consequence for `PROJECT_PLAN.md`: **Strategy A/B "seeded hidden conversation" is dead for ChatGPT.**
The new model is "managed context + organized tree over real sends." Context isolation is sacrificed;
the user's real pains (navigation + organization) are still solved, arguably better and far more durably.

## Sources
- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) · [user-gesture issue thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/WRGFOAHxoaY)
- [Chrome content scripts (ISOLATED vs MAIN)](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) · [chrome.runtime undefined in MAIN world](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/_zKyp9XvIzY)
- [MV3 host_permissions / CORS for content scripts](https://corsapi.com/en/blog/chrome-extension-manifest-v3-cors-host-permissions)
- [ChatGPT HAR architecture (DAG, sentinel, current_node)](https://alinr.com/experiments/chatgpt-har-architecture-conversation-data.html) · [chat2api ChatService.py (send flow)](https://github.com/lanqian528/chat2api/blob/main/chatgpt/ChatService.py) · [openai-sentinel PoW](https://github.com/leetanshaj/openai-sentinel)
- [claude-ai-re-client (completion endpoint, sessionKey)](https://github.com/Adithyan-Defender/claude-ai-re-client)
- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
