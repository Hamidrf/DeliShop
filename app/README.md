# DeliShop

React + TypeScript (Vite) build of the DeliShop designs from the Claude Design handoff in `../project`.
Talks to the API in `../server` — see `docs/backend-architecture.md` for the full design.

```sh
npm install
npm run dev      # http://localhost:5173, proxies /api and /uploads to the server on :3000
npm run build
```

Run `../server` alongside it (`npm run dev` there) for the API to answer.

## Pages

| Route              | Page                                          | Prototype                     |
| ------------------ | ---------------------------------------------- | ----------------------------- |
| `/`                | Shop: drip-to-colour cards + popup             | `DeliShop Products.dc.html`   |
| `/checkout`        | Invoice, payment card, receipt                 | `DeliShop Checkout.dc.html`   |
| `/studio/login`    | Studio login                                   | —                              |
| `/studio`          | Add a new product                              | `DeliShop Admin.dc.html`      |
| `/studio/products` | All products, delete with a warning            | `DeliShop Inventory.dc.html`  |
| `/studio/orders`   | Orders: list, detail, receipt, status changes  | —                              |

## Data

Products, orders and the studio login are served by the API in `../server` (PostgreSQL +
object storage). Only the shopping bag stays client-side, in the browser's `localStorage`
(`src/lib/store.ts`) as `{ productId, qty }` pairs — there's no customer account, so the bag
has nowhere else to live. `src/lib/products.ts` holds the shared `Product`/`Crop` types and the
mapping from the API's response shape to them; the original 16 products themselves are seeded
into the database by `server/src/scripts/seed.ts`, not shipped in this package anymore.

Settings the prototypes exposed as tweaks are constants: drip speed and "always colour" in
`src/pages/shop/Shop.tsx`, and the payment card number and holder in `src/lib/theme.ts`.
