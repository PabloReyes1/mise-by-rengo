import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from './app.js';
import { AppError } from './errors.js';
import { testEnv } from './test-helpers.js';

const healthyDb = () => Promise.resolve();

describe('errores de la API (Docs/08 §1)', () => {
  it('una ruta que no existe responde 404 NOT_FOUND con el formato estándar', async () => {
    const app = await buildApp({ env: testEnv(), checkDb: healthyDb });
    const res = await app.inject({ method: 'GET', url: '/api/no-existe' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('un AppError responde con su código y el estado HTTP de la tabla', async () => {
    const app = await buildApp({
      env: testEnv(),
      checkDb: healthyDb,
      register: (a) => {
        a.get('/api/prueba', () => {
          throw new AppError('TABLE_OCCUPIED', 'La mesa 5 ya fue abierta por Luis');
        });
      },
    });
    const res = await app.inject({ method: 'GET', url: '/api/prueba' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: { code: 'TABLE_OCCUPIED', message: 'La mesa 5 ya fue abierta por Luis', details: {} },
    });
  });

  it('un error inesperado responde 500 INTERNAL_ERROR sin exponer el detalle', async () => {
    const app = await buildApp({
      env: testEnv(),
      checkDb: healthyDb,
      register: (a) => {
        a.get('/api/falla', () => {
          throw new Error('password=secreta en la consulta');
        });
      },
    });
    const res = await app.inject({ method: 'GET', url: '/api/falla' });
    expect(res.statusCode).toBe(500);
    expect(res.json().error.code).toBe('INTERNAL_ERROR');
    expect(res.body).not.toContain('secreta');
  });

  it('un cuerpo inválido responde 400 VALIDATION_ERROR con details[] por campo', async () => {
    const app = await buildApp({
      env: testEnv(),
      checkDb: healthyDb,
      register: (a) => {
        a.post(
          '/api/eco',
          { schema: { body: z.object({ total: z.string() }) } },
          (req) => req.body,
        );
      },
    });
    const res = await app.inject({ method: 'POST', url: '/api/eco', payload: { total: 5 } });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toMatchObject({ path: 'total' });
  });
});
