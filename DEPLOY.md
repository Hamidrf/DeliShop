# Deploying DeliShop to deliarte.ir (cPanel)

## Architecture

- `app/` — Vite + React + TypeScript frontend, built to static files.
- `server-php/` — plain PHP API (no framework, no Composer deps), talking to
  a MySQL database. See `server-php/README.md` for how it's structured.

Both run from the same shared cPanel host, same origin (no CORS): the built
frontend at the site root, the PHP API under `/api/`.

An earlier version of this project used a Node.js/PostgreSQL backend meant
for Liara (a Node-friendly host) — abandoned in favor of this PHP/MySQL
rewrite so the site could run on the cPanel hosting already paid for, at no
extra monthly cost. `docs/backend-architecture.md` documents that earlier
design; it's kept for reference but no longer describes what's deployed.

## Hosting details on record

- cPanel user: `deliar` (home: `/home/deliar`)
- Primary domain: `deliarte.ir`, document root: `/home/deliar/public_html`
- DNS: already points at this host, SSL already active.
- PHP extensions confirmed available: `imagick`, `gd`, `pdo_mysql` (as
  `nd_pdo_mysql`/`mysqlnd` in this cPanel's extension list), `exif`, `curl`, `zip`.
- Database: `deliar_delishop` (MySQL), created via cPanel's Database Wizard.
- Private config file: `/home/deliar/delishop-config.php` (one level above
  `public_html`, never in git, never touched by a deploy).

## How deploys work

`.github/workflows/ci.yml` builds the frontend, syntax-checks the PHP,
assembles both into one tree, and pushes it to a `deploy` branch on every
push to `main`.

**cPanel's own Git™ Version Control cannot reach GitHub from this host**
(confirmed: `Update from Remote` fails with "could not contact the remote
repository" — likely an international-connectivity restriction specific to
whatever protocol/IPs that tool uses). PHP's `curl`, however, *can* reach
`codeload.github.com` from this host (confirmed via a connectivity test).

So deploys are fully automated a different way: right after the GitHub
Action pushes the `deploy` branch, it calls
`POST https://deliarte.ir/api/setup/self-deploy` with a secret token. That
route (`server-php/lib/self_deploy.php`) downloads that exact commit as a
zip straight from `codeload.github.com` and copies it over `public_html`,
overwriting matching files. It never deletes anything, so
`public_html/uploads/media` (not part of the deploy artifact) is always
left alone.

**Net effect: pushing to `main` deploys to the live site with no manual
step on this host.** The old cPanel Git repository (if still listed under
Git™ Version Control) is no longer used for anything and can be ignored or
deleted.

**Why by commit SHA, not by branch name:** self-deploy used to fetch
`codeload.github.com/.../zip/refs/heads/deploy` (the branch ref). The
`deploy` branch is force-pushed as a brand-new commit on every single
deploy, but self-deploy is called within seconds of that push, and
GitHub's codeload CDN caches branch-ref zip downloads for a few minutes —
so the "fresh" zip fetched right after a push could silently still be the
**previous** deploy's content. Confirmed the hard way: several code
changes appeared to have zero effect on the live site, including after
restarting PHP on the host, until this was traced to the zip download
itself being stale rather than anything on the PHP side. The CI workflow
now captures the deploy branch's just-pushed commit SHA and sends it to
self-deploy, which fetches `codeload.github.com/.../zip/<sha>` instead —
content-addressed and immutable, so even a cached response for it is
guaranteed correct.

### Secrets involved

- `deploy_token` in the private config file, and the same value as the
  `DEPLOY_TOKEN` secret in the GitHub repo's Settings → Secrets and
  variables → Actions. Permanent — required for every deploy to work.
- `setup_token` in the private config file gated two one-time bootstrap
  routes (`/api/setup/create-admin`, `/api/setup/seed`) used during initial
  setup, when this host had no Terminal/SSH access. **Left blank now that
  setup is done** — those routes 404 until/unless it's set again.

## Already done

- Database created and migrated (`server-php/migrations/001_init.sql`).
- First admin account created (logged into `/studio/login` — confirmed
  working).
- The 16 original products seeded.
- Automated deploy via `self-deploy` wired up and confirmed working.

## If you ever need Terminal-less one-off admin work again

Temporarily set `setup_token` back to a new secret in the private config
file, push any small change to `main` (so the new token reaches the live
site via self-deploy), use the route, then blank `setup_token` again:

```js
// In the browser console, on https://deliarte.ir
fetch('/api/setup/create-admin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: 'TOKEN', username: '...', password: '...' }),
}).then(r => r.json()).then(console.log)
```

## Rolling back a bad deploy

There's no separate rollback mechanism — `self-deploy` always pulls whatever
is currently at the tip of the `deploy` branch, which always mirrors the
tip of `main`. To roll back: `git revert` the bad commit(s) on `main` (or
push a fix) and push. That rebuilds and redeploys automatically, same as
any other change. There's no staging environment, so a bad push is live
until you push the fix — test locally first (see `CLAUDE.md`).

## Daily cleanup cron (optional, not yet set up)

cPanel → **Cron Jobs** → add one running daily:

```sh
php /home/deliar/public_html/api/scripts/cleanup.php
```

Deletes expired login sessions and receipts for orders finished over a year
ago.
