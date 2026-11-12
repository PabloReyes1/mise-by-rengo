import { defineConfig } from 'vitest/config';

// Un proyecto por paquete; cada paquete tiene su vitest.config.ts
export default defineConfig({
  test: {
    projects: ['backend', 'frontend', 'shared'],
    passWithNoTests: true,
  },
});
