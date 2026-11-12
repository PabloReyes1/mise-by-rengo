import react from '@vitejs/plugin-react';
import { defineProject } from 'vitest/config';

export default defineProject({
  plugins: [react()],
  // Lee @mise/shared desde el TypeScript fuente (Docs/19 §5)
  resolve: { conditions: ['@mise/source'] },
  test: {
    name: 'frontend',
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
