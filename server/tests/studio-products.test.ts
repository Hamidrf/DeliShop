import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { createAdmin, createProduct, loginCookie, tinyJpeg, tinyPng } from './helpers';

const ORIGIN = { Origin: 'http://localhost:5173' };

async function productForm(overrides: Partial<{ name: string; category: string; color: string; price: string; story: string; withPhoto: boolean }> = {}) {
  const form = new FormData();
  form.set('name', overrides.name ?? 'New Toy');
  form.set('category', overrides.category ?? 'Pins');
  form.set('color', overrides.color ?? 'mint');
  form.set('price', overrides.price ?? '150');
  form.set('story', overrides.story ?? 'A story.');
  form.set('drawing', new Blob([await tinyJpeg()], { type: 'image/jpeg' }), 'drawing.jpg');
  if (overrides.withPhoto) form.set('photo', new Blob([await tinyPng()], { type: 'image/png' }), 'photo.png');
  return form;
}

describe('studio products', () => {
  it('requires a session', async () => {
    const res = await app.request('/api/studio/products');
    expect(res.status).toBe(401);
  });

  it('creates a product with a processed drawing and photo', async () => {
    await createAdmin();
    const cookie = await loginCookie();

    const res = await app.request('/api/studio/products', {
      method: 'POST',
      headers: { ...ORIGIN, Cookie: cookie },
      body: await productForm({ withPhoto: true }),
    });

    expect(res.status).toBe(201);
    const { product } = await res.json();
    expect(product.name).toBe('New Toy');
    expect(product.drawing.crop).toBeNull();
    expect(product.drawing.url).toMatch(/\.webp$/);
    expect(product.photoUrl).toMatch(/\.webp$/);

    const list = await app.request('/api/products');
    const names = (await list.json()).products.map((p: { name: string }) => p.name);
    expect(names).toContain('New Toy');
  });

  it('rejects a duplicate active name with 409', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    await createProduct({ name: 'Duplicate Me' });

    const res = await app.request('/api/studio/products', {
      method: 'POST',
      headers: { ...ORIGIN, Cookie: cookie },
      body: await productForm({ name: 'Duplicate Me' }),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('name_taken');
  });

  it('archives on delete, taking it out of the shop feed, then restores it', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    const p = await createProduct({ name: 'Archivable' });

    const del = await app.request(`/api/studio/products/${p.id}`, { method: 'DELETE', headers: { ...ORIGIN, Cookie: cookie } });
    expect(del.status).toBe(204);

    const shop = await app.request('/api/products');
    expect((await shop.json()).products.map((x: { name: string }) => x.name)).not.toContain('Archivable');

    const restore = await app.request(`/api/studio/products/${p.id}/restore`, { method: 'POST', headers: { ...ORIGIN, Cookie: cookie } });
    expect(restore.status).toBe(200);

    const shopAfter = await app.request('/api/products');
    expect((await shopAfter.json()).products.map((x: { name: string }) => x.name)).toContain('Archivable');
  });

  it('refuses to restore when another active product already took the name', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    const p = await createProduct({ name: 'Wanted Name' });
    await app.request(`/api/studio/products/${p.id}`, { method: 'DELETE', headers: { ...ORIGIN, Cookie: cookie } });
    await createProduct({ name: 'Wanted Name' });

    const restore = await app.request(`/api/studio/products/${p.id}/restore`, { method: 'POST', headers: { ...ORIGIN, Cookie: cookie } });
    expect(restore.status).toBe(409);
    expect((await restore.json()).error.code).toBe('name_taken');
  });

  it('404s deleting a product that does not exist', async () => {
    await createAdmin();
    const cookie = await loginCookie();
    const res = await app.request('/api/studio/products/00000000-0000-0000-0000-000000000000', {
      method: 'DELETE',
      headers: { ...ORIGIN, Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });
});
