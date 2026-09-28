# Deploying DeliShop to Liara

The full stack (frontend + backend) is now one Node.js app on **Liara**,
matching `docs/backend-architecture.md`. It answers `/api/*` and also serves
the built React app (`app/dist`) from the same origin — no CORS, no separate
static host.

The previous cPanel-only static deploy (frontend on `deliarte.ir` via
cPanel Git Version Control) is retired. `deliarte.ir` will point at Liara
instead once DNS is switched (last step below). The cPanel hosting account
itself isn't deleted — it's just no longer used for this site unless you
want to repurpose it (e.g. email).

## What's already wired in the repo

- `package.json` (root) — `npm run build` builds `app/` then `server/`;
  `npm start` runs `node server/dist/index.js`, which serves both the API
  and `app/dist`.
- `liara.json` — `{ "platform": "node", "app": "delishop", "port": 3000 }`.
  **Rename `"app"` to whatever you actually name the app when you create it
  on Liara** (see step 2 below) — it must match exactly.
- `.github/workflows/ci.yml` — on every push/PR: typecheck, lint, test
  (against a throwaway Postgres service container), build both projects.
  On push to `main` only, after that passes: runs `drizzle-kit migrate`
  against production, then `liara deploy` via `liara-cloud/liara-cli-action@v2`.

I haven't tested this against a real Liara account (no access to one from
here), so treat the first deploy as a dry run — if `liara deploy` fails,
send me the Actions log and I'll adjust `liara.json`/the workflow.

## 1. Create a Liara account

If you don't have one: https://console.liara.ir (Rial billing, Iranian card).

## 2. Create the three resources

In the Liara console:

1. **App** → New App → platform **Node.js** → pick a name (e.g. `delishop`).
   Don't push code yet from the console — GitHub Actions will do it.
2. **Database** → New Database → **PostgreSQL** (smallest plan is enough for
   this traffic). Copy its connection string once created.
3. **Object Storage** → New bucket. Create two: one for public media
   (product/painting photos) and one for private receipts — or one bucket
   with both, if you'd rather keep it simple for now. Note the endpoint,
   access key, secret key, and bucket name(s).

## 3. Generate an API token

Liara console → your account/team settings → **API Tokens** → create one
with deploy access. This is the `LIARA_API_TOKEN`.

## 4. Add GitHub repo secrets

In `github.com/Hamidrf/DeliShop` → Settings → Secrets and variables →
Actions → New repository secret:

- `LIARA_API_TOKEN` — the token from step 3
- `DATABASE_URL` — the Postgres connection string from step 2 (used by CI
  to run migrations before each deploy)

## 5. Set the app's own environment variables

These go in the Liara console, on the **app itself** (Settings →
Environment Variables) — not GitHub secrets, since the running app reads
them directly:

```
NODE_ENV=production
PORT=3000
APP_ORIGIN=https://deliarte.ir
DATABASE_URL=<same Postgres connection string as above>
STORAGE_DRIVER=s3
S3_ENDPOINT=<from your Liara Object Storage bucket>
S3_REGION=default
S3_ACCESS_KEY_ID=<from Object Storage>
S3_SECRET_ACCESS_KEY=<from Object Storage>
S3_MEDIA_BUCKET=<your media bucket name>
S3_RECEIPTS_BUCKET=<your receipts bucket name>
MEDIA_PUBLIC_BASE_URL=<public URL of the media bucket>
SMS_API_KEY=            (optional — leave blank for now)
OWNER_PHONE=            (optional — leave blank for now)
```

## 6. Rename `liara.json` to match your app name, then push

If you named the app anything other than `delishop` in step 2, tell me the
name and I'll update `liara.json` and push — or edit it yourself:

```json
{ "platform": "node", "app": "YOUR-APP-NAME", "port": 3000 }
```

Once secrets are in place (step 4) and this matches, the next push to
`main` (or re-running the workflow) triggers the first real deploy.

## 7. Point deliarte.ir at Liara

In the Liara console, add `deliarte.ir` (and `www.deliarte.ir`) as a custom
domain on the app — it'll show you the exact DNS record to add (usually a
CNAME to something like `your-app.liara.run`, sometimes an A record to a
static IP; Liara's UI states which for your app). Add that record in
wherever `deliarte.ir`'s DNS is managed (same place the current A record
to `130.185.76.122` lives) and remove the old A record once Liara's
domain check goes green. Liara issues its own TLS certificate for the
domain automatically.

## Still needed from you

- Create the app/database/storage on Liara (steps 1–2) and tell me the app
  name if it's not `delishop`.
- Add the two GitHub secrets (step 4).
- Set the app's environment variables on Liara (step 5) — the Object
  Storage and Postgres values come from what you provisioned in step 2.
- Once that's done, tell me and I'll watch the next deploy run and fix
  anything that comes up.
