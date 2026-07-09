# Deployment

Two workflows, split only by what they need:

| Workflow                                          | Trigger              | Needs secrets? | Does                                                                                                                             |
| ------------------------------------------------- | -------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [`ci.yml`](../.github/workflows/ci.yml)           | pull requests        | no             | typecheck + build (Chrome + Firefox). Fast "does it build?" feedback before merge                                                |
| [`release.yml`](../.github/workflows/release.yml) | every push to `main` | optional       | auto-bump the patch version, build, publish a GitHub Release with the zips, **and submit to every configured store in parallel** |

CI runs on PRs only and never touches release logic or store credentials. Everything that _ships_
lives in `release.yml`: a `build` job publishes the GitHub Release and hands the zips to one job per
store (Chrome, Edge, Firefox) that run **in parallel**. Each store job **auto-skips** until its
secrets exist, so releasing works on day one (GitHub Release only) and turns into store publishing as
you add credentials.

## Releasing

**Just merge to `main`.** Every push to `main` is a release: `release.yml` builds, publishes a
GitHub Release, and submits to every configured store.

- **Parallel and independent:** each store is its own job, so they run at the same time and one
  failing never blocks the others. A final `result` job turns the overall run **red if any configured
  store failed**, even though the others still published. Stores without secrets are skipped and do
  not count against the run.
- **Versioning:** `package.json` holds only the `major.minor` you control by hand (e.g. `0.1`). The
  published patch is the workflow **run number**, computed at build time as `major.minor.<run_number>`.
  It is never committed, so `main` is never written back to — **nothing to pull after a release** —
  and run numbers only increase, so store versions stay monotonic.
- Bump `major.minor` in `package.json` yourself only when you want a meaningful version jump.
- A `concurrency` group serializes releases, so rapid merges queue instead of racing.
- Need to skip a release for a docs-only commit? Put `[skip ci]` in the commit message.

> Heads-up: each release submits a new version to the Chrome Web Store, and **every submission goes
> through review**. If you push many small commits, batch them (or use `[skip ci]`) to avoid a queue
> of review submissions. While a previous version is still in review or ready to publish, the Chrome
> API rejects the next upload with `ITEM_NOT_UPDATABLE`. The release workflow treats that one case as
> a soft skip (it logs a warning and stays green, and other stores still publish); resubmit that
> version from the Chrome dashboard, or just let the next push ship once review clears. Any other
> Chrome error still fails the run.

## Store setup

Add these as **GitHub → Settings → Secrets and variables → Actions**. A store publishes only when all
of its secrets are present.

### Chrome Web Store

One-time **$5** developer registration. Create the item by uploading a first zip manually to get its
**extension ID**, then create Web Store API OAuth credentials + a refresh token.

- `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`

### Microsoft Edge Add-ons (**free**)

Edge is Chromium, so it ships the _same_ Chrome zip. Register (free) in Partner Center, create the
item to get the **product ID**, and create API credentials.

- `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`

### Firefox Add-ons / AMO (**free**)

Create AMO API credentials (JWT issuer + secret).

- `FIREFOX_EXTENSION_ID`, `FIREFOX_JWT_ISSUER`, `FIREFOX_JWT_SECRET`

> Step-by-step credential guides for all three: <https://wxt.dev/guide/essentials/publishing.html>

### Safari (a separate effort, not wired into the pipeline)

Safari uses WebKit and does not accept a WebExtension zip, so shipping there is a one-time conversion
rather than just adding secrets:

1. Convert the built extension with Xcode: `xcrun safari-web-extension-converter .output/chrome-mv3`.
2. Open the generated Xcode project, which wraps the extension in a small macOS/iOS app.
3. Sign it with a paid **Apple Developer** account ($99/yr) and submit the app to the **App Store**
   (Safari extensions ship inside an app and go through App Store review).

Safari's WebExtension API has gaps, so test the converted build before shipping. Because this is a
different toolchain (Xcode, not `wxt submit`), it is intentionally left out of `release.yml`.

## Without a store (free, higher friction)

For Chrome users before/without the $5: link the **GitHub Release** zip and have them unzip and use
`chrome://extensions` → Developer mode → **Load unpacked**. See the install steps in the
[README](../README.md). (Firefox also supports a self-hosted _signed_ `.xpi` via an unlisted AMO
submission, if you prefer not to list publicly.)

## Heads-up on review

Store review takes hours to days, and an extension that interacts with a site like ChatGPT can draw
extra scrutiny. We keep `host_permissions` minimal and ship no background/remote code, which helps.
Have a privacy policy ready before you submit.

## Local equivalents

```bash
npm run build         # .output/chrome-mv3
npm run zip           # .output/socratic-tangents-<version>-chrome.zip   (also used for Edge)
npm run zip:firefox   # Firefox + sources zips
npm run submit -- --chrome-zip … --chrome-extension-id …   # manual one-off submit
```
