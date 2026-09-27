import pino from 'pino';
import { env } from '../env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV === 'production' || env.NODE_ENV === 'test' ? undefined : { target: 'pino-pretty' },
  // Never log anything that could identify a customer or leak a secret.
  redact: ['req.headers.cookie', 'req.headers.authorization'],
});
