# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

"爱刷题" (exam.aili.site) — an online quiz practice and mock exam platform for Chinese university politics courses (毛概, 思修, 近代史, 马原). Pure static frontend with LeanCloud BaaS, deployed via GitHub Pages.

## Development

```bash
# Run locally
python -m http.server 8000
# Or: npx http-server
# Or: php -S localhost:8000
```

No build step, no package manager, no test suite. It's vanilla HTML/CSS/JS served as static files.

## Architecture

This is a **single-page application** — all views live in `index.html` (8111 lines), with corresponding styles in `style.css` (6394 lines) and logic in `script.js` (8116 lines). Navigation is done by showing/hiding DOM sections via the `hidden` CSS class — there is no URL-based routing.

### Bootstrap and versioning

- **`index.js`** loads before `index.html` and checks `localStorage['appVersion']` against `CURRENT_VERSION` (currently `"3.2.7"`). If they differ, it clears all localStorage/sessionStorage and stores the new version. This is the cache-busting mechanism.
- **`begin.html`** is an interstitial page that redirects to `index.html` — used for session cleanup after version bumps.

### Backend (LeanCloud)

All data is stored in LeanCloud (similar to Parse). Configuration lives in `config/leancloud-config.js`, which switches between DEV and PROD credentials based on `window.location.hostname`.

The `js/` directory contains domain-specific modules:
- **`leancloud-client.js`** — Core CRUD operations (questions, users, sessions). All database interactions go through here.
- **`user-progress-api.js`** — User learning progress sync between cloud and localStorage. Cloud sync is partially implemented (UI buttons disabled).
- **`subject-api.js`** — Fetches enabled subjects from the `Subject` table.
- **`visit-stats.js`** — Anonymous visit counting (daily + total) to a `VisitCounter` table.

### CDN resilience

The app depends on CDN-hosted libraries (particles.js, LeanCloud SDK). Email is handled by a self-hosted Express mail server at `https://mail.aili.site` (nodemailer + QQ SMTP), replacing the previous EmailJS client-side solution.
- **`particles-fallback.js`** — Mock particles when CDN fails.
- **`resource-status.js`** — Bottom status panel showing load state of particles and LeanCloud.

### Theme system

- **`theme/theme.js`** — `ThemeManager` class that switches between default and minimal (dark) themes. Minimal theme is gated behind SVIP/SSSVIP membership.
- **`theme/theme.css`** — Dark theme overrides.

### Local storage keys

User data persisted in localStorage: `examUser`, `exam_progress`, `exam_favorites`, `exam_wrong`, `exam_stats`. These are the app's source of truth for user state; cloud sync is secondary.

### Activity module

`activety/` contains a self-contained lottery/invitation system (`activity.js` at ~32k lines) where users spin a wheel and invite others to earn membership days.

## Deployment

Git push to `main` triggers deployment. The GitHub Actions workflow (`.github/workflows/indexnow.yml`) waits 180 seconds for deployment to finish, then submits the homepage URL to IndexNow for search engine notification. The site can also be deployed with the SCP deploy hook.

Key SEO files in root: `robots.txt`, `sitemap.xml`, `BingSiteAuth.xml`, and the IndexNow key file `22c515d4-090b-4bff-8698-2c2f6511f995.txt`.

## Code conventions

- All JS is ES6+ with global functions and variables — no modules, no imports/exports. Everything attaches to `window`.
- Functions are organized by feature area in `script.js` rather than by technical role. Search for related functions near each other.
- DOM elements use IDs for unique elements and classes for repeated patterns.
- Environment detection: `localhost` / `127.0.0.1` / `192.168.*` triggers DEV config; everything else uses PROD.
