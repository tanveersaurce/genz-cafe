import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    hookTimeout: 120000, // 2 minutes for mongodb-memory-server download and boot
    testTimeout: 60000,
  },
});
