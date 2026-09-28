import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { createAdmin, createProduct, loginCookie, tinyJpeg } from './helpers';

const ORIGIN = { Origin: 'http://localhost:5173' };

async function placeOrder(productId: string) {
  const form = new FormData();
  form.set('name', 'Sara');
  form.set('phone', '09123456789');
  form.set('items', JSON.stringify([{ productId, quantity: 1 }]));
  form.set('receipt', new Blob([await tinyJpeg()], { type: 'image/jpeg' }), 'receipt.jpg');
  const res = await app.request('/api/orders', { method: 'POST', headers: ORIGIN, body: form });
  return (await res.json()) as { number: number };
}

describe('studio orders', () => {
  it('requires a session', async () => {
    const res = await app.request('/api/studio/orders');
    expect(res.status).toBe(401);
  });

  it('lists an order just placed, with its item count', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    const p = await createProduct({ price: 100 });
    await placeOrder(p.id);

    const res = await app.request('/api/studio/orders', { headers: { Cookie: cookie } });
    const body = await res.json();
    expect(body.orders).toHaveLength(1);
    expect(body.orders[0]).toMatchObject({ number: 1001, status: 'awaiting_review', itemCount: 1, total: 100 });
  });

  it('filters by status', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    const p = await createProduct();
    await placeOrder(p.id);

    const confirmed = await app.request('/api/studio/orders?status=confirmed', { headers: { Cookie: cookie } });
    expect((await confirmed.json()).orders).toHaveLength(0);

    const awaiting = await app.request('/api/studio/orders?status=awaiting_review', { headers: { Cookie: cookie } });
    expect((await awaiting.json()).orders).toHaveLength(1);
  });

  it('shows order detail with items and a receipt url, and serves the receipt', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    const p = await createProduct({ name: 'Detailed', price: 100 });
    await placeOrder(p.id);

    const list = await app.request('/api/studio/orders', { headers: { Cookie: cookie } });
    const id = (await list.json()).orders[0].id as string;

    const detail = await app.request(`/api/studio/orders/${id}`, { headers: { Cookie: cookie } });
    const body = await detail.json();
    expect(body.order.items).toEqual([{ productId: p.id, productName: 'Detailed', unitPrice: 100, quantity: 1 }]);

    const receipt = await app.request(body.order.receiptUrl, { headers: { Cookie: cookie } });
    expect(receipt.status).toBe(200);
    expect(receipt.headers.get('content-type')).toBe('image/jpeg');
    expect(receipt.headers.get('cache-control')).toBe('private, no-store');
  });

  it('walks the allowed status transitions and rejects a disallowed one', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    const p = await createProduct();
    await placeOrder(p.id);
    const list = await app.request('/api/studio/orders', { headers: { Cookie: cookie } });
    const id = (await list.json()).orders[0].id as string;

    const badJump = await app.request(`/api/studio/orders/${id}`, {
      method: 'PATCH',
      headers: { ...ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    });
    expect(badJump.status).toBe(422);
    expect((await badJump.json()).error.code).toBe('invalid_transition');

    const confirm = await app.request(`/api/studio/orders/${id}`, {
      method: 'PATCH',
      headers: { ...ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'confirmed', adminNote: 'looks good' }),
    });
    expect(confirm.status).toBe(200);
    const confirmedBody = await confirm.json();
    expect(confirmedBody.order.status).toBe('confirmed');
    expect(confirmedBody.order.adminNote).toBe('looks good');

    const ship = await app.request(`/api/studio/orders/${id}`, {
      method: 'PATCH',
      headers: { ...ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'shipped' }),
    });
    expect(ship.status).toBe(200);

    const cancelAfterShipped = await app.request(`/api/studio/orders/${id}`, {
      method: 'PATCH',
      headers: { ...ORIGIN, Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    expect(cancelAfterShipped.status).toBe(422);
  });
});
