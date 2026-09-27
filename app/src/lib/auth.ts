// Studio login. With no backend the check runs in the browser, so this only keeps
// casual visitors out of the studio: anyone who reads the bundled code can get past
// it. Move the check to a server before the studio guards anything that matters.

export const STUDIO_USERNAME = 'admin';

/**
 * SHA-256 of the studio password (default: "delishop"). To change it, run
 *   node -e "console.log(require('crypto').createHash('sha256').update('new password').digest('hex'))"
 * and paste the output here.
 */
const STUDIO_PASSWORD_SHA256 = '38819e613d225672cb441c282024b84ea71d87bda7eec2fc9949ea59a85830f3';

// Kept per tab, so closing the tab logs out. The in-memory flag keeps the
// session alive for this page load when the browser refuses sessionStorage.
const SESSION_KEY = 'delishop-studio-session';
let signedIn = false;

export function isLoggedIn(): boolean {
  if (signedIn) return true;
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export type LoginResult = 'ok' | 'wrong' | 'insecure';

/** Checks the username and password and, when they match, starts a studio session. */
export async function logIn(username: string, password: string): Promise<LoginResult> {
  // crypto.subtle only exists on https and localhost
  if (!window.isSecureContext || !crypto.subtle) return 'insecure';
  if (username.trim().toLowerCase() !== STUDIO_USERNAME || await sha256(password) !== STUDIO_PASSWORD_SHA256) return 'wrong';
  signedIn = true;
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* the in-memory flag still holds */ }
  return 'ok';
}

export function logOut() {
  signedIn = false;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
