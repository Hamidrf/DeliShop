import { afterAll, beforeEach } from 'vitest';
import { pool } from '../src/db/client';
import { generalRateLimitStore, loginRateLimitStore, ordersRateLimitStore } from '../src/lib/rateLimit';

beforeEach(async () => {
  await pool.query('truncate table order_items, orders, sessions, admins, products restart identity cascade');
  await pool.query('alter sequence order_number_seq restart with 1001');
  generalRateLimitStore.resetAll();
  loginRateLimitStore.resetAll();
  ordersRateLimitStore.resetAll();
});

afterAll(async () => {
  await pool.end();
});
