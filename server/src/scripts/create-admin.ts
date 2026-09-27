import { createInterface } from 'node:readline/promises';
import { hash } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { db, pool } from '../db/client';
import { admins } from '../db/schema';
import { deleteAllSessionsForAdmin } from '../lib/session';

async function main() {
  // Accepts `create-admin <username> <password>` for scripting/CI; asks
  // interactively for whichever one is missing (the normal, human path).
  let [username, password] = process.argv.slice(2);
  if (!username || !password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    username ??= await rl.question('Username: ');
    password ??= await rl.question('Password: ');
    rl.close();
  }
  username = username.trim().toLowerCase();
  password = password.trim();

  if (!username) throw new Error('Username cannot be empty.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');

  const passwordHash = await hash(password);
  const existing = await db.select().from(admins).where(eq(admins.username, username)).limit(1);

  if (existing[0]) {
    await db.update(admins).set({ passwordHash }).where(eq(admins.id, existing[0].id));
    await deleteAllSessionsForAdmin(existing[0].id);
    console.log(`Password updated for "${username}". All existing sessions for this admin were logged out.`);
  } else {
    await db.insert(admins).values({ username, passwordHash });
    console.log(`Admin "${username}" created.`);
  }
}

main()
  .catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
