import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client';
import { orderItems, orders } from '../../db/schema';
import { ApiError, notFound, validationFailed } from '../../lib/errors';
import { storage } from '../../lib/storage';
import { ALLOWED_TRANSITIONS, orderStatusSchema } from '../../lib/validators';

export const studioOrdersRoute = new Hono();

const PAGE_SIZE = 50;

function decodeCursor(raw: string | undefined): { createdAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (!iso || !id) return null;
    return { createdAt: new Date(iso), id };
  } catch {
    return null;
  }
}

const encodeCursor = (createdAt: Date, id: string) => Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');

studioOrdersRoute.get('/', async c => {
  const statusParam = c.req.query('status');
  const statusResult = statusParam ? orderStatusSchema.safeParse(statusParam) : null;
  if (statusParam && !statusResult?.success) throw validationFailed('Unknown order status.', { status: 'invalid' });

  const cursor = decodeCursor(c.req.query('cursor'));

  const conditions = [];
  if (statusResult?.success) conditions.push(eq(orders.status, statusResult.data));
  if (cursor) conditions.push(sql`(${orders.createdAt}, ${orders.id}) < (${cursor.createdAt.toISOString()}::timestamptz, ${cursor.id}::uuid)`);

  const rows = await db.select({
    id: orders.id,
    number: orders.number,
    status: orders.status,
    customerName: orders.customerName,
    customerPhone: orders.customerPhone,
    total: orders.total,
    createdAt: orders.createdAt,
    // Explicit alias + table-qualified columns: an unqualified `id` in the
    // subquery resolves to order_items.id (its own PK), not orders.id, and
    // silently makes this always 0.
    itemCount: sql<number>`(select count(*)::int from order_items oi where oi.order_id = orders.id)`,
  }).from(orders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(PAGE_SIZE);

  const last = rows.at(-1);
  return c.json({
    orders: rows.map(o => ({
      id: o.id,
      number: o.number,
      status: o.status,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      total: o.total,
      itemCount: Number(o.itemCount),
      createdAt: o.createdAt.toISOString(),
    })),
    nextCursor: rows.length === PAGE_SIZE && last ? encodeCursor(last.createdAt, last.id) : null,
  });
});

async function loadOrder(id: string) {
  const rows = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  const order = rows[0];
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id));
  return { order, items };
}

studioOrdersRoute.get('/:id', async c => {
  const found = await loadOrder(c.req.param('id'));
  if (!found) throw notFound('Order not found.');
  const { order, items } = found;
  return c.json({
    order: {
      id: order.id,
      number: order.number,
      status: order.status,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      total: order.total,
      adminNote: order.adminNote,
      createdAt: order.createdAt.toISOString(),
      items: items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
      receiptUrl: `/api/studio/orders/${order.id}/receipt`,
    },
  });
});

studioOrdersRoute.get('/:id/receipt', async c => {
  const rows = await db.select().from(orders).where(eq(orders.id, c.req.param('id'))).limit(1);
  const order = rows[0];
  if (!order) throw notFound('Order not found.');
  const file = await storage.get('receipts', order.receiptKey);
  if (!file) throw notFound('Receipt file not found.');
  c.header('Content-Type', order.receiptMime);
  c.header('Content-Disposition', `inline; filename="receipt-${order.number}"`);
  c.header('Cache-Control', 'private, no-store');
  return c.body(new Uint8Array(file.body));
});

const patchSchema = z.object({
  status: orderStatusSchema.optional(),
  adminNote: z.string().max(2000).optional(),
});

studioOrdersRoute.patch('/:id', async c => {
  const json = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) throw validationFailed('Invalid order update.');
  const { status, adminNote } = parsed.data;

  const rows = await db.select().from(orders).where(eq(orders.id, c.req.param('id'))).limit(1);
  const existing = rows[0];
  if (!existing) throw notFound('Order not found.');

  if (status && status !== existing.status) {
    const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      throw new ApiError(422, 'invalid_transition', `Can't move an order from ${existing.status} to ${status}.`, {
        from: existing.status,
        to: status,
      });
    }
  }

  const [updated] = await db.update(orders).set({
    ...(status ? { status, statusChangedAt: new Date() } : {}),
    ...(adminNote !== undefined ? { adminNote } : {}),
    updatedAt: new Date(),
  }).where(eq(orders.id, existing.id)).returning();

  return c.json({
    order: {
      id: updated!.id,
      number: updated!.number,
      status: updated!.status,
      customerName: updated!.customerName,
      customerPhone: updated!.customerPhone,
      total: updated!.total,
      adminNote: updated!.adminNote,
      createdAt: updated!.createdAt.toISOString(),
    },
  });
});
