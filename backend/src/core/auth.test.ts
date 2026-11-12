import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { authenticate, requirePermission, signAccessToken, type AccessClaims } from './auth.js';
import { TEST_SECRET, testEnv } from './test-helpers.js';

const DEVICE = '01JD4K7Q00000000000000DEV1';
const BRANCH_A = '01JD4K7Q0000000000000BRCHA';
const BRANCH_B = '01JD4K7Q0000000000000BRCHB';
const USER = '01JD4K7Q0000000000000USER1';

async function appWithProtectedRoutes() {
  return buildApp({
    env: testEnv(),
    checkDb: () => Promise.resolve(),
    register: (a) => {
      a.get('/api/protegida', { preHandler: [authenticate] }, (req) => ({
        userId: req.auth?.userId,
      }));
      a.post(
        '/api/reabrir',
        { preHandler: [authenticate, requirePermission('bill.reopen')] },
        () => ({ ok: true }),
      );
    },
  });
}

function token(claims: Partial<AccessClaims> = {}, ttl = '15m') {
  return signAccessToken(
    { userId: USER, deviceId: DEVICE, branchIds: [BRANCH_A], permissions: [], ...claims },
    TEST_SECRET,
    ttl,
  );
}

function headers(t: string, extra: Record<string, string> = {}) {
  return { authorization: `Bearer ${t}`, 'x-device-id': DEVICE, ...extra };
}

describe('autenticación (ADR-008, Docs/08 §1)', () => {
  it('sin token responde 401 UNAUTHENTICATED', async () => {
    const app = await appWithProtectedRoutes();
    const res = await app.inject({ method: 'GET', url: '/api/protegida' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('con un token válido deja pasar y expone el usuario', async () => {
    const app = await appWithProtectedRoutes();
    const res = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: headers(await token()),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBe(USER);
  });

  it('con un token vencido responde 401 TOKEN_EXPIRED (el frontend lo refresca)', async () => {
    const app = await appWithProtectedRoutes();
    const vencido = await token({}, '-1s');
    const res = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: headers(vencido),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('TOKEN_EXPIRED');
  });

  it('un token firmado con otro secreto (otro cliente) responde 401 UNAUTHENTICATED', async () => {
    const app = await appWithProtectedRoutes();
    const ajeno = await signAccessToken(
      { userId: USER, deviceId: DEVICE, branchIds: [], permissions: [] },
      'b'.repeat(128),
      '15m',
    );
    const res = await app.inject({ method: 'GET', url: '/api/protegida', headers: headers(ajeno) });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });

  it('si X-Device-Id no es el dispositivo del token responde 401 UNAUTHENTICATED', async () => {
    const app = await appWithProtectedRoutes();
    const res = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: headers(await token(), { 'x-device-id': '01JD4K7Q00000000000000DEV2' }),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHENTICATED');
  });
});

describe('sucursal (Docs/03 §5 regla 4)', () => {
  it('X-Branch-Id de una sucursal no asignada responde 403 BRANCH_FORBIDDEN', async () => {
    const app = await appWithProtectedRoutes();
    const res = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: headers(await token(), { 'x-branch-id': BRANCH_B }),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('BRANCH_FORBIDDEN');
  });

  it('con branch.all se puede usar cualquier sucursal', async () => {
    const app = await appWithProtectedRoutes();
    const res = await app.inject({
      method: 'GET',
      url: '/api/protegida',
      headers: headers(await token({ permissions: ['branch.all'] }), { 'x-branch-id': BRANCH_B }),
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('permisos (Docs/03, Docs/08 "Autorización 🔑")', () => {
  it('sin el permiso responde 403 AUTHORIZATION_REQUIRED con el permiso necesario', async () => {
    const app = await appWithProtectedRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/api/reabrir',
      headers: headers(await token()),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toMatchObject({
      code: 'AUTHORIZATION_REQUIRED',
      details: { permission: 'bill.reopen' },
    });
  });

  it('con el permiso deja pasar', async () => {
    const app = await appWithProtectedRoutes();
    const res = await app.inject({
      method: 'POST',
      url: '/api/reabrir',
      headers: headers(await token({ permissions: ['bill.reopen'] })),
    });
    expect(res.statusCode).toBe(200);
  });
});
