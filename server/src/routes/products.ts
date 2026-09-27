import { asc, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { products } from '../db/schema';
import { serializeProduct } from '../lib/serialize';

export const productsRoute = new Hono();

productsRoute.get('/', async c => {
  const rows = await db.select().from(products).where(isNull(products.archivedAt)).orderBy(asc(products.position));
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({ products: rows.map(serializeProduct) });
});
