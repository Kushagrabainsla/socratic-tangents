# Contributing

Thanks for your interest in Socratic Tangents. This is a small, focused codebase and contributions
are welcome.

## Setup

```bash
npm install
npm run dev      # opens a browser with the extension loaded
```

Open chatgpt.com and try it.

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short: provider-specific code lives in
`lib/adapters/`, and the provider-agnostic engine and UI live in `lib/tangent/`.

## Adding support for another LLM

Follow the three steps in [Add a new LLM](docs/ARCHITECTURE.md#add-a-new-llm). You write one adapter
and register it. The engine and UI do not change.

## Code style

- TypeScript in strict mode. Keep `npm run compile` clean.
- ESLint and Prettier enforce the style. Run `npm run lint` and `npm run format` before pushing.
- Small functions that do one thing, with clear names. Prefer readable code over comments.
- Plain language in docs and comments. No em dashes.
- Match the style of the file you are editing.

## Before you open a pull request

```bash
npm run lint      # ESLint
npm run test      # unit tests (Vitest)
npm run compile   # typecheck
npm run build     # production build
```

Then test the change: open `chrome://extensions`, turn on Developer mode, click **Load unpacked**,
select `.output/chrome-mv3`, and reload your ChatGPT tab.

## Commits

Use short, present-tense messages. Conventional Commits are welcome, for example
`feat: add Gemini adapter` or `fix: track bubble position on resize`.

## Reporting issues

Open an issue with your browser, the site (ChatGPT or Claude), and steps to reproduce. Because the
extension reads the page's DOM, a screenshot or the element it failed on helps a lot.
