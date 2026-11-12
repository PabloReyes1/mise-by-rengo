import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../core/app.js';
import { createPairingCode } from '../auth/index.js';
import { toDbId } from '../../core/ids.js';
import { resetDb } from '../../core/test-db.js';
import { createUser, prisma, setupFixture } from '../../core/test-app.js';
import { effectiveLicense } from './license.js';

let app: App;
let branchId: string;
let headers: Record<string, string>;

async function loginAs(username: string, password: string) {
  const { code } = await createPairingCode(prisma, { branchId: toDbId(branchId) });
  const device = (
    await app.inject({
      method: 'POST',
      url: '/api/devices/pair',
      payload: { code, name: 'Admin', type: 'ADMIN' },
    })
  ).json();
  const session = (
    await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-device-id': device.deviceId, 'x-device-token': device.deviceToken },
      payload: { username, password },
    })
  ).json();
  return { authorization: `Bearer ${session.accessToken}`, 'x-device-id': device.deviceId };
}

beforeEach(async () => {
  ({ app, branchId } = await setupFixture({
    rateLimits: { pairPerMinute: 1000, loginPerMinute: 1000 },
  }));
  headers = await loginAs('dev', 'desarrollo-local');
});
afterAll(async () => {
  await resetDb(prisma);
});

describe('effectiveLicense (RF-256, S-32)', () => {
  const today = new Date('2026-11-12T12:00:00Z');
  const base = { status: 'ACTIVA', graceDays: 5 };

  it('sin fecha de vencimiento sigue activa', () => {
    expect(effectiveLicense({ ...base, validUntil: null }, today)).toMatchObject({
      status: 'ACTIVA',
      daysLeft: null,
    });
  });

  it('antes de vencer está activa y dice cuántos días faltan', () => {
    expect(effectiveLicense({ ...base, validUntil: new Date('2026-11-20') }, today)).toMatchObject({
      status: 'ACTIVA',
      daysLeft: 8,
    });
  });

  it('vencida pero dentro de los días de gracia: GRACIA', () => {
    expect(effectiveLicense({ ...base, validUntil: new Date('2026-11-10') }, today).status).toBe(
      'GRACIA',
    );
  });

  it('pasados los días de gracia: SOLO_LECTURA', () => {
    expect(effectiveLicense({ ...base, validUntil: new Date('2026-11-01') }, today).status).toBe(
      'SOLO_LECTURA',
    );
  });

  it('con 0 días de gracia pasa a solo lectura al día siguiente de vencer', () => {
    expect(
      effectiveLicense(
        { status: 'ACTIVA', graceDays: 0, validUntil: new Date('2026-11-11') },
        today,
      ).status,
    ).toBe('SOLO_LECTURA');
  });

  it('SUSPENDIDA manda sobre las fechas', () => {
    expect(
      effectiveLicense({ ...base, status: 'SUSPENDIDA', validUntil: null }, today).status,
    ).toBe('SUSPENDIDA');
  });
});

describe('GET /api/config/public', () => {
  it('es público y trae lo que la PWA necesita antes de iniciar sesión', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/config/public' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      tradeName: 'La Fonda de Prueba',
      themeId: 'botanical-graphite',
      currency: 'GTQ',
      currencySymbol: 'Q',
      timeZone: 'America/Guatemala',
      licenseStatus: 'ACTIVA',
      modules: { recipes: true, ai: false },
    });
  });
});

describe('PUT /api/config/settings (config.restaurant)', () => {
  it('guarda, sube settingsVersion y deja la bitácora con solo lo que cambió', async () => {
    const current = (
      await app.inject({ method: 'GET', url: '/api/config/settings', headers })
    ).json();
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/settings',
      headers,
      payload: { tradeName: 'La Fonda', settingsVersion: current.settingsVersion },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      tradeName: 'La Fonda',
      settingsVersion: current.settingsVersion + 1,
    });
    const log = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'config.settings.update' },
    });
    expect(log.after).toEqual({ tradeName: 'La Fonda' });
  });

  it('con una versión vieja responde 409 STALE_VERSION', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/settings',
      headers,
      payload: { tradeName: 'Otro', settingsVersion: 0 },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('STALE_VERSION');
  });

  it('rechaza un primary del cliente que no cumple el contraste y dice qué falla (Docs/18 §6)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/settings',
      headers,
      payload: { colorPrimaryOverride: '#A5A58D', settingsVersion: 1 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
    expect(res.json().error.message).toMatch(/contraste/);
  });

  it('rechaza un tema que no se puede elegir', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/config/settings',
      headers,
      payload: { themeId: 'cielo-de-medianoche', settingsVersion: 1 },
    });
    expect(res.statusCode).toBe(400);
  });

  it('un mesero no puede cambiar la configuración', async () => {
    await createUser('ana', 'Mesero');
    const waiter = await loginAs('ana', 'clave-segura-123');
    const res = await app.inject({ method: 'GET', url: '/api/config/settings', headers: waiter });
    expect(res.json().error.code).toBe('AUTHORIZATION_REQUIRED');
  });
});

describe('licencia: solo lectura y suspendida (RF-252, RF-256)', () => {
  it('en SOLO_LECTURA se puede consultar pero no modificar', async () => {
    await prisma.license.updateMany({ data: { validUntil: new Date('2020-01-01'), graceDays: 0 } });
    const read = await app.inject({ method: 'GET', url: '/api/config/settings', headers });
    expect(read.statusCode).toBe(200);
    const write = await app.inject({
      method: 'PUT',
      url: '/api/config/settings',
      headers,
      payload: { tradeName: 'X', settingsVersion: 1 },
    });
    expect(write.statusCode).toBe(402);
    expect(write.json().error.code).toBe('LICENSE_READ_ONLY');
  });

  it('SUSPENDIDA responde 402 en todo salvo /api/health', async () => {
    await prisma.license.updateMany({ data: { status: 'SUSPENDIDA' } });
    const res = await app.inject({ method: 'GET', url: '/api/config/settings', headers });
    expect(res.json().error.code).toBe('LICENSE_SUSPENDED');
    expect((await app.inject({ method: 'GET', url: '/api/health' })).statusCode).toBe(200);
  });
});

describe('sucursales y plantillas de ticket', () => {
  it('crear una sucursal le copia las plantillas de ticket y una estación de cocina', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/branches',
      headers,
      payload: {
        name: 'Zona 10',
        address: '',
        phone: '',
        timezone: null,
        folioPrefix: 'Z',
        active: true,
      },
    });
    expect(res.statusCode).toBe(201);
    const id = toDbId(res.json().id);
    expect(await prisma.ticketTemplate.count({ where: { branchId: id } })).toBe(5);
    expect(await prisma.kitchenStation.count({ where: { branchId: id, isDefault: true } })).toBe(1);
  });

  it('edita el pie del recibo de una sucursal', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/api/branches/${branchId}/ticket-templates/RECIBO`,
      headers,
      payload: { footer: '¡Vuelva pronto!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ docType: 'RECIBO', footer: '¡Vuelva pronto!' });
  });
});
