# Working on DeliShop — read this first

This file is for whoever (human or AI) changes this codebase next. It's the
"don't rediscover this the hard way" list. Full details live in
`DEPLOY.md`, `server-php/README.md`, and `docs/backend-architecture.md`
(historical, see its own header note) — this file just tells you which of
those to read and what to watch out for.

## The one thing that matters most: pushing to `main` deploys to production, instantly, with no review gate

There is no staging environment. `.github/workflows/ci.yml`'s `deploy` job
runs on every push to `main`: it builds `app/`, assembles it with
`server-php/`, pushes the result to a `deploy` branch, then calls
`POST https://deliarte.ir/api/setup/self-deploy` — which makes the live site
download that build from GitHub and copy it over itself within seconds. See
`DEPLOY.md`'s "How deploys work" section for exactly how and why (short
version: cPanel's own Git tool can't reach GitHub from this host at all, so
the site pulls itself instead).

**Consequence: test locally before pushing to `main`.** The `test` job
(build + lint the frontend, `php -l` every PHP file) gates the deploy job,
but that only catches syntax errors and frontend build/lint failures — it
does not run the PHP backend or click through the app. There is no
automated test suite for `server-php/` (the earlier Node version had one;
it didn't carry over in the PHP rewrite — see "History" below).

## Architecture in one paragraph

`app/` (Vite + React + TypeScript) and `server-php/` (plain PHP, no
framework or Composer) are built and deployed together as one site, same
origin: the built frontend at the site root, the PHP API under `/api/*`.
No CORS, no cross-site cookies — session auth is a plain `HttpOnly` cookie.
MySQL is the database (not PostgreSQL — see "History"). Local dev setup is
in `server-php/README.md`; hosting/deploy specifics are in `DEPLOY.md`.

## The frontend and backend API contract is not type-shared — keep them in sync by hand

`app/src/lib/api.ts` is the frontend's HTTP client; `server-php/routes/*.php`
implement the actual endpoints. There's no shared schema or codegen between
them (unlike a typical TS-monorepo setup). If you change a request/response
shape, a status code, or an error `code` string on one side, **you must
change the other side to match**, and check every frontend call site
(`app/src/lib/*.ts`, `app/src/pages/*.tsx`) that touches that endpoint.

Current routes (all under `/api`): `GET /health`, `GET /products`,
`POST /orders`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`,
`GET|POST /studio/products`, `POST /studio/products/:id` (edit — see note
below), `DELETE /studio/products/:id`, `POST /studio/products/:id/restore`,
`GET /studio/orders`, `GET /studio/orders/:id`,
`GET /studio/orders/:id/receipt`, `PATCH /studio/orders/:id`, plus the
setup/deploy routes below.

`POST /studio/products/:id` edits a product, not `PATCH`: it's a multipart
body (optional new drawing/photo files), and PHP only populates
`$_POST`/`$_FILES` for POST — it never parses a multipart body on PATCH. Its
`keepPhotoKeys` field (a JSON array of existing photo storage keys, from
`ds_serialize_studio_product`'s `photoKeys`) says which of the product's
current photos to keep and in what order; anything not listed is dropped,
and new `photos[]` files are appended after. See `routes/studio_products.php`.

## Android app (Google Play)

Shipped as a Trusted Web Activity wrapping the live site — see `ANDROID.md`.
Don't change the manifest `id`/`scope`, the package name, or
`/.well-known/assetlinks.json` without reading it; `sw.js` is deliberately
non-caching (offline page only).

## Secrets and where they live

Production config (DB credentials, `app_origin`, storage paths, and the two
tokens below) lives in `/home/deliar/delishop-config.php` — **one level
above `public_html`, never in git, never touched by a deploy.**
`server-php/config.example.php` is a template only; it must never contain a
real secret.

- **`deploy_token`** — permanent. Must match the `DEPLOY_TOKEN` secret in
  this GitHub repo's Settings → Secrets and variables → Actions. Every
  deploy depends on it. If you rotate it, update **both** places together,
  or deploys silently stop working (the self-deploy route 404s on a
  mismatched/blank token, and the CI step is `continue-on-error: true`, so
  it fails quietly — check the Actions log for the "Trigger self-deploy"
  step if a push doesn't seem to have gone live).
- **`setup_token`** — one-time-use, meant to stay **blank** in normal
  operation (the two routes it guards 404 when it's blank). Only set it
  temporarily if you need `/api/setup/create-admin` or `/api/setup/seed`
  again (this host has no Terminal/SSH, which is why these HTTP routes
  exist instead of only `scripts/create_admin.php` / `scripts/seed.php`).
  Blank it again afterward.

Never put either token, or the DB password, in a chat, commit message, or
anywhere else outside that one config file and the GitHub secret.

## MySQL schema quirks (see `server-php/migrations/001_init.sql`'s header comment for the full list)

- No `CHECK` constraints — some shared-hosting MySQL/phpMyAdmin setups
  reject that syntax outright. `price > 0` and `quantity` 1–20 are
  validated in PHP (`routes/orders.php`, `routes/studio_products.php`)
  instead; don't remove those checks assuming the DB enforces them.
- `orders.number` is a plain `AUTO_INCREMENT` column (starting at 1001),
  not a sequence — MySQL allows this on a non-primary column as long as
  it's indexed.
- No partial/filtered unique index for "one active product per name" —
  enforced in `ds_name_taken()` (`routes/studio_products.php`) before
  insert/restore. There's a small check-then-insert race window; accepted
  as fine for a single-admin, low-traffic shop.
- IDs are UUIDs generated in PHP (`ds_uuid4()` in `lib/db.php`), not by the
  database.
- Rate limiting (`lib/rate_limit.php`) is MySQL-backed, fixed-window — not
  in-memory, because a shared-hosting PHP request is a fresh process every
  time (no persistent process to hold state in).
- A product's real photos live in a `product_photos` child table (0–6 per
  product, ordered by `position`), not a column on `products` — added in
  `migrations/002_product_photos.sql`. Migrations aren't applied
  automatically (no migration runner, no Terminal/SSH on the host): apply a
  new one by hand in phpMyAdmin **before** pushing code that depends on it,
  since a push to `main` goes live within seconds — see `server-php/README.md`.

## Storage: don't break the uploads/receipts split

- `media` (product drawings/photos/voice) lives at
  `public_html/uploads/media/`, served directly by Apache.
- `receipts` (payment receipt photos) live at
  `/home/deliar/uploads-private/receipts/`, **outside** `public_html` —
  only ever read through the authenticated `GET /api/studio/orders/:id/receipt`
  route.
- Neither directory is part of the git repo or the deploy zip (both are
  `.gitignore`'d locally and simply don't exist in the build). This is why
  `self-deploy` (`lib/self_deploy.php`) is safe to run repeatedly: it only
  ever overwrites files that exist in the new build, so it can never touch
  uploaded content. **Don't add an `uploads/` directory to the repo** — it
  would defeat this.

## Image processing

`lib/uploads.php` uses Imagick when available (handles EXIF
auto-orientation and, if the host's ImageMagick was built with the delegate,
HEIC input) and falls back to GD otherwise. The production host has Imagick;
this sandbox/local dev environment may not, which is intentional — it
exercises the GD fallback path. If you touch this file, test both paths if
you can, or at least don't assume Imagick-only APIs are safe.

## History (context, not current state)

An earlier version used Node.js + Hono + PostgreSQL, designed for Liara (a
Node-friendly Iranian PaaS) — see `docs/backend-architecture.md`. It was
abandoned mid-setup in favor of this PHP/MySQL rewrite so the site could run
on the cPanel shared hosting already paid for, at no extra monthly cost.
The API contract and data model in that doc are still accurate (the PHP
rewrite ported them 1:1); its infrastructure/deployment sections (§6–7) are
not — `DEPLOY.md` supersedes them.
