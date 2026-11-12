import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, configureApi } from './client.js';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureApi({ getHeaders: () => ({}) });
});

describe('apiFetch (Docs/08 §1)', () => {
  it('usa la URL relativa /api: el dominio decide el cliente', async () => {
    const fetchMock = mockFetch(200, { status: 'ok' });
    await apiFetch('/health');
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/health');
  });

  it('devuelve el JSON de la respuesta', async () => {
    mockFetch(200, { now: '2026-11-11T18:04:00Z' });
    await expect(apiFetch('/time')).resolves.toEqual({ now: '2026-11-11T18:04:00Z' });
  });

  it('envía el cuerpo como JSON y las cabeceras de sesión configuradas', async () => {
    const fetchMock = mockFetch(200, {});
    configureApi({
      getHeaders: () => ({ Authorization: 'Bearer t', 'X-Device-Id': 'D1' }),
    });
    await apiFetch('/tables/1/open', { method: 'POST', body: { guests: 4 } });
    const init = fetchMock.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"guests":4}');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer t');
    expect(headers.get('x-device-id')).toBe('D1');
  });

  it('un error de la API se lanza como ApiError con su código, mensaje y detalles', async () => {
    mockFetch(409, {
      error: { code: 'TABLE_OCCUPIED', message: 'La mesa 5 ya fue abierta por Luis', details: {} },
    });
    const error = await apiFetch('/tables/5/open', { method: 'POST' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'TABLE_OCCUPIED',
      message: 'La mesa 5 ya fue abierta por Luis',
    });
  });

  it('una respuesta de error sin el formato estándar se lanza como INTERNAL_ERROR', async () => {
    mockFetch(502, '<html>Bad Gateway</html>');
    const error = await apiFetch('/health').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('sin conexión lanza un ApiError de red (status 0) para que la outbox reintente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const error = await apiFetch('/health').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, isNetworkError: true });
  });
});
