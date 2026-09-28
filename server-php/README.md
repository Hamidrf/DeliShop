# DeliShop PHP backend

Plain PHP (no framework, no Composer dependencies) API for the DeliShop app
(`../app`). Runs on shared cPanel hosting alongside the built frontend — see
`../DEPLOY.md` for how the two get assembled and deployed together.

Ported 1:1 from an earlier Node/Hono/PostgreSQL version (routes, validation,
rate limiting, session handling) so the frontend needed zero changes — same
`/api/*` contract, same JSON error shape, same cookie-based session.

## Local setup

Requires PHP 8.1+ with `pdo_mysql`, and either `imagick` or `gd` (for image
processing — `imagick` is preferred when present: it handles HEIC input and
EXIF auto-orientation without a separate extension). A local MySQL/MariaDB
server.

```sh
mysql -u root -e "CREATE DATABASE delishop_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root delishop_dev < migrations/001_init.sql

export DB_HOST=127.0.0.1
export DB_NAME=delishop_dev
export DB_USER=root
export DB_PASS=
export APP_ORIGIN=http://localhost:5173
export MEDIA_DIR="$(pwd)/uploads/media"
export MEDIA_PUBLIC_BASE_URL=/uploads/media
export RECEIPTS_DIR="$(pwd)/uploads/receipts"

php scripts/create_admin.php admin somepassword
php scripts/seed.php              # loads the 16 original products from ../app/public

php -S localhost:3000 router.php  # then hit e.g. localhost:3000/api/products
```

(`router.php` is a dev-only stand-in for the `.htaccess` rewriting Apache does
in production — it's not used in production itself.)

Run `../app` alongside it (`npm run dev` there, at http://localhost:5173) —
its Vite dev server proxies `/api` and `/uploads` to `localhost:3000` (see
`../app/vite.config.ts`), so `APP_ORIGIN` above must be the Vite dev
server's own origin, not this PHP server's.

Note: locally, requests go straight to `index.php?ds_route=...` (no
`.htaccess` rewriting — PHP's built-in server doesn't process it). In
production, Apache's `.htaccess` rewrites `/api/<rest>` to that same query
string form, so the two behave identically.

## Structure

```
server-php/
  index.php          Front controller: routes, dispatches, catches ApiError -> JSON
  config.php          Reads config from env vars (local) or an external file (production)
  config.example.php   Template for that external production config file
  lib/
    db.php             PDO connection, UUID generation, date helpers
    errors.php         ApiError + the JSON error shape
    validators.php     Enums, order-item validation, phone normalization
    session.php        Cookie-based session (mirrors the original design's sliding 14-day session)
    storage.php         Disk storage: `media` inside public_html (served directly by
                        Apache), `receipts` outside it (only readable through the
                        authenticated receipt route)
    uploads.php         File-type sniffing + image processing (Imagick, falls back to GD)
    uploads_extra.php   Re-encode-only helper, used by scripts/seed.php
    rate_limit.php      MySQL-backed fixed-window rate limiting (a PHP request under
                        typical shared hosting is a fresh process each time, so there's
                        no in-memory store to lean on like the original Node version had)
    serialize.php       DB row -> the JSON shape the frontend expects
  routes/               One file per resource, mirroring the old server/src/routes/*.ts
  scripts/              CLI-only (create_admin, seed, cleanup) -- also blocked from direct
                        web access via .htaccess and their own php_sapi_name() check
  migrations/001_init.sql   MySQL schema (see its header comment for the differences
                        from the original PostgreSQL schema)
  .htaccess             Denies direct HTTP access to everything except index.php
  router.php             Dev-only, for `php -S` (see "Local setup" above) -- not used
                        in production, where Apache's own .htaccess does this job
```

## Known differences from the original Node version

- **Rate limiting** is MySQL-backed instead of in-memory (see `lib/rate_limit.php`'s
  docblock) — same limits, same behavior, just persisted.
- **No S3 storage** — files live on local disk (matches the shared-hosting
  decision that replaced Liara/S3-compatible storage as the whole reason for
  this rewrite).
- **HEIC uploads** depend on the host's ImageMagick build including the HEIC
  delegate, which isn't guaranteed on shared hosting. In practice this rarely
  bites: iOS Safari commonly re-encodes HEIC to JPEG on upload through a web
  file input anyway.
- **The unique "one active product per name" rule** is enforced only in
  application code (`ds_name_taken()` before insert/restore), not as a DB
  constraint — MySQL has no filtered/partial unique index. There's a small
  race window between the check and the write; acceptable for a single-admin
  shop.
