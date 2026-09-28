import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './env';
import { scheduleDailyCleanup } from './lib/cleanup';
import { logger } from './lib/logger';

scheduleDailyCleanup();

serve({ fetch: app.fetch, port: env.PORT }, info => {
  logger.info(`DeliShop server listening on http://localhost:${info.port}`);
});
