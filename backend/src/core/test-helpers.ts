// Utilidades solo para pruebas.
import type { Env } from './env.js';

export const TEST_SECRET = 'a'.repeat(128);

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    CLIENT_NAME: 'Prueba',
    PORT: 3999,
    DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
    JWT_SECRET: TEST_SECRET,
    LOG_LEVEL: 'silent',
    AI_MAX_TOKENS: 800,
    PUBLIC_DOMAIN: 'localhost:5173',
    MIN_FRONTEND_VERSION: '0.0.0',
    ...overrides,
  };
}
