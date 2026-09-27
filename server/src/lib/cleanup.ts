import { and, inArray, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { orders, sessions } from '../db/schema';
import { logger } from './logger';
import { storage } from './storage';

const RECEIPT_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;

async function deleteExpiredSessions() {
  const deleted = await db.delete(sessions).where(lt(sessions.expiresAt, new Date())).returning({ id: sessions.id });
  if (deleted.length) logger.info({ count: deleted.length }, 'expired sessions removed');
}

/** Old receipts are a customer's financial document, but once an order is done with, there's no reason to keep the image. */
async function deleteOldReceipts() {
  const cutoff = new Date(Date.now() - RECEIPT_RETENTION_MS);
  const stale = await db.select({ id: orders.id, receiptKey: orders.receiptKey }).from(orders).where(
    and(inArray(orders.status, ['shipped', 'rejected']), lt(orders.statusChangedAt, cutoff)),
  );
  for (const order of stale) {
    await storage.delete('receipts', order.receiptKey).catch(err => logger.error({ err, orderId: order.id }, 'failed to delete old receipt'));
  }
  if (stale.length) logger.info({ count: stale.length }, 'old receipts removed');
}

export async function runDailyCleanup() {
  await deleteExpiredSessions().catch(err => logger.error({ err }, 'session cleanup failed'));
  await deleteOldReceipts().catch(err => logger.error({ err }, 'receipt cleanup failed'));
}

/** Started once at boot; a single Node process is all the doc's traffic assumption needs. */
export function scheduleDailyCleanup() {
  const DAY_MS = 24 * 60 * 60 * 1000;
  void runDailyCleanup();
  const timer = setInterval(() => void runDailyCleanup(), DAY_MS);
  timer.unref();
}
