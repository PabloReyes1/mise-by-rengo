import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const valid = {
  CLIENT_NAME: 'LaFonda',
  PORT: '3005',
  DATABASE_URL: 'postgresql://mise_lafonda_app:x@localhost:5432/mise_lafonda?connection_limit=5',
  JWT_SECRET: 'f'.repeat(128),
  PUBLIC_DOMAIN: 'pos.lafonda.com',
  MIN_FRONTEND_VERSION: '1.0.0',
};

describe('parseEnv (Docs/13 §2.1)', () => {
  it('acepta un .env completo y convierte PORT a número', () => {
    const env = parseEnv(valid);
    expect(env.PORT).toBe(3005);
    expect(env.CLIENT_NAME).toBe('LaFonda');
  });

  it('LOG_LEVEL es warn si no se indica (producción)', () => {
    expect(parseEnv(valid).LOG_LEVEL).toBe('warn');
  });

  it('no arranca si falta una clave obligatoria, y dice cuál', () => {
    const { JWT_SECRET: _omit, ...sinSecreto } = valid;
    expect(() => parseEnv(sinSecreto)).toThrow(/JWT_SECRET/);
  });

  it('rechaza un JWT_SECRET corto (deben ser 64 bytes aleatorios)', () => {
    expect(() => parseEnv({ ...valid, JWT_SECRET: 'corto' })).toThrow(/JWT_SECRET/);
  });

  it('rechaza un DATABASE_URL que no es de PostgreSQL', () => {
    expect(() => parseEnv({ ...valid, DATABASE_URL: 'mysql://x' })).toThrow(/DATABASE_URL/);
  });

  it('si se activa el chatbot (AI_PROVIDER), AI_MODEL es obligatorio y no tiene valor por defecto', () => {
    expect(() => parseEnv({ ...valid, AI_PROVIDER: 'anthropic', AI_API_KEY: 'k' })).toThrow(
      /AI_MODEL/,
    );
  });

  it('las claves vacías del .env cuentan como no definidas', () => {
    const env = parseEnv({ ...valid, AI_PROVIDER: '', AI_MODEL: '', DATABASE_URL_RO: '' });
    expect(env.AI_PROVIDER).toBeUndefined();
    expect(env.DATABASE_URL_RO).toBeUndefined();
  });
});
