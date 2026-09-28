import { randomBytes, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { Context, MiddlewareHandler } from 'hono';
import { db } from '../db/client';
import { admins, sessions } from '../db/schema';
import { env } from '../env';
import { notLoggedIn } from './errors';

export const SESSION_COOKIE = 'ds_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const RENEW_WITHIN_MS = 7 * 24 * 60 * 60 * 1000; // renew once under 7 days remain

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface AdminSession {
  id: string;
  username: string;
}

export async function createSession(c: Context, adminId: string) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), adminId, expiresAt });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(c: Context) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

/** Resolves the logged-in admin for the current request, if any. Slides the session's expiry forward when it's getting close. */
export async function currentAdmin(c: Context): Promise<AdminSession | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;

  const rows = await db
    .select({ adminId: sessions.adminId, expiresAt: sessions.expiresAt, username: admins.username })
    .from(sessions)
    .innerJoin(admins, eq(admins.id, sessions.adminId))
    .where(eq(sessions.id, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) return null;

  if (row.expiresAt.getTime() - Date.now() < RENEW_WITHIN_MS) {
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, hashToken(token)));
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });
  }

  return { id: row.adminId, username: row.username };
}

export async function deleteAllSessionsForAdmin(adminId: string) {
  await db.delete(sessions).where(eq(sessions.adminId, adminId));
}

/** Installed on the whole `/api/studio` group so no individual route can forget it. */
export const requireAdmin: MiddlewareHandler<{ Variables: { admin: AdminSession } }> = async (c, next) => {
  const admin = await currentAdmin(c);
  if (!admin) throw notLoggedIn();
  c.set('admin', admin);
  await next();
};
