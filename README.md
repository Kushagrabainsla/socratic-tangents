# Socratic Tangents

Branch off **any part of an AI reply** — inline, without losing your place.

Select a phrase in a ChatGPT reply, click **↳ Tangent**, and a little thought-bubble opens right
there to dig deeper. It answers through the page's own chat (no API key, no account risk) and keeps
your main conversation untouched. A browser extension (Chrome/Edge), local, no sign-in.

## Install (from source)

```bash
npm install
npm run dev      # opens a browser with the extension loaded
```

Or load a build manually: `npm run build`, then in `chrome://extensions` enable **Developer mode**
→ **Load unpacked** → select `.output/chrome-mv3`.

## Use

1. Open **chatgpt.com** (Claude support is in progress).
2. Select any text in a reply → click **↳ Tangent**.
3. Ask your follow-up in the bubble. The answer appears inline; your chat stays as it was.

## Docs

- [Architecture & adding a new LLM](docs/ARCHITECTURE.md)
- [Deployment & publishing](docs/DEPLOYMENT.md)
- [Design & plan](docs/PROJECT_PLAN.md) · [UX](docs/UX-DESIGN.md) · [Research log](docs/RESEARCH-FINDINGS.md)

## Develop

```bash
npm run compile   # typecheck
npm run build     # production build → .output/chrome-mv3
```
