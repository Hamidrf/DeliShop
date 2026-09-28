import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/client';
import { admins } from '../db/schema';
import { validationFailed, notLoggedIn } from '../lib/errors';
import { loginRateLimit } from '../lib/rateLimit';
import { createSession, currentAdmin, destroySession } from '../lib/session';

export const authRoute = new Hono<{ Variables: { loginInput: { username: string; password: string } } }>();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// A verify run against a hash nobody has, so a wrong username takes the same
// time as a wrong password and the response can't be used to enumerate
// usernames. Computed once, lazily (there's no top-level await in CJS).
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => dummyHash ??= argonHash('not-a-real-password');

authRoute.post('/login', async (c, next) => {
  // Parsed here (rather than in the handler) so `loginRateLimit` below can
  // key its bucket on the username without parsing the body twice.
  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw validationFailed('Username and password are required.');
  c.set('loginInput', parsed.data);
  await next();
}, loginRateLimit, async c => {
  const { username, password } = c.get('loginInput');
  const normalized = username.trim().toLowerCase();

  const rows = await db.select().from(admins).where(eq(admins.username, normalized)).limit(1);
  const admin = rows[0];

  let ok: boolean;
  if (admin) {
    ok = await argonVerify(admin.passwordHash, password).catch(() => false);
  } else {
    // Same cost as a real check, but the answer never matters.
    await getDummyHash().then(h => argonVerify(h, password)).catch(() => false);
    ok = false;
  }

  if (!admin || !ok) {
    return c.json({ error: { code: 'invalid_credentials', message: 'That username or password is wrong.' } }, 401);
  }

  await createSession(c, admin.id);
  return c.json({ username: admin.username });
});

authRoute.post('/logout', async c => {
  await destroySession(c);
  return c.body(null, 204);
});

authRoute.get('/me', async c => {
  const admin = await currentAdmin(c);
  if (!admin) throw notLoggedIn();
  return c.json({ username: admin.username });
});
