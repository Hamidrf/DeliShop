import type { Context } from 'hono';
import { MemoryStore, rateLimiter } from 'hono-rate-limiter';
import { rateLimited } from './errors';

/**
 * The real client IP, read from the header the host guarantees to set for
 * requests it proxies (Liara/most PaaS set `X-Forwarded-For`). Without this
 * every request looks like it comes from the proxy's own address.
 */
export function clientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return c.env?.remoteAddr ?? 'unknown';
}

const handler = () => { throw rateLimited(); };

// Explicit stores (rather than letting `rateLimiter()` create its own) so
// tests can reset them between cases; production behavior is unchanged —
// still one in-memory bucket per process, per the doc's single-server MVP.
export const generalRateLimitStore = new MemoryStore();
export const ordersRateLimitStore = new MemoryStore();
export const loginRateLimitStore = new MemoryStore();

/** 300 requests/minute per IP, applied to the whole API. */
export const generalRateLimit = rateLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  keyGenerator: clientIp,
  handler,
  store: generalRateLimitStore,
});

/** 10 orders/hour per IP. */
export const ordersRateLimit = rateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  keyGenerator: clientIp,
  handler,
  store: ordersRateLimitStore,
});

/**
 * 5 failed logins/15min per IP+username combo, so one guessed username
 * doesn't lock out everyone on that IP. Must run after the login route's own
 * body-parsing middleware, which stashes the parsed input in `loginInput`.
 * Successful logins don't count against the limit.
 */
export const loginRateLimit = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  skipSuccessfulRequests: true,
  keyGenerator: c => `${clientIp(c)}:${(c.get('loginInput' as never) as { username?: string } | undefined)?.username ?? ''}`,
  handler,
  store: loginRateLimitStore,
});
