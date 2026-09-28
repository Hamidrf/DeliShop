import { Pool } from 'pg';

const TEST_DATABASE_URL = 'postgres://delishop:delishop@localhost:5432/delishop_test';

export default async function globalSetup() {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.NODE_ENV = 'test';
  process.env.APP_ORIGIN = 'http://localhost:5173';
  process.env.STORAGE_DRIVER = 'local';
  process.env.LOCAL_UPLOAD_DIR = './tests/.uploads';
  process.env.MEDIA_PUBLIC_BASE_URL = '/uploads/media';

  // `drizzle-kit migrate` needs its own process (it's a CLI), so shell out to it here
  // rather than importing the migrator — keeps this file dependency-free and fast.
  const { execSync } = await import('node:child_process');
  execSync('npx drizzle-kit migrate', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });

  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  await pool.query('truncate table order_items, orders, sessions, admins, products restart identity cascade');
  await pool.query("alter sequence order_number_seq restart with 1001");
  await pool.end();
}
