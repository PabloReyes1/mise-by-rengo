import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { authenticate } from '../../core/auth.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { authorize, createPairingCode } from './index.js';
import { toDbId } from '../../core/ids.js';

let app: App;
let branchId: string;

interface Device {
  deviceId: string;
  deviceToken: string;
  offlinePrefix: string;
}
interface Session {
  accessToken: string;
  refreshToken: string;
  permissions: string[];
}

async function pair(type = 'ADMIN', name = 'Tablet admin'): Promise<Device> {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const res = await app.inject({
    method: 'POST',
    url: '/api/devices/pair',
    payload: { code, name, type },
  });
  expect(res.statusCode).toBe(200);
  return res.json();
}

function deviceHeaders(d: Device) {
  return { 'x-device-id': d.deviceId, 'x-device-token': d.deviceToken };
}

async function login(d: Device, username: string, password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    headers: deviceHeaders(d),
    payload: { username, password },
  });
}

async function session(
  d: Device,
  username = 'dev',
  password = 'desarrollo-local',
): Promise<Session> {
  const res = await login(d, username, password);
  expect(res.statusCode).toBe(200);
  return res.json();
}

function bearer(d: Device, s: Session) {
  return { authorization: `Bearer ${s.accessToken}`, 'x-device-id': d.deviceId };
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
    register: (a) => {
      // Ruta de prueba para la autorización 🔑
      a.post(
        '/api/prueba/reabrir',
        { preHandler: [authenticate, authorize('bill.reopen')] },
        (req) => ({
          authorizedBy: req.authorizedBy,
        }),
      );
    },
  }));
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('emparejar dispositivo (ADR-008)', () => {
  it('con un código válido entrega el token del dispositivo y su prefijo de folios', async () => {
    const d = await pair('WAITER', 'Celular de Ana');
    expect(d.deviceToken.length).toBeGreaterThanOrEqual(32);
    expect(d.offlinePrefix).toBe('M1');
    expect((await pair('WAITER', 'Celular de Luis')).offlinePrefix).toBe('M2');
    expect((await pair('CASH', 'Caja 1')).offlinePrefix).toBe('C1');
  });

  it('el código sirve una sola vez', async () => {
    const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
    const payload = { code, name: 'Caja', type: 'CASH' };
    expect(
      (await app.inject({ method: 'POST', url: '/api/devices/pair', payload })).statusCode,
    ).toBe(200);
    const again = await app.inject({ method: 'POST', url: '/api/devices/pair', payload });
    expect(again.statusCode).toBe(400);
  });

  it('un código vencido no sirve', async () => {
    const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId), ttlMs: -1 });
    const res = await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'Caja', type: 'CASH' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('el administrador genera códigos con config.devices; el mesero no', async () => {
    const admin = await pair();
    const s = await session(admin);
    const ok = await app.inject({
      method: 'POST',
      url: '/api/devices/pairing-codes',
      headers: bearer(admin, s),
      payload: { branchId },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().code).toMatch(/^\d{6}$/);

    await createUser('ana', 'Mesero');
    const waiter = await session(admin, 'ana', 'clave-segura-123');
    const denied = await app.inject({
      method: 'POST',
      url: '/api/devices/pairing-codes',
      headers: bearer(admin, waiter),
      payload: { branchId },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });
});

describe('iniciar sesión con usuario y contraseña', () => {
  it('devuelve la sesión con permisos y sucursales', async () => {
    const d = await pair();
    const s = await session(d);
    expect(s.accessToken).toBeTruthy();
    expect(s.permissions).toContain('config.roles');
  });

  it('sin un dispositivo emparejado no se puede iniciar sesión', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'dev', password: 'desarrollo-local' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('contraseña incorrecta: 401 sin decir qué estuvo mal, y queda en la bitácora', async () => {
    const d = await pair();
    const res = await login(d, 'dev', 'otra');
    expect(res.statusCode).toBe(401);
    expect(res.json().error.message).toBe('Usuario o contraseña incorrectos');
    expect(await prisma.auditLog.count({ where: { action: 'auth.login_failed' } })).toBe(1);
  });

  it('tras 5 intentos fallidos la cuenta se bloquea aunque después la contraseña sea correcta', async () => {
    const d = await pair();
    for (let i = 0; i < 5; i++) await login(d, 'dev', 'otra');
    const res = await login(d, 'dev', 'desarrollo-local');
    expect(res.statusCode).toBe(423);
    expect(res.json().error.code).toBe('ACCOUNT_LOCKED');
  });

  it('un usuario inactivo no puede entrar (RF-030)', async () => {
    const d = await pair();
    await prisma.user.update({ where: { username: 'dev' }, data: { active: false } });
    expect((await login(d, 'dev', 'desarrollo-local')).statusCode).toBe(401);
  });
});

describe('PIN en dispositivos compartidos (RF-032)', () => {
  it('lista solo los usuarios con PIN de la sucursal del dispositivo', async () => {
    const d = await pair('CASH', 'Caja 1');
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/device-users',
      headers: deviceHeaders(d),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().map((u: { fullName: string }) => u.fullName)).toEqual([
      'Usuario de desarrollo',
    ]);
  });

  it('entra con el PIN correcto y rechaza uno incorrecto con PIN_INVALID', async () => {
    const d = await pair('CASH', 'Caja 1');
    const [user] = (
      await app.inject({ method: 'GET', url: '/api/auth/device-users', headers: deviceHeaders(d) })
    ).json();
    const ok = await app.inject({
      method: 'POST',
      url: '/api/auth/pin',
      headers: deviceHeaders(d),
      payload: { userId: user.id, pin: '0000' },
    });
    expect(ok.statusCode).toBe(200);
    const bad = await app.inject({
      method: 'POST',
      url: '/api/auth/pin',
      headers: deviceHeaders(d),
      payload: { userId: user.id, pin: '9999' },
    });
    expect(bad.statusCode).toBe(401);
    expect(bad.json().error.code).toBe('PIN_INVALID');
  });
});

describe('refrescar y cerrar sesión (S-04)', () => {
  it('el refresh rota el token: el anterior deja de servir', async () => {
    const d = await pair();
    const s = await session(d);
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: s.refreshToken },
    });
    expect(r1.statusCode).toBe(200);
    expect(r1.json().refreshToken).not.toBe(s.refreshToken);
    const reused = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: s.refreshToken },
    });
    expect(reused.statusCode).toBe(401);
  });

  it('la sesión vence tras 12 horas sin actividad', async () => {
    const d = await pair();
    const s = await session(d);
    await prisma.deviceSession.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: s.refreshToken },
    });
    expect(res.statusCode).toBe(401);
  });

  it('cerrar sesión revoca el refresh token', async () => {
    const d = await pair();
    const s = await session(d);
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: bearer(d, s),
      payload: { refreshToken: s.refreshToken },
    });
    expect(out.statusCode).toBe(204);
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: s.refreshToken },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('revocar dispositivo (RF-035)', () => {
  it('un dispositivo revocado no puede operar ni volver a iniciar sesión', async () => {
    const admin = await pair();
    const adminSession = await session(admin);
    const caja = await pair('CASH', 'Caja 1');
    const cajaSession = await session(caja);

    const del = await app.inject({
      method: 'DELETE',
      url: `/api/devices/${caja.deviceId}`,
      headers: bearer(admin, adminSession),
    });
    expect(del.statusCode).toBe(204);

    const op = await app.inject({
      method: 'POST',
      url: '/api/prueba/reabrir',
      headers: bearer(caja, cajaSession),
    });
    expect(op.statusCode).toBe(403);
    expect(op.json().error.code).toBe('DEVICE_REVOKED');
    const again = await login(caja, 'dev', 'desarrollo-local');
    expect(again.json().error.code).toBe('DEVICE_REVOKED');
  });
});

describe('autorización 🔑 con el PIN de otro usuario (RF-033, Docs/08 §1)', () => {
  it('sin el permiso y sin autorización responde AUTHORIZATION_REQUIRED', async () => {
    const d = await pair('WAITER', 'Celular');
    await createUser('ana', 'Mesero');
    const s = await session(d, 'ana', 'clave-segura-123');
    const res = await app.inject({
      method: 'POST',
      url: '/api/prueba/reabrir',
      headers: bearer(d, s),
      payload: {},
    });
    expect(res.json().error).toMatchObject({
      code: 'AUTHORIZATION_REQUIRED',
      details: { permission: 'bill.reopen' },
    });
  });

  it('con el PIN de un usuario que tiene el permiso, pasa y queda quién autorizó', async () => {
    const d = await pair('WAITER', 'Celular');
    await createUser('ana', 'Mesero');
    const s = await session(d, 'ana', 'clave-segura-123');
    const dev = await prisma.user.findUniqueOrThrow({ where: { username: 'dev' } });
    const { toApiId } = await import('../../core/ids.js');
    const res = await app.inject({
      method: 'POST',
      url: '/api/prueba/reabrir',
      headers: bearer(d, s),
      payload: { authorization: { userId: toApiId(dev.id), pin: '0000' } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().authorizedBy).toBe(toApiId(dev.id));
  });

  it('con un PIN incorrecto responde PIN_INVALID', async () => {
    const d = await pair('WAITER', 'Celular');
    await createUser('ana', 'Mesero');
    const s = await session(d, 'ana', 'clave-segura-123');
    const dev = await prisma.user.findUniqueOrThrow({ where: { username: 'dev' } });
    const { toApiId } = await import('../../core/ids.js');
    const res = await app.inject({
      method: 'POST',
      url: '/api/prueba/reabrir',
      headers: bearer(d, s),
      payload: { authorization: { userId: toApiId(dev.id), pin: '1234' } },
    });
    expect(res.json().error.code).toBe('PIN_INVALID');
  });
});

describe('límite de intentos (fuerza bruta del código de 6 dígitos)', () => {
  it('pasado el límite por minuto responde 429 RATE_LIMITED', async () => {
    const limited = await setupFixture({ rateLimits: { pairPerMinute: 2, loginPerMinute: 1000 } });
    const payload = { code: '000000', name: 'X', type: 'CASH' };
    await limited.app.inject({ method: 'POST', url: '/api/devices/pair', payload });
    await limited.app.inject({ method: 'POST', url: '/api/devices/pair', payload });
    const res = await limited.app.inject({ method: 'POST', url: '/api/devices/pair', payload });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('RATE_LIMITED');
  });
});
