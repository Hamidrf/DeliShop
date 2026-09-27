# DeliShop

React + TypeScript (Vite) build of the DeliShop designs from the Claude Design handoff in `../project`.

```sh
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Pages

| Route              | Page                                | Prototype                     |
| ------------------ | ----------------------------------- | ----------------------------- |
| `/`                | Shop: drip-to-colour cards + popup  | `DeliShop Products.dc.html`   |
| `/checkout`        | Invoice, payment card, receipt      | `DeliShop Checkout.dc.html`   |
| `/studio`          | Add a new product                   | `DeliShop Admin.dc.html`      |
| `/studio/products` | All products, delete with a warning | `DeliShop Inventory.dc.html`  |

## Data

There is no backend yet. Products added in the studio, hidden originals, the bag and orders
are kept in the browser's `localStorage` (`src/lib/store.ts`), under the same keys the
prototypes used. The 16 original products, their crops of the sketch sheet and their stories
live in one place: `src/lib/products.ts`.

Settings the prototypes exposed as tweaks are constants: drip speed and "always colour" in
`src/pages/shop/Shop.tsx`, and the payment card number and holder in `src/lib/theme.ts`.
