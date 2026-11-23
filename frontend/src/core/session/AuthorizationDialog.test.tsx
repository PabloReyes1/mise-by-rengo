import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/index.js';
import { AuthorizationDialog, authorizationRequired } from './AuthorizationDialog.js';

const ANA = { id: '01JD4K7P0000000000000000A1', fullName: 'Ana Gerente' };
const LUIS = { id: '01JD4K7P0000000000000000A2', fullName: 'Luis Supervisor' };
beforeAll(() => {
  // jsdom no implementa <dialog>.showModal/close
  Object.assign(HTMLDialogElement.prototype, {
    showModal(this: HTMLDialogElement) {
      this.open = true;
    },
    close(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});

afterEach(() => vi.unstubAllGlobals());

function mockUsers(users: { id: string; fullName: string }[]) {
  const fetchMock = vi.fn((_url: string) =>
    Promise.resolve(
      new Response(JSON.stringify(users), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function wrap(node: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

async function typePin(pin: string) {
  for (const d of pin) await userEvent.click(screen.getByRole('button', { name: d }));
}

const request = { permission: 'table.merge', actionLabel: 'Unir la mesa 6' };

describe('authorizationRequired', () => {
  it('devuelve el permiso que falta solo para AUTHORIZATION_REQUIRED', () => {
    const needs = new ApiError(403, 'AUTHORIZATION_REQUIRED', 'Requiere autorización', {
      permission: 'table.merge',
    });
    expect(authorizationRequired(needs)).toBe('table.merge');
    expect(authorizationRequired(new ApiError(403, 'FORBIDDEN', 'No'))).toBeNull();
    expect(authorizationRequired(new Error('x'))).toBeNull();
    expect(authorizationRequired(null)).toBeNull();
  });
});

describe('AuthorizationDialog (🔑)', () => {
  it('pide solo a quienes tienen el permiso y repite la acción con su PIN', async () => {
    const fetchMock = mockUsers([ANA, LUIS]);
    const onAuthorize = vi.fn(() => Promise.resolve());
    const onClose = vi.fn();
    render(
      wrap(<AuthorizationDialog request={request} onAuthorize={onAuthorize} onClose={onClose} />),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Luis Supervisor' }));
    expect(fetchMock.mock.calls[0]?.[0]).toContain('permission=table.merge');
    await typePin('4821');
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar' }));

    expect(onAuthorize).toHaveBeenCalledWith({ userId: LUIS.id, pin: '4821' });
    expect(onClose).toHaveBeenCalled();
  });

  it('con una sola persona va directo al PIN; si el PIN falla lo dice y deja reintentar', async () => {
    mockUsers([ANA]);
    const onAuthorize = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(401, 'PIN_INVALID', 'PIN incorrecto'))
      .mockResolvedValueOnce(undefined);
    const onClose = vi.fn();
    render(
      wrap(<AuthorizationDialog request={request} onAuthorize={onAuthorize} onClose={onClose} />),
    );

    expect(await screen.findByText(/escribe tu PIN/)).toBeInTheDocument();
    await typePin('1111');
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('PIN incorrecto');
    expect(onClose).not.toHaveBeenCalled();

    await typePin('2222');
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar' }));
    expect(onAuthorize).toHaveBeenLastCalledWith({ userId: ANA.id, pin: '2222' });
    expect(onClose).toHaveBeenCalled();
  });

  it('si nadie puede autorizar, lo explica', async () => {
    mockUsers([]);
    render(wrap(<AuthorizationDialog request={request} onAuthorize={vi.fn()} onClose={vi.fn()} />));
    expect(await screen.findByText(/Nadie con PIN en esta sucursal/)).toBeInTheDocument();
  });
});
