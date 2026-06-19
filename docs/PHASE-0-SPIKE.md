# Phase 0 — The De-Risking Spike (next phase)

> Goal: in throwaway code, **prove the one thing the entire product depends on** —
> *can we, from inside the page, create a context-seeded branch off a chosen message using the
> user's existing session, stream the reply, and leave the real conversation untouched?*
> This is a **go/no-go gate**. Nothing else gets built until it passes. Grounded entirely in the
> verified findings in `RESEARCH-FINDINGS.md`.

Scope discipline: **no React, no IndexedDB, no tree UI, no Claude yet.** Console + a single
floating button. We are buying down risk, not building features.

---

## The four risks this spike must retire (in priority order)

| R | Risk | Pass criterion |
|---|---|---|
| **R1** | MAIN-world script can call `/backend-api/conversation` authenticated and stream a reply. | A hard-coded prompt returns streamed tokens to the console, using only the logged-in session. |
| **R2** | We can reuse the page's **Sentinel + proof-of-work** rather than reimplementing it. | The send succeeds with valid `openai-sentinel-*` headers obtained in-page (no 403/`requirements`). |
| **R3** | **Strategy B** branch (omit `conversation_id`, seed context) answers with the right context **and the user's real thread is byte-for-byte unchanged** after reload. | Seeded branch demonstrably "remembers" the source message; original conversation's `current_node` and message list are identical before/after. |
| **R4** | The **dual-world bridge** (MAIN ↔ ISOLATED ↔ side panel) round-trips a message and the panel opens within the click gesture. | Clicking the floating button opens the side panel *and* a string makes the full MAIN→ISOLATED→panel trip. |

If R1–R3 fail and can't be salvaged within the web session, the answer is **not** "switch to API keys" — our users don't have them. The web-session fallbacks, in order, are: (a) Strategy B variations (different seeding), (b) last-resort driving the real composer in a controlled way. If *none* work, the product as conceived is blocked and we **reassess**, rather than ship something the target user can't use. R4 failing only affects UX wiring, not viability.

---

## Build steps (granular)

### Step 1 — Skeleton extension (½ day)
- WXT project, MV3, TypeScript. `host_permissions`/`content_scripts` matches: `https://chatgpt.com/*` only (Claude deferred).
- Three entry points wired empty: `main-world.ts` (`world: "MAIN"`), `bridge.ts` (`world: "ISOLATED"`), `background.ts` (SW), plus a minimal `sidepanel.html`.
- Confirm both content scripts inject on chatgpt.com (log a tag from each).

### Step 2 — R1+R2: in-page authenticated send (1–2 days, the crux)
In `main-world.ts`, running as the page:
1. Read `accessToken` via `GET /api/auth/session`.
2. `POST /backend-api/sentinel/chat-requirements` → get requirements; if PoW demanded, **reuse the page's existing solver** (locate the bundled function / Worker the official client already uses) to produce `openai-sentinel-proof-token`. Reimplementing PoW from scratch is the explicit fallback only if reuse proves impossible.
3. `POST /backend-api/conversation` with `action:"next"`, `model`, a hard-coded `messages` array, `parent_message_id`, **no `conversation_id`**, and headers: bearer + `openai-sentinel-chat-requirements-token` + `openai-sentinel-proof-token`.
4. Read the SSE stream; log deltas. **R1+R2 pass when tokens stream.**

### Step 3 — R3: Strategy B correctness + non-pollution (1 day)
1. `GET /backend-api/conversation/{id}` for the open conversation; snapshot `mapping` + `current_node`.
2. Build a seed = transcript up to a chosen message; create a new conversation (omit `conversation_id`) seeded with it; ask a follow-up that can only be answered from that context. Verify the answer uses it.
3. Re-`GET` the original conversation; **assert `current_node` and node set are unchanged.** Reload the tab and eyeball the real thread. **R3 passes when the original is untouched.**
4. (Optional, time-boxed) try Strategy A once: branch with `parent_message_id` into the real conversation, confirm it *does* move `current_node`, then restore it — to scope the opt-in feature.

### Step 4 — R4: bridge + panel-on-gesture (½–1 day)
1. Inject a floating "⌥ Branch" button via the ISOLATED script.
2. On `mousedown`, call `sidePanel.open()` **synchronously** (proves the gesture rule), then kick off the async send.
3. MAIN does the fetch → `window.postMessage` → ISOLATED → `chrome.runtime` → side panel renders the streamed reply. **R4 passes on a full round-trip.**

### Step 5 — Findings memo (½ day)
Short write-up per risk: pass/fail, surprises, measured effort, and a **recommendation**: proceed to M1 as planned / proceed with changes / reassess the approach. Note observed `current_node` behavior, PoW reuse feasibility, and any rate-limit/anti-bot friction hit.

---

## Timebox & guardrails
- **~4–5 working days.** Hard stop at one week. If R1+R2 aren't passing by day 3, escalate (reassess approach) rather than grinding on PoW.
- Use the **user's own logged-in account**, but do all write-tests inside a **fresh throwaway conversation**, never an important existing chat (protects real history; limits anti-bot/rate-limit exposure).
- Keep cadence human-like; do not hammer endpoints.
- All spike code is disposable — clarity over reuse; M1 starts the real codebase.

## Definition of done
A 1-page memo answering **"is the zero-friction, no-key approach viable for ChatGPT?"** with a yes/no and the evidence behind it — enough for a confident M1 go/no-go.

## Open decisions feeding this phase
_Resolved:_ use the **user's own account**; write-tests run in a **fresh throwaway conversation**,
and the one Strategy A test (touch a real conversation, then restore `current_node`) will also use
that throwaway conversation — no important chat is touched.
