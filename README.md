<div align="center">

# Socratic Tangents

**Branch off any part of an AI reply without losing your place.**

A browser extension that makes a long ChatGPT or Claude answer something you can explore. Select a
phrase, ask a follow-up in a small thought bubble right there, and keep your main chat clean. No API
key. Nothing leaves your browser.

</div>

---

## The problem

You ask an LLM something big and get a dense answer back. Then the friction starts. To dig into one
part you either open a new chat, which forgets everything, or you keep asking in the same thread,
which buries the original answer and makes you scroll to follow your own train of thought. Deep,
branching learning gets flattened into one messy line.

## What it does

Select any text in a reply and click **Tangent**. A focused thought bubble opens, anchored to that
passage. Ask your follow-up and the answer appears inline, in the model's own style. Your main chat
stays exactly as it was. The bubble follows the passage as you scroll, and shrinks to a side pill
when you scroll away, so a tangent is always one click from where it belongs.

## Why it is different

- **No API key, no extra cost.** It uses your existing ChatGPT or Claude session by driving the
  page's own chat. The site handles everything, and your account is never put at risk.
- **Private by default.** No backend, no sign-in, no telemetry. Everything runs locally in your browser.
- **Feels native.** It matches the host theme and renders answers in the model's own styling. It
  should feel like a feature the LLM shipped itself.
- **Your thread stays clean.** Tangents leave no clutter behind in the main conversation.

## Install

Store listings (Chrome, Edge, Firefox) are on the way. For now, install from source:

```bash
npm install
npm run dev      # opens a browser with the extension loaded
```

Or build and load it manually. Run `npm run build`, open `chrome://extensions`, turn on
**Developer mode**, click **Load unpacked**, and select `.output/chrome-mv3`.

## Use

1. Open **chatgpt.com**.
2. Select any text in a reply and click **Tangent**.
3. Ask your follow-up in the bubble. The answer lands inline, and your chat is untouched.

## Status

- **ChatGPT** works today.
- **Claude** is in progress. The code is provider-agnostic, so it is a matter of tuning selectors.
- Adding another LLM is a small adapter, not a rewrite. See the architecture guide.

## Documentation

| Doc | What it covers |
|---|---|
| [Architecture and adding an LLM](docs/ARCHITECTURE.md) | How it is built, and how to add a provider in three steps |
| [Deployment and publishing](docs/DEPLOYMENT.md) | CI/CD and store publishing |

## Develop

```bash
npm run compile   # typecheck
npm run build     # production build into .output/chrome-mv3
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
