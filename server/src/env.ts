import { config } from 'dotenv';
import { z } from 'zod';

config();

// Read once at boot. If anything required is missing or malformed, the
// process exits immediately instead of failing later on a random request.
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_ORIGIN: z.string().url(),
  DATABASE_URL: z.string().min(1),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_UPLOAD_DIR: z.string().default('./uploads'),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default('default'),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_MEDIA_BUCKET: z.string().optional(),
  S3_RECEIPTS_BUCKET: z.string().optional(),
  // An absolute URL in production (the bucket/CDN's own origin). In local
  // dev, a path like `/uploads/media` lets the same Node process serve
  // media same-origin (through the Vite proxy too), so the browser isn't
  // blocked fetching cross-origin from a different port.
  MEDIA_PUBLIC_BASE_URL: z.string().refine(v => v.startsWith('/') || z.string().url().safeParse(v).success, {
    message: 'Must be an absolute URL, or a path starting with "/" for local dev.',
  }),

  SMS_API_KEY: z.string().optional(),
  OWNER_PHONE: z.string().optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  const env = parsed.data;
  if (env.STORAGE_DRIVER === 's3') {
    const missing = (['S3_ENDPOINT', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_MEDIA_BUCKET', 'S3_RECEIPTS_BUCKET'] as const)
      .filter(k => !env[k]);
    if (missing.length) {
      console.error('STORAGE_DRIVER=s3 requires:', missing.join(', '));
      process.exit(1);
    }
  }
  return env;
}

export const env = load();
export type Env = typeof env;
