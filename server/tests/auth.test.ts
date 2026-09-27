import { describe, expect, it } from 'vitest';
import { app } from '../src/app';
import { createAdmin, loginCookie } from './helpers';

const ORIGIN = { Origin: 'http://localhost:5173' };

describe('auth', () => {
  it('rejects a login with no matching admin', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ORIGIN },
      body: JSON.stringify({ username: 'nobody', password: 'whatever123' }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('invalid_credentials');
  });

  it('logs in, resolves /me, then logs out', async () => {
    await createAdmin('admin', 'SuperSecret123');
    const cookie = await loginCookie('admin', 'SuperSecret123');

    const me = await app.request('/api/auth/me', { headers: { Cookie: cookie } });
    expect(await me.json()).toEqual({ username: 'admin' });

    const loggedOut = await app.request('/api/auth/logout', { method: 'POST', headers: { ...ORIGIN, Cookie: cookie } });
    expect(loggedOut.status).toBe(204);

    const meAfter = await app.request('/api/auth/me', { headers: { Cookie: cookie } });
    expect(meAfter.status).toBe(401);
  });

  it('rejects the wrong password for a real username', async () => {
    await createAdmin('admin', 'SuperSecret123');
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ORIGIN },
      body: JSON.stringify({ username: 'admin', password: 'wrong-password' }),
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('invalid_credentials');
  });

  it('username comparison is case-insensitive', async () => {
    await createAdmin('admin', 'SuperSecret123');
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ORIGIN },
      body: JSON.stringify({ username: 'ADMIN', password: 'SuperSecret123' }),
    });
    expect(res.status).toBe(200);
  });

  it('rate-limits after 5 failed attempts for the same username', async () => {
    await createAdmin('admin', 'SuperSecret123');
    let last: Response | undefined;
    for (let i = 0; i < 6; i++) {
      last = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ORIGIN },
        body: JSON.stringify({ username: 'admin', password: 'wrong' }),
      });
    }
    expect(last!.status).toBe(429);
  });

  it('logging in successfully does not consume the failed-attempt budget', async () => {
    await createAdmin('admin', 'SuperSecret123');
    for (let i = 0; i < 6; i++) {
      const res = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ORIGIN },
        body: JSON.stringify({ username: 'admin', password: 'SuperSecret123' }),
      });
      expect(res.status).toBe(200);
    }
  });

  it('GET /api/auth/me without a cookie is not_logged_in', async () => {
    const res = await app.request('/api/auth/me');
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('not_logged_in');
  });
});
