# Deploying DeliShop to deliarte.ir (cPanel)

## Architecture

- `app/` — Vite + React + TypeScript frontend, built to static files.
- `server-php/` — plain PHP API (no framework, no Composer deps), talking to
  a MySQL database. See `server-php/README.md` for how it's structured.

Both run from the same shared cPanel host, same origin (no CORS): the built
frontend at the site root, the PHP API under `/api/`. `.github/workflows/ci.yml`
builds the frontend, syntax-checks the PHP, assembles both into one tree, and
pushes it to a `deploy` branch on every push to `main`. cPanel's **Git™
Version Control** pulls from that branch and copies it into `public_html`.

An earlier version of this project used a Node.js/PostgreSQL backend meant
for Liara (a Node-friendly host) — abandoned in favor of this PHP/MySQL
rewrite so the site could run on the cPanel hosting already paid for, at no
extra monthly cost. `docs/backend-architecture.md` documents that earlier
design; it's kept for reference but no longer describes what's deployed.

## Hosting details on record

- cPanel user: `deliar` (home: `/home/deliar`)
- Primary domain: `deliarte.ir`, document root: `/home/deliar/public_html`
- DNS: already points at this host, SSL already active — nothing to change there.
- PHP extensions confirmed available: `imagick`, `gd`, `pdo_mysql` (as
  `nd_pdo_mysql`/`mysqlnd` in this cPanel's extension list), `exif`.

## One-time setup in cPanel (manual — needs your login)

### 1. Create the MySQL database

**Database Wizard** (or **Manage My Databases**) →

1. Create a database (e.g. `delishop`; cPanel will prefix it, giving you
   something like `deliar_delishop`).
2. Create a database user with a strong password, and grant it **All
   Privileges** on that database.
3. Note the full database name, username, and password — you'll need them
   for step 3 below (not for me; keep them out of chat).

### 2. Create the private config file (outside public_html, holds secrets)

Via **File Manager**, go to `/home/deliar/` (one level *above* `public_html`)
and create a file named exactly `delishop-config.php` there, with this
content (copy `server-php/config.example.php` from the repo as a starting
point and fill in your real values):

```php
<?php
return [
    'db_host' => '127.0.0.1',
    'db_name' => 'deliar_delishop',      // from step 1
    'db_user' => 'deliar_delishop',      // from step 1
    'db_pass' => 'the real password',    // from step 1

    'app_origin' => 'https://deliarte.ir',
    'is_production' => true,

    'media_dir' => '/home/deliar/public_html/uploads/media',
    'media_public_base' => '/uploads/media',
    'receipts_dir' => '/home/deliar/uploads-private/receipts',

    'owner_phone' => '',
    'sms_api_key' => '',
];
```

This file is never in git and never touched by a deploy, so it survives
every future push.

### 3. Run the migration once

Open **phpMyAdmin** (Databases section) → select your new database → **SQL**
tab → paste the contents of `server-php/migrations/001_init.sql` → **Go**.
This creates the tables.

### 4. Create the Git repository in cPanel

**Git™ Version Control** → **Create**:

- **Clone URL**: `https://github.com/Hamidrf/DeliShop.git`
- **Repository Path**: e.g. `/home/deliar/repositories/delishop`
- **Repository Name**: `DeliShop`
- Click **Create**, then switch its checked-out branch to `deploy` (not
  `main` — `main` has source code, not the built site). If there's no
  branch selector in the UI, use **Terminal** (if your plan has one):
  ```
  cd /home/deliar/repositories/delishop
  git checkout deploy
  ```
- Go to the **Pull or Deploy** tab and click **Deploy HEAD Commit**.

### 5. Create the first admin account

Via **Terminal** (Advanced section in cPanel, if available):

```sh
php /home/deliar/public_html/api/scripts/create_admin.php youradminname yourpassword
```

If your plan has no Terminal, tell me and we'll find another way (e.g. a
one-time CLI-guarded script you hit once over HTTP and then delete).

### 6. (Optional) Seed the original 16 products

Only if the database is empty and you want the original catalog back:

```sh
php /home/deliar/public_html/api/scripts/seed.php
```

### 7. (Optional) Daily cleanup cron

cPanel → **Cron Jobs** → add one running daily:

```sh
php /home/deliar/public_html/api/scripts/cleanup.php
```

Deletes expired login sessions and receipts for orders finished over a year
ago.

## Ongoing deploys

Pushing to `main` rebuilds and updates the `deploy` branch automatically,
but cPanel doesn't auto-pull — after each push, go to **Git™ Version
Control** → this repo → **Pull or Deploy** → **Update from Remote**, then
**Deploy HEAD Commit**.

## Still needed from you

- Steps 1–6 above (I can't reach your cPanel account directly).
- Confirm once the admin account is created and you've logged into the
  studio at `/studio/login` so we can verify the whole path end-to-end on
  the live site.
