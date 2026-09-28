import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    globalSetup: ['./tests/globalSetup.ts'],
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      APP_ORIGIN: 'http://localhost:5173',
      DATABASE_URL: 'postgres://delishop:delishop@localhost:5432/delishop_test',
      STORAGE_DRIVER: 'local',
      LOCAL_UPLOAD_DIR: './tests/.uploads',
      MEDIA_PUBLIC_BASE_URL: '/uploads/media',
    },
  },
});
