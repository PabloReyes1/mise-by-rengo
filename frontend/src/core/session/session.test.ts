import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../api/index.js';
import { sessionStore } from './index.js';

const device = {
  deviceId: '01JD4K7Q0000000000000000D1',
  deviceToken: 't'.repeat(43),
  offlinePrefix: 'C1',
  branchId: '01JD4K7Q0000000000000000B1',
  type: 'CASH' as const,
};
const session = {
  accessToken: 'acceso-1',
  refreshToken: 'r'.repeat(43),
  expiresIn: 900,
  user: { id: '01JD4K7Q0000000000000000A1', fullName: 'Ana', username: 'ana' },
  permissions: ['order.create'],
  branches: [{ id: device.branchId, name: 'Principal' }],
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStore.reset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sessionStore', () => {
  it('guarda el dispositivo y la sesión entre recargas (localStorage, SC-13)', () => {
    sessionStore.setDevice(device);
    sessionStore.setSession(session);
    sessionStore.reset(); // simula recargar la página: vuelve a leer localStorage
    expect(sessionStore.getDevice()).toEqual(device);
    expect(sessionStore.getSession()?.user.fullName).toBe('Ana');
  });

  it('arma las cabeceras de cada petición (Docs/08 §1)', () => {
    sessionStore.setDevice(device);
    sessionStore.setSession(session);
    expect(sessionStore.headers()).toMatchObject({
      Authorization: 'Bearer acceso-1',
      'X-Device-Id': device.deviceId,
      'X-Device-Token': device.deviceToken,
      'X-Branch-Id': device.branchId,
    });
  });

  it('cerrar sesión borra la sesión pero no el dispositivo emparejado', () => {
    sessionStore.setDevice(device);
    sessionStore.setSession(session);
    sessionStore.clearSession();
    expect(sessionStore.getSession()).toBeNull();
    expect(sessionStore.getDevice()).toEqual(device);
  });
});

describe('refresco automático del token (S-04)', () => {
  it('si el token venció, lo refresca y repite la petición una vez', async () => {
    sessionStore.setDevice(device);
    sessionStore.setSession(session);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        json(401, { error: { code: 'TOKEN_EXPIRED', message: 'La sesión expiró', details: {} } }),
      )
      .mockResolvedValueOnce(
        json(200, { ...session, accessToken: 'acceso-2', refreshToken: 's'.repeat(43) }),
      )
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/menu')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/refresh');
    const retryHeaders = new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit).headers);
    expect(retryHeaders.get('authorization')).toBe('Bearer acceso-2');
    expect(sessionStore.getSession()?.accessToken).toBe('acceso-2');
  });

  it('si el refresco falla (12 h sin actividad), cierra la sesión y lanza el error', async () => {
    sessionStore.setDevice(device);
    sessionStore.setSession(session);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          json(401, { error: { code: 'TOKEN_EXPIRED', message: 'x', details: {} } }),
        )
        .mockResolvedValueOnce(
          json(401, {
            error: { code: 'UNAUTHENTICATED', message: 'La sesión terminó', details: {} },
          }),
        ),
    );
    await expect(apiFetch('/menu')).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(sessionStore.getSession()).toBeNull();
  });
});
