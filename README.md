# Sunny Side: concept website

A **private concept** for Sunny Side, a truck-and-trailer repair business at 2605 Oakland Ave., Garland, TX 75041 (address and logo supplied by Samson). The name, trade, address and roadside-assistance service are on the site as facts; everything else about the business (phone, hours, service area, services, reviews, warranty) is a highlighted placeholder until the owner confirms it. This is not a live business site.

Built with Astro 7 (static output), self-hosted fonts, no third-party requests, no analytics, no backend.

## Run it

Needs Node 24.

```sh
npm install
npm run dev          # local dev server
npm run build        # concept build (noindex, preview banner, placeholders shown)
npm run preview      # serve dist/ locally
```

## Verify it

```sh
npm run verify       # astro check, build, unit tests, browser tests, HTML validation, Lighthouse
```

One-time setup for the browser tests and Lighthouse: `npx playwright install chromium`.

| Command | What it checks |
|---|---|
| `npm run check` | Astro/TypeScript diagnostics |
| `npm run test:unit` | Launch gate logic, and a throwaway all-confirmed copy built in launch mode |
| `npm run test:e2e` | Playwright: noindex, zero third-party requests, no invented phone or prices, forbidden-claim words, non-submitting form, axe (WCAG 2.0 to 2.2 A/AA) at 360/768/1280, keyboard focus, tap targets, no horizontal scroll |
| `npm run lint:html` | `html-validate` on `dist/` (run after a build) |
| `npm run lighthouse` | Lighthouse mobile on `/` and `/404.html` against targets (categories at least 95, LCP at most 2.5 s, CLS at most 0.1, TBT at most 200 ms) |

The browser tests write screenshots to `../reports/screenshots/` and Lighthouse writes to `../reports/lighthouse/`, outside this repo.

## How "no false claims" is enforced

- `src/data/site.json` is the **only** place business facts live. Each fact has a `value`, a `status` (`confirmed`, `unconfirmed` or `not-offered`) and a `source`.
- Unconfirmed facts render as marked placeholders (`<mark class="tbc">`, announced to screen readers).
- The concept build is `noindex` with `robots.txt` blocking all crawlers. JSON-LD is only emitted in a launch build, and only from confirmed facts.
- `npm run build:launch` runs the **launch gate** first and refuses to build while anything is unconfirmed. Both the gate and the launch build are tested.
- `npm run punchlist` regenerates the client confirmation checklist from the same data file.

## Deployment (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy.yml`:

1. `npm run verify` (type check, build, unit tests, browser tests, HTML validation, Lighthouse).
2. Builds again with `SITE_BASE=/sunny-side` (the project site is served under that path) and runs the browser tests against *that* build.
3. Publishes `dist/` to GitHub Pages: https://midvora.github.io/sunny-side/
4. Smoke-tests the live URL (`scripts/smoke.mjs`): content present, `noindex` held, every same-origin asset returns 200, unknown paths return the 404 page.

What gets published is the **concept build**: `noindex`, preview banner, placeholders shown. It is public but not meant to be found by search. The workflow never runs `build:launch`. `verify.yml` runs the same checks on pull requests.

To test the Pages variant locally: `SITE_BASE=/sunny-side npm run build && SITE_BASE=/sunny-side npm run test:e2e`.

## Going live (not yet approved)

1. Replace placeholders in `src/data/site.json` with confirmed facts (and delete services that are not offered).
2. Approve a real request-form destination and privacy handling, then replace the preview form. Until then the form sends nothing.
3. `npm run build:launch` (the launch gate must pass), then point the deploy workflow at it and connect the real domain. Going live needs sign-off from Samson.

## Layout

```
src/data/site.json      every business fact, service and FAQ answer, with status and source
src/assets/logo.png       the client logo (cropped, transparent background; original is outside the repo)
src/components/         Fact, CallButton, Logo, RequestForm, HeroArt
src/layouts/Base.astro  head, banner, header, footer, mobile action bar
src/pages/              index, 404, robots.txt
scripts/                launch gate, punchlist generator, Lighthouse runner, tests
tests/e2e/              Playwright suite
```
