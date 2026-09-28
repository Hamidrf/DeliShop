import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { db } from '../src/db/client';
import { products } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { createProduct, tinyJpeg } from './helpers';

const ORIGIN = { Origin: 'http://localhost:5173' };

async function orderForm(fields: { name?: string; phone?: string; items?: unknown; noReceipt?: boolean }) {
  const form = new FormData();
  form.set('name', fields.name ?? 'Sara');
  form.set('phone', fields.phone ?? '09123456789');
  form.set('items', JSON.stringify(fields.items ?? []));
  if (!fields.noReceipt) form.set('receipt', new Blob([await tinyJpeg()], { type: 'image/jpeg' }), 'receipt.jpg');
  return form;
}

describe('POST /api/orders', () => {
  it('computes the total from server-side prices, ignoring anything the client might send', async () => {
    const p1 = await createProduct({ name: 'A', price: 100 });
    const p2 = await createProduct({ name: 'B', price: 50, position: 2 });

    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: ORIGIN,
      body: await orderForm({ items: [{ productId: p1.id, quantity: 2 }, { productId: p2.id, quantity: 1 }] }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.total).toBe(250); // 2*100 + 1*50
    expect(body.number).toBe(1001);
    expect(body.status).toBe('awaiting_review');
  });

  it('rejects an order that references an archived product with 409', async () => {
    const gone = await createProduct({ name: 'Gone', archived: true });
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: ORIGIN,
      body: await orderForm({ items: [{ productId: gone.id, quantity: 1 }] }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe('product_unavailable');
    expect(body.error.productIds).toEqual([gone.id]);
  });

  it('rejects an order referencing a product id that does not exist', async () => {
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: ORIGIN,
      body: await orderForm({ items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }] }),
    });
    expect(res.status).toBe(409);
  });

  it('normalizes Persian digits in the phone number', async () => {
    const p = await createProduct();
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: ORIGIN,
      body: await orderForm({ phone: '۰۹۱۲۳۴۵۶۷۸۹', items: [{ productId: p.id, quantity: 1 }] }),
    });
    expect(res.status).toBe(201);

    const [row] = await db.select().from(products).where(eq(products.id, p.id));
    expect(row).toBeTruthy();
  });

  it('rejects a phone number that is not a valid Iranian mobile number', async () => {
    const p = await createProduct();
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: ORIGIN,
      body: await orderForm({ phone: '12345', items: [{ productId: p.id, quantity: 1 }] }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('validation_failed');
  });

  it('requires a receipt file', async () => {
    const p = await createProduct();
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: ORIGIN,
      body: await orderForm({ noReceipt: true, items: [{ productId: p.id, quantity: 1 }] }),
    });
    expect(res.status).toBe(400);
  });

  it('requires at least one item', async () => {
    const res = await app.request('/api/orders', {
      method: 'POST',
      headers: ORIGIN,
      body: await orderForm({ items: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('is blocked by CSRF without a matching Origin header', async () => {
    const p = await createProduct();
    const res = await app.request('/api/orders', {
      method: 'POST',
      body: await orderForm({ items: [{ productId: p.id, quantity: 1 }] }),
    });
    expect(res.status).toBe(403);
  });

  it('rate-limits after 10 orders from the same IP in the window', async () => {
    const p = await createProduct();
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      last = await app.request('/api/orders', {
        method: 'POST',
        headers: ORIGIN,
        body: await orderForm({ items: [{ productId: p.id, quantity: 1 }] }),
      });
    }
    expect(last!.status).toBe(429);
  });
});
