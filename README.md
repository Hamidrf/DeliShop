# DeliShop

A small online shop for handmade keychains/earrings/pins: browse products,
place an order with a payment receipt photo, and an admin "studio" to manage
products and review orders.

- **`app/`** — React + TypeScript + Vite frontend.
- **`server-php/`** — plain PHP API (no framework, no Composer) + MySQL.
- Both are built and deployed together as one site at **https://deliarte.ir**,
  same origin (the PHP API answers `/api/*`, everything else is the built
  frontend).

**Before changing anything here, read [`CLAUDE.md`](./CLAUDE.md)** — it has
the things that aren't obvious from the code alone (how deploys work, what
not to break, where the secrets live).

## Local development

Frontend:
```sh
cd app
npm install
npm run dev          # http://localhost:5173
```

Backend (needs a local MySQL/MariaDB) — see [`server-php/README.md`](./server-php/README.md)
for the full setup. Quick version:
```sh
cd server-php
mysql -u root -e "CREATE DATABASE delishop_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root delishop_dev < migrations/001_init.sql
# set the env vars server-php/README.md lists, then:
php scripts/create_admin.php admin somepassword
php scripts/seed.php
php -S localhost:3000 router.php
```
Run both at once; Vite's dev server proxies `/api` and `/uploads` to the PHP
server on port 3000 (see `app/vite.config.ts`).

## Production

See [`DEPLOY.md`](./DEPLOY.md) — hosting details, how the automated deploy
pipeline works, and what to do for one-off admin tasks. Short version:
**pushing to `main` deploys to the live site automatically, with no manual
step.** There's no staging environment, so test locally first.

## Other docs

- [`docs/backend-architecture.md`](./docs/backend-architecture.md) — the
  original design doc (data model, API contract, auth design). Written for
  an earlier Node.js/PostgreSQL/Liara version that was abandoned in favor of
  the current PHP/MySQL/cPanel setup (see `DEPLOY.md` for why), but the API
  contract and data model it describes are still accurate.
- [`chats/`](./chats/), [`project/`](./project/) — the original design
  handoff (HTML/CSS mockups + design chat transcripts) this app was built
  from. Historical reference only; not part of the running app.
