import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { createProduct } from './helpers';

describe('GET /api/products', () => {
  it('lists active products ordered by position, excluding archived ones', async () => {
    await createProduct({ name: 'Third', position: 3 });
    await createProduct({ name: 'First', position: 1 });
    await createProduct({ name: 'Hidden', position: 2, archived: true });

    const res = await app.request('/api/products');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products.map((p: { name: string }) => p.name)).toEqual(['First', 'Third']);
  });

  it('shapes each product with a drawing object and null crop for a fresh product', async () => {
    await createProduct({ name: 'Shaped', price: 250 });
    const res = await app.request('/api/products');
    const [product] = (await res.json()).products;
    expect(product).toMatchObject({
      name: 'Shaped',
      price: 250,
      category: 'Keychains',
      color: 'pink',
      photoUrl: null,
      voiceUrl: null,
    });
    expect(product.drawing).toMatchObject({ width: 500, height: 500, crop: null });
    expect(product.drawing.url).toContain('drawing-test.webp');
  });

  it('sets a one-minute cache header', async () => {
    const res = await app.request('/api/products');
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
  });
});
