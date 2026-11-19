import { describe, expect, it } from 'vitest';
import { buildApp } from '../../core/app.js';
import { testEnv } from '../../core/test-helpers.js';

describe('GET /api/health (Docs/08 §2.1)', () => {
  it('responde ok y el tiempo encendido cuando la base responde', async () => {
    const app = await buildApp({ env: testEnv(), checkDb: () => Promise.resolve() });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('responde degraded si la base falla', async () => {
    const app = await buildApp({
      env: testEnv(),
      checkDb: () => Promise.reject(new Error('sin conexión')),
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json().status).toBe('degraded');
  });

  it('responde degraded si la base no contesta a tiempo (2 s en producción)', async () => {
    const app = await buildApp({
      env: testEnv(),
      checkDb: () => new Promise(() => undefined),
      dbTimeoutMs: 50,
    });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json().status).toBe('degraded');
  });
});

describe('GET /api/time', () => {
  it('devuelve la hora del servidor en ISO 8601 UTC', async () => {
    const app = await buildApp({ env: testEnv(), checkDb: () => Promise.resolve() });
    const before = Date.now();
    const res = await app.inject({ method: 'GET', url: '/api/time' });
    const now = Date.parse(res.json().now);
    expect(res.json().now).toMatch(/Z$/);
    expect(now).toBeGreaterThanOrEqual(before - 1000);
    expect(now).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
