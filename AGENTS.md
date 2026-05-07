# bingo-generator — Agent Guide

## Quick start

```sh
npm install        # installs `serve` (only dev dependency)
npm run dev        # serves static site at http://localhost:3000
npm start          # same but clipboard enabled
```

## Architecture

- **Vanilla JS ES module** (`type: "module"` in `package.json`). No framework, no bundler, no build step.
- **Entry point**: `index.html` → loads `js/app.js` as `<script type="module">`.
- **Module split**:
  - `js/app.js` — UI orchestration, event wiring, state
  - `js/bingo.js` — `buildPool()`, `generateCards()` — pure card generation logic
  - `js/db.js` — IndexedDB wrapper for persisting uploaded images
  - `js/pdf.js` — jsPDF-based PDF export
- **External dep**: jsPDF 2.5.1 loaded via CDN in `index.html` (not npm). The `serve` npm dep is only for local dev.
- **CI**: GitHub Actions on push to `main` deploys the repo root as a static site to GitHub Pages (`.github/workflows/deploy.yml`).

## Key constraints

- **Spanish UI** — validation messages, toasts, and error strings are in Spanish.
- **Card generation** requires ≥1 image and ≥23 numbers in the pool. Each card = 2 random images + 23 random numbers in a 5×5 grid.
- **Image persistence**: IndexedDB (via `db.js`). **Logo persistence**: `localStorage` key `bingo-logo-dataurl`.
- **PDF export** fetches the Anton font from jsDelivr (`cdn.jsdelivr.net/gh/google/fonts/...`) at export time. Falls back to helvetica-bold if unreachable.

## Gotchas

- No tests, no linter, no typecheck, no formatter config exist.
- `js/test_clip.js` is dead code (was a discarded test attempt, safe to delete).
- `images/logo.jpg` is referenced as default logo but the repo has `images/logo.png` — the fallback logic in `loadDefaultLogo()` gracefully handles the missing file.
