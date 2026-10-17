# Sunny Side: full-site sample

A **private design sample** for Sunny Side, a truck-and-trailer repair business at 2605 Oakland Ave., Garland, TX 75041 (name, logo and address supplied by Samson). It is built as a complete website, with a home page, nine service pages, roadside assistance, fleet services, about, service area, gallery, FAQ, resources (four guides), contact, a three-step request form, privacy and terms, so the owner can see what a real site feels like.

Everything beyond the name, logo and address is **sample content written by Midvora** (phone, hours, reviews, copy) or **stock photography**. `../TEDDY_CONFIRMATIONS.md` lists all of it. This is not a live business site.

Built with Astro 7 (static output), self-hosted fonts, no third-party requests on load, no analytics, no backend. The forms are a working preview and send nothing.

## Run it

Needs Node 24.

```sh
npm install
npm run dev          # local dev server
npm run build        # sample build (noindex, "design preview" footer)
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
| `npm run test:unit` | Launch gate, opening-hours logic, site-data rules, and a throwaway all-confirmed copy built in launch mode |
| `npm run test:e2e` | Playwright, every page: noindex, zero third-party requests, consistent phone links, no horizontal scroll from 320 to 1280 px, axe (WCAG 2.0 to 2.2 A/AA), plus feature tests (mega menu, mobile drawer, request stepper, gallery lightbox, location tool) and review screenshots |
| `npm run lint:html` | `html-validate` on `dist/` (run after a build) |
| `npm run lighthouse` | Lighthouse mobile on nine key pages through a compressing static server (like production hosting). Targets: performance at least 90, other categories at least 95, CLS at most 0.1, TBT at most 200 ms, lab LCP at most 3.2 s (simulated slow-4G phone with 4x CPU slowdown, which is harsher than most real visits; Google's field threshold is 2.5 s) |

The browser tests write screenshots to `../reports/screenshots/` and Lighthouse writes to `../reports/lighthouse/`, outside this repo. `node scripts/check-links.mjs` checks every internal link in `dist/`.

## How "no false claims" is enforced

- Business facts, services, FAQ answers, page copy, reviews and photos live in `src/data/*.json`. Each carries a `status`: `confirmed`, `sample`, `stock` (photo), `licensed` or `not-offered`.
- `npm run build:launch` runs the **launch gate** first and refuses to build while anything is still `sample` or `stock`. JSON-LD and canonical links are only emitted in a launch build.
- The sample build is `noindex` and `robots.txt` blocks all crawlers.
- `npm run punchlist` regenerates `../TEDDY_CONFIRMATIONS.md` from the same data files, so the list cannot drift from the site.

## Deployment (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy.yml`:

1. `npm run verify`.
2. Builds again with `SITE_BASE=/sunny-side` (the project site is served under that path) and runs the browser tests against that build.
3. Publishes `dist/` to GitHub Pages: https://midvora.github.io/sunny-side/
4. Smoke-tests the live URL (`scripts/smoke.mjs`).

What gets published is the **sample build**. The workflow never runs `build:launch`. `verify.yml` runs the same checks on pull requests.

To test the Pages variant locally: `SITE_BASE=/sunny-side npm run build && SITE_BASE=/sunny-side npm run test:e2e`.

## Going live (not yet approved)

1. Teddy confirms or replaces everything in `../TEDDY_CONFIRMATIONS.md` (delete services he does not offer, swap in real photos and reviews).
2. Approve a real destination and privacy handling for the request and contact forms, then replace the preview submit.
3. `npm run build:launch` (the gate must pass), point the deploy workflow at it and connect the real domain. Going live needs sign-off from Samson.

## Layout

```
src/data/*.json         business facts, services, page copy, FAQ, reviews, areas, photo registry (credits), legal text
src/content/resources/  the four guides, as Markdown
src/pages/              home, services/, resources/, roadside, fleet, about, service area, gallery, FAQ, contact, request, legal, 404, sitemap, robots
src/components/         Header (mega menu), Footer, MobileBar, PageHero, Photo, ServiceCard, StepForm, LocationTool, and other building blocks
src/lib/                data accessors and the launch guard, hours/open-now logic, image helpers, SEO and nav builders
src/scripts/            small client scripts (menus, forms, gallery lightbox, geolocation)
src/styles/             base, chrome, sections, forms, pages
scripts/                launch gate, punchlist generator, Lighthouse runner, static server, link checker, tests
tests/e2e/              Playwright suite
```
