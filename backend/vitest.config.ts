import { defineProject } from 'vitest/config';

export default defineProject({
  // Lee @mise/shared desde el TypeScript fuente (Docs/19 §5)
  resolve: { conditions: ['@mise/source'] },
  ssr: { resolve: { conditions: ['@mise/source'], externalConditions: ['@mise/source'] } },
  test: {
    name: 'backend',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Prepara la base de pruebas (migraciones) y corre los archivos uno a la vez: comparten la base
    globalSetup: ['./src/core/test-global-setup.ts'],
    fileParallelism: false,
  },
});
