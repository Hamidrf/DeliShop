import { randomUUID } from 'node:crypto';
import { inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db/client';
import { orderItems, orders, products } from '../db/schema';
import { ApiError, validationFailed } from '../lib/errors';
import { normalizePhone } from '../lib/phone';
import { ordersRateLimit } from '../lib/rateLimit';
import { assertReceipt } from '../lib/uploads';
import { orderItemsSchema } from '../lib/validators';
import { storage } from '../lib/storage';

export const ordersRoute = new Hono();

ordersRoute.post('/', ordersRateLimit, async c => {
  const body = await c.req.parseBody();

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 60) throw validationFailed('Name must be 1 to 60 characters.', { name: 'required' });

  const phone = typeof body.phone === 'string' ? normalizePhone(body.phone) : null;
  if (!phone) throw validationFailed('Phone number must have 11 digits and start with 09.', { phone: 'invalid' });

  let itemsInput: unknown;
  try {
    itemsInput = JSON.parse(typeof body.items === 'string' ? body.items : '');
  } catch {
    throw validationFailed('Items must be valid JSON.', { items: 'invalid' });
  }
  const itemsResult = orderItemsSchema.safeParse(itemsInput);
  if (!itemsResult.success) throw validationFailed('Items are invalid.', { items: 'invalid' });
  const items = itemsResult.data;

  const receiptFile = body.receipt;
  if (!(receiptFile instanceof File)) throw validationFailed('The receipt is required.', { receipt: 'required' });
  const receiptBytes = Buffer.from(await receiptFile.arrayBuffer());
  const receiptSig = assertReceipt(receiptBytes);

  const productIds = [...new Set(items.map(i => i.productId))];
  const productRows = await db.select().from(products)
    .where(inArray(products.id, productIds));
  const byId = new Map(productRows.map(p => [p.id, p]));

  const unavailable = productIds.filter(id => {
    const p = byId.get(id);
    return !p || p.archivedAt !== null;
  });
  if (unavailable.length) {
    throw new ApiError(409, 'product_unavailable', 'Some items are no longer available.', { productIds: unavailable });
  }

  const total = items.reduce((sum, item) => {
    const product = byId.get(item.productId)!;
    return sum + product.price * item.quantity;
  }, 0);

  const orderId = randomUUID();
  const receiptKey = `receipts/${orderId}.${receiptSig.ext}`;

  try {
    await storage.put('receipts', receiptKey, receiptBytes, receiptSig.mime);
  } catch {
    return c.json({ error: { code: 'upload_failed', message: 'Could not save the receipt. Please try again.' } }, 503);
  }

  try {
    const order = await db.transaction(async tx => {
      const [inserted] = await tx.insert(orders).values({
        id: orderId,
        customerName: name,
        customerPhone: phone,
        total,
        receiptKey,
        receiptMime: receiptSig.mime,
      }).returning();

      await tx.insert(orderItems).values(items.map(item => {
        const product = byId.get(item.productId)!;
        return {
          orderId,
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
        };
      }));

      return inserted!;
    });

    return c.json({ number: order.number, total: order.total, status: order.status }, 201);
  } catch (err) {
    await storage.delete('receipts', receiptKey).catch(() => {});
    throw err;
  }
});
