import { hash } from '@node-rs/argon2';
import sharp from 'sharp';
import { app } from '../src/app';
import { db } from '../src/db/client';
import { admins, products } from '../src/db/schema';
import type { CardColor, ProductCategory } from '../src/lib/validators';

export async function createAdmin(username = 'admin', password = 'SuperSecret123') {
  const passwordHash = await hash(password);
  const [row] = await db.insert(admins).values({ username, passwordHash }).returning();
  return row!;
}

/** Logs in through the real route and returns the `Cookie` header value for authenticated requests. */
export async function loginCookie(username = 'admin', password = 'SuperSecret123') {
  const res = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  return setCookie.split(';')[0]!;
}

interface ProductOverrides {
  name?: string;
  category?: ProductCategory;
  color?: CardColor;
  price?: number;
  archived?: boolean;
  position?: number;
}

export async function createProduct(overrides: ProductOverrides = {}) {
  const [row] = await db.insert(products).values({
    name: overrides.name ?? `Test Product ${Math.random().toString(36).slice(2, 8)}`,
    category: overrides.category ?? 'Keychains',
    color: overrides.color ?? 'pink',
    price: overrides.price ?? 100,
    story: 'A test product.',
    drawingKey: 'products/drawing-test.webp',
    drawingWidth: 500,
    drawingHeight: 500,
    drawingCrop: null,
    position: overrides.position ?? 1,
    archivedAt: overrides.archived ? new Date() : null,
  }).returning();
  return row!;
}

/** A tiny real JPEG (decodable by sharp), small enough to pass every size limit. */
export function tinyJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 3, background: '#ff0000' } }).jpeg().toBuffer();
}

/** A tiny real PNG with transparency, for product-photo uploads. */
export function tinyPng(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 255, b: 0, alpha: 0.5 } } }).png().toBuffer();
}
