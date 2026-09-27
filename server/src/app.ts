import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { checkDbHealth } from './db/client';
import { env } from './env';
import { ApiError } from './lib/errors';
import { logger } from './lib/logger';
import { generalRateLimit } from './lib/rateLimit';
import { authRoute } from './routes/auth';
import { ordersRoute } from './routes/orders';
import { productsRoute } from './routes/products';
import { studioOrdersRoute } from './routes/studio/orders';
import { studioProductsRoute } from './routes/studio/products';
import { requireAdmin } from './lib/session';

export const app = new Hono();

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, ...err.extra } }, err.status);
  }
  // Thrown by Hono's own middleware (csrf(), secureHeaders(), bodyLimit()).
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'forbidden', message: err.message || 'Forbidden.' } }, err.status);
  }
  logger.error({ err, path: c.req.path }, 'unhandled error');
  return c.json({ error: { code: 'internal_error', message: 'Something went wrong.' } }, 500);
});

app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start }, 'request');
});

// Absolute in production (the object storage bucket/CDN's own origin);
// a bare path in local dev, already covered by 'self'.
const mediaOrigin = env.MEDIA_PUBLIC_BASE_URL.startsWith('/') ? null : new URL(env.MEDIA_PUBLIC_BASE_URL).origin;

app.use('*', secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    imgSrc: ["'self'", 'data:', ...(mediaOrigin ? [mediaOrigin] : [])],
    styleSrc: ["'self'", 'fonts.googleapis.com', "'unsafe-inline'"],
    fontSrc: ["'self'", 'fonts.gstatic.com'],
    connectSrc: ["'self'"],
    mediaSrc: ["'self'", ...(mediaOrigin ? [mediaOrigin] : [])],
  },
}));
app.use('*', csrf({ origin: env.APP_ORIGIN }));
app.use('*', bodyLimit({
  maxSize: 10 * 1024 * 1024, // per-file limits in lib/uploads.ts are stricter; this just bounds the whole request
  onError: c => c.json({ error: { code: 'file_too_large', message: 'Request body is too large.' } }, 413),
}));
app.use('/api/*', generalRateLimit);

app.get('/api/health', async c => {
  const ok = await checkDbHealth();
  return c.json({ ok, db: ok ? 'up' : 'down' }, ok ? 200 : 503);
});

app.route('/api/products', productsRoute);
app.route('/api/orders', ordersRoute);
app.route('/api/auth', authRoute);

const studio = new Hono();
studio.use('*', requireAdmin);
studio.route('/products', studioProductsRoute);
studio.route('/orders', studioOrdersRoute);
app.route('/api/studio', studio);

// Local dev only: object storage serves `media` directly to the browser in
// production, never through this Node process (see docs/backend-architecture.md §4).
if (env.STORAGE_DRIVER === 'local') {
  app.use('/uploads/media/*', serveStatic({
    root: path.relative(process.cwd(), path.resolve(env.LOCAL_UPLOAD_DIR)),
    rewriteRequestPath: p => p.replace(/^\/uploads/, ''),
  }));
}

if (env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '../../app/dist');
  app.use('*', serveStatic({ root: path.relative(process.cwd(), dist) }));
  app.get('*', serveStatic({ root: path.relative(process.cwd(), dist), path: 'index.html' }));
}
