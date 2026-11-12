import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'frontend',
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
