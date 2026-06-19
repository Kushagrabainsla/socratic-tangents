# Deployment

Two workflows, split only by what they need:

| Workflow | Trigger | Needs secrets? | Does |
|---|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | every push to `main` + PRs | no | typecheck + build (Chrome + Firefox) — fast "does it build?" feedback |
| [`release.yml`](../.github/workflows/release.yml) | push a `v*` tag | optional | build, create a GitHub Release with the zips, **and submit to every store you've configured** |

CI is separate on purpose: it runs constantly and must never touch release logic or store
credentials. Everything that *ships* lives in one place — `release.yml` — triggered intentionally by
a version tag. Each store step **auto-skips** until its secrets exist, so releasing works on day one
(GitHub Release only) and turns into store publishing as you add credentials.

## Cut a release

```bash
npm version patch       # bumps package.json (= manifest version) + creates a v* tag
git push --follow-tags  # → release.yml builds, makes a GitHub Release, submits to configured stores
```

## Store setup

Add these as **GitHub → Settings → Secrets and variables → Actions**. A store publishes only when all
of its secrets are present.

### Chrome Web Store
One-time **$5** developer registration. Create the item by uploading a first zip manually to get its
**extension ID**, then create Web Store API OAuth credentials + a refresh token.
- `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`

### Microsoft Edge Add-ons — **free**
Edge is Chromium, so it ships the *same* Chrome zip. Register (free) in Partner Center, create the
item to get the **product ID**, and create API credentials.
- `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`

### Firefox Add-ons (AMO) — **free**
Create AMO API credentials (JWT issuer + secret).
- `FIREFOX_EXTENSION_ID`, `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`

> Step-by-step credential guides for all three: <https://wxt.dev/guide/essentials/publishing.html>

## Without a store (free, higher friction)

For Chrome users before/without the $5: link the **GitHub Release** zip and have them unzip and use
`chrome://extensions` → Developer mode → **Load unpacked**. See the install steps in the
[README](../README.md). (Firefox also supports a self-hosted *signed* `.xpi` via an unlisted AMO
submission, if you prefer not to list publicly.)

## Heads-up on review

Store review takes hours to days, and an extension that interacts with a site like ChatGPT can draw
extra scrutiny. We keep `host_permissions` minimal and ship no background/remote code, which helps.
Have a privacy policy ready. See the ToS/store notes in [RESEARCH-FINDINGS.md](RESEARCH-FINDINGS.md).

## Local equivalents

```bash
npm run build         # .output/chrome-mv3
npm run zip           # .output/socratic-tangents-<version>-chrome.zip   (also used for Edge)
npm run zip:firefox   # Firefox + sources zips
npm run submit -- --chrome-zip … --chrome-extension-id …   # manual one-off submit
```
