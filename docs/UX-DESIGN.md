# UX Design — Socratic Tangents

> North star: a student reading a long answer should be able to **dig into any part of it
> without losing their place** — and never have to think about "how." The tool should feel like
> a natural capability ChatGPT/Claude always had, not a bolted-on widget.

Chosen model: **conversation-first panel with an ambient map** + a **visual tether** from the
panel to the source message (spatial connection without the fragility of inline popovers).

---

## 1. Design tenets (every decision is checked against these)

1. **No new vocabulary to learn.** Branching = "asking a follow-up about this bit." The UI
   teaches itself through one well-placed affordance, not a tutorial.
2. **Never move the user's main chat.** Branching must never scroll, edit, or re-render the
   real conversation. Your place is sacred.
3. **Context is invisible.** The user never assembles context; the tangent already knows the
   report up to where they branched. Zero setup.
4. **Color is the through-line.** One color ties a tangent across all three surfaces: the
   highlighted source message (page), the breadcrumb, and the map node. The eye never gets lost.
5. **Conversation is the hero; structure is ambient.** The active sub-chat fills the panel; the
   tree is a slim rail you only expand when you want the map.
6. **Optimistic, streaming, no spinners.** Every action shows instant feedback; tokens stream
   in the host's native style.
7. **Always reversible.** Esc closes, nothing is destroyed, the page is untouched. Confidence to
   explore.
8. **Feels native to the host.** Inherit ChatGPT's / Claude's theme, fonts, bubble style, dark
   /light — rendered in a Shadow DOM so styles never bleed either way.

---

## 2. The core flow (the 5-second story)

```
1. Read a long reply.
2. Select the phrase you're curious about   →  a tiny toolbar appears at the selection.
3. Click "↳ Tangent".                        →  panel slides in, source phrase highlighted,
                                                tether line drawn, composer focused.
4. Type your follow-up, Enter.               →  answer streams in, already knowing the context.
5. Done? Esc.                                →  panel closes; main chat exactly where you left it.
   The message now shows a "▸ 2 tangents" chip so you can come back anytime.
```

That is the entire thing. Everything below makes those five steps feel effortless.

---

## 3. Entry points to start a tangent (progressive, discoverable)

Three ways in, ordered by how naturally users find them:

**A. Select text → floating mini-toolbar** *(primary — directly solves "follow a certain part")*
```
GPT: …light reactions occur in the [thylakoid membrane of the chloroplast]…
                                    └──────────────┬───────────────┘
                                       ┌───────────▼────────────┐
                                       │  ↳ Tangent    ⧉ Copy   │
                                       └────────────────────────┘
```
The selected text becomes the tangent's subject (quoted as a chip) and the seed for Strategy B.

**B. Hover a whole message → edge affordance** *(when the question is about the whole reply)*
```
┃ ChatGPT: Photosynthesis has two stages…                         [ ↳ Tangent ]
┃          ▸ 2 tangents                                            ^ appears on hover
```

**C. Keyboard** *(power users)* — `j/k` move message focus, `b` branches the focused message,
`/` focuses the tangent composer. Fully mouse-free.

> Discovery aid: the **first time** a user hovers a long reply, a one-line coachmark fades in —
> *"Tip: select any part of a reply to dig deeper without losing your place."* It never shows
> again after the first tangent is created.

---

## 4. The panel, annotated

```
┌─ chatgpt.com ───────────────────────────────┬──────────────────────────────────┐
│ You: full report on photosynthesis          │ ● Tangent · why thylakoid?     ✕  │  ← header: color dot,
│                                              │ Main › Light reactions            │     auto-title, breadcrumb
│ GPT: Photosynthesis has two stages…          │┌──┐                               │
│ ┃ 1. Light reactions ◄══════════════════════╗││··│  ← map rail (dots = siblings) │
│ ┃    occur in the thylakoid…          [↳]   ║││● │     hover a dot → title tip    │
│ ┃ 2. Calvin cycle…                          ║││○ │     click → switch tangent     │
│     ▸ 2 tangents  ← click to reopen         ║│└──┘                               │
│                                             ║│ ❝ occurs in the thylakoid ❞       │  ← subject chip
│ You: …                                      ╚╪═══ tether (same color as dot)      │     (the selected text)
│                                              │ You: why thylakoid specifically?  │
│                                              │ GPT: Because the thylakoid mem-   │  ← streams in host style
│                                              │ brane houses the photosystems…    │
│                                              │ ┌──────────────────────────────┐  │
│                                              │ │ Ask a follow-up…           ⏎ │  │  ← composer, always focused
│                                              │ └──────────────────────────────┘  │
└──────────────────────────────────────────────┴──────────────────────────────────┘
```

- **Header:** color dot · editable auto-title (from the first question) · **breadcrumb path**
  (`Main › Light reactions › why thylakoid`). Click any crumb to jump up a level.
- **Map rail:** a slim vertical strip of colored dots = the tangents at this level + your
  current node (filled). Hover → title tooltip; click → switch. Press the rail's ⊞ to expand
  the **full map overlay** (§5).
- **Subject chip:** the quoted passage you branched from; click it to scroll the page to the
  source and pulse it.
- **Tether:** a thin curved line, in the tangent's color, from the highlighted source message to
  the panel edge. It fades when you scroll the source off-screen and a "↑ source above" pill
  appears instead.
- **Composer:** focused on open; `Enter` sends, `Shift+Enter` newline; shows the active model
  (inherited from the host conversation).

---

## 5. The map (only when you want it)

One click on the rail's ⊞ expands a calm, outline-style map (not a sterile file tree):

```
┌ Map · Photosynthesis study guide ───────────────────── ✕ ┐
│ ●  Main thread                                            │
│ ├─ ● Light reactions               3 msgs · 2m            │
│ │   └─ ○ why thylakoid?            2 msgs · now   ← here  │
│ ├─ ● Calvin cycle                  1 msg  · 5m            │
│ └─ ● Compare C3 vs C4              4 msgs · 8m            │
└──────────────────────────────────────────────────────────┘
```
Indented outline with color dots, title, message count, and recency. Click a row → that tangent
becomes active *and* the page scrolls to its source. Search box filters across all tangents.
(A zoomable node-graph canvas is explicitly **deferred** to a future full-tab view — overkill for
a side panel and worse for legibility.)

---

## 6. Grounding the user in the page (so the panel never feels detached)

- **Source highlight:** the branched message/passage gets a soft tint + a colored left bar in
  the tangent's color, persisting while that tangent is active.
- **Tangent chips on messages:** any message with tangents shows a `▸ n tangents` chip in its
  color(s); click to reopen (if multiple, a tiny popover lists them).
- **Jump + pulse:** selecting a map row or the subject chip smooth-scrolls the page to the
  source and pulses it once — re-establishing "this is where this thought came from."
- **Optional Focus dim:** a toggle that gently dims the rest of the page while you're in a
  tangent, for deep concentration. Off by default; remembered per user.

---

## 7. Motion & micro-interactions (calm, ~150–220ms, ease-out)

| Moment | Motion |
|---|---|
| Open panel | slides in from right; tether draws from source to panel |
| New tangent | map node grows in; source bar wipes in |
| Send message | user bubble pops in optimistically; assistant tokens stream |
| Switch tangent | crossfade thread; rail dot slides to new position; source re-pulses |
| Reopen tangent chip | panel slides in already scrolled to that thread |
| Close (Esc) | panel slides out; highlight fades; page never moves |

All motion respects `prefers-reduced-motion` (instant, no slides).

---

## 8. Onboarding (contextual, ~8 seconds total, never a wall)

1. **First long reply** → the §3 coachmark ("select any part…").
2. **First tangent created** → a 2-line panel intro: *"This is a tangent — it already knows your
   report up to here. Your main chat won't change. Esc to come back."* Dismiss = gone forever.
3. **Second session** → nothing. The tool is now invisible infrastructure.

No modal, no tour, no account, no settings to configure before first use.

---

## 9. States (designed, not afterthoughts)

| State | Treatment |
|---|---|
| Not logged in to host | panel shows: *"Log in to ChatGPT/Claude to use tangents"* + nothing else. |
| Conversation not detected | quiet inline note; affordances hidden until a conversation loads. |
| Generating | streaming tokens; composer shows a stop ◼; rail dot has a soft pulse. |
| Empty tangent (just created) | composer focused, subject chip shown, placeholder: *"Ask a follow-up about 'thylakoid membrane…'"* |
| Orphaned anchor (source not found after edit/reload) | tangent still fully readable; a small banner: *"Source message changed — [re-link]"*; never data loss. |
| Long tree | map gets search + collapse; rail caps at N dots then "+k". |
| Error / provider hiccup | inline, human: *"Couldn't reach ChatGPT just now — retry"*, with a retry button; draft preserved. |

---

## 10. Native-feel per provider

The panel reads design tokens from the host and themes itself, so it looks like part of the app:

| | ChatGPT | Claude |
|---|---|---|
| Theme | follow `dark`/`light` class | follow Claude theme |
| Type & bubbles | match assistant/user message styling | match Claude's message styling |
| Accent | neutral + per-tangent color | neutral + per-tangent color |
| Affordance icon | sits in ChatGPT's hover-action row | sits in Claude's message hover row |

Rendered inside a **Shadow DOM** so the host's CSS can't break us and ours can't break the host.

---

## 11. Accessibility & friction-removal checklist

- Full keyboard path: enter, navigate, switch, close — no mouse required.
- Focus management: opening a tangent moves focus to the composer; Esc returns focus to the
  source message.
- ARIA: panel as a labeled complementary region; map as a tree with `aria-level`.
- Color never the *only* signal — dots also carry titles/labels; source also has a left bar.
- `prefers-reduced-motion` and `prefers-color-scheme` honored.
- Hit targets ≥ 32px; toolbar appears on selection with enough dwell to not flicker.
- Drafts never lost (per-tangent composer persistence).
- Panel width is draggable and remembered; collapses to the rail on narrow windows.

---

## 12. Frictionlessness scorecard (how we'll judge the UI is "done right")

- **Time-to-first-tangent** from a cold install < 15s, with **zero** required reading.
- **Clicks to dig into a passage:** 2 (select → ↳).
- **Clicks to return to main chat:** 1 (Esc), and the page hasn't moved a pixel.
- **Clicks to resume an old tangent:** 1 (the chip on the message).
- **New concepts a user must learn:** ideally 1 ("tangent"), taught in one line.

---

## Open design choices (low-stakes; sensible defaults chosen, easy to revisit)

1. **Verb/label** — "Tangent" (on-brand) vs. plainer "Ask about this." Default: show *"↳ Ask
   about this"* on the selection toolbar (instantly clear), call the saved thing a *"tangent"*.
2. **Default panel side** — right (default) vs. following the host's own layout.
3. **Focus-dim** default — off (chosen) vs. on.
