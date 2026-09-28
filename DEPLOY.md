# Deploying DeliShop to deliarte.ir (cPanel)

## Architecture

`app/` is a Vite + React + TypeScript app. The shared cPanel host has no
Node.js support (only PHP), so the app cannot be built on the server. Instead:

1. `.github/workflows/deploy.yml` builds the app on every push to `main` and
   force-pushes the built static output (`app/dist`) to a `deploy` branch,
   together with a `.cpanel.yml` that tells cPanel where to copy the files.
2. cPanel's **Git™ Version Control** clones the `deploy` branch and, on
   deploy, copies its contents into the site's document root.

## Hosting details on record

- cPanel user: `deliar` (home: `/home/deliar`)
- Primary domain: `deliarte.ir`, document root: `/home/deliar/public_html`
- Shared IP: `130.185.76.122`
- DNS: `deliarte.ir` and `www.deliarte.ir` A records already point to the
  host IP — no DNS changes needed.
- SSL: already active on the domain.

## One-time setup in cPanel (manual — needs your login)

1. Open **Git™ Version Control** → **Create**.
2. **Clone URL**: `https://github.com/Hamidrf/DeliShop.git`
   - The repo must be public, or cPanel needs credentials. If it's private,
     use a GitHub Personal Access Token with read-only repo access in the
     clone URL (`https://<token>@github.com/Hamidrf/DeliShop.git`).
3. **Repository Path**: e.g. `/home/deliar/repositories/delishop`
4. **Branch to clone**: `deploy` (not `main` — `main` has source code, not
   the built site).
5. Click **Create**.
6. Go to the **Pull or Deploy** tab for this repository and click
   **Deploy HEAD Commit** once, to do the first copy into `public_html`.

> Before the first deploy, back up or clear out anything currently in
> `/home/deliar/public_html` that you don't want kept — the deploy task
> copies files in but does not delete existing ones.

## Ongoing deploys

Right now, pushing to `main` rebuilds and updates the `deploy` branch
automatically, but cPanel does **not** auto-pull — you still need to click
**Update from Remote** then **Deploy HEAD Commit** in the Pull or Deploy tab
after each push.

Optional next step: fully automate this by adding a step at the end of the
GitHub Action that calls cPanel's API (`UAPI VersionControl` pull + deploy)
using a cPanel API token stored as a GitHub Actions secret. Ask if you want
this set up.

## Still needed from you

- Merge this branch's changes into `main` (the workflow only triggers on
  pushes to `main`).
- Confirm whether `Hamidrf/DeliShop` is public or private, so we know if a
  token is needed for the cPanel clone URL.
