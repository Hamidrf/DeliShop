# DeliShop server

API for the DeliShop app (`../app`). See `../docs/backend-architecture.md` for the full design
— tech choices, data model, API contract, auth, deployment.

## Local setup

Requires Node 22 and a local PostgreSQL 16.

```sh
createuser delishop --pwprompt   # password: delishop, or edit .env to match
createdb delishop --owner delishop

cp .env.example .env
npm install
npm run db:migrate
npm run seed              # loads the 16 original products from ../app/public
npm run create-admin      # prompts for a username and password, or:
npm run create-admin -- admin somepassword

npm run dev                # http://localhost:3000
```

Run `../app` alongside it (`npm run dev` there) — its Vite dev server proxies `/api` and
`/uploads` here.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Runs the server with `tsx watch` |
| `npm run build` / `npm start` | Compiles to `dist/` and runs it |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | `oxlint` |
| `npm test` | Runs the Vitest suite against `delishop_test` (see below) |
| `npm run db:generate` | Generates a new Drizzle migration from `src/db/schema.ts` |
| `npm run db:migrate` | Applies pending migrations |
| `npm run seed` | Seeds the 16 original products (only if the table is empty) |
| `npm run create-admin -- [username] [password]` | Creates an admin, or resets an existing one's password (also logs out all of that admin's sessions) |

## Tests

Tests run against a second, disposable database (`delishop_test` by default — see
`vitest.config.mts`) so they never touch your dev data. Create it once:

```sh
createdb delishop_test --owner delishop
```

`npm test` applies migrations to it automatically and truncates every table before each test.
