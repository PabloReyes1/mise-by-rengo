import type { Authorization } from '@mise/shared/contracts/auth';
import type { Occupancy } from '@mise/shared/contracts/floor';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OutboxRejectedError, type OperationOutcome } from '../../../core/offline/index.js';
import { useAuthorizedAction } from './authorized-action.js';

const GINA = { id: '01JD4K7P0000000000000000A1', fullName: 'Gina Gerente' };
const occupancy = { id: '01JD4K7P0000000000000000C1' } as Occupancy;

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

type Vars = { tableName: string; authorization?: Authorization };

function Harness({
  send,
  onDone,
}: {
  send: (vars: Vars) => Promise<OperationOutcome<Occupancy>>;
  onDone: (o: OperationOutcome<Occupancy>) => void;
}) {
  const mutation = useMutation({ mutationFn: send });
  const authorized = useAuthorizedAction();
  return (
    <>
      <button
        type="button"
        onClick={() => authorized.run(mutation, { tableName: '6' }, 'Unir la mesa 6', { onDone })}
      >
        Unir
      </button>
      {mutation.error && <p>Error en pantalla: {mutation.error.message}</p>}
      {authorized.dialog}
    </>
  );
}

function setup(send: (vars: Vars) => Promise<OperationOutcome<Occupancy>>) {
  // La ventana 🔑 pide la lista de quienes pueden autorizar
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify([GINA]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
  const onDone = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Harness send={send} onDone={onDone} />
    </QueryClientProvider>,
  );
  return onDone;
}

const needsKey = new OutboxRejectedError({
  code: 'AUTHORIZATION_REQUIRED',
  message: 'Esta acción requiere autorización',
  details: { permission: 'table.merge' },
});

async function typePin(pin: string) {
  for (const d of pin) await userEvent.click(screen.getByRole('button', { name: d }));
}

describe('acciones de mesas con 🔑 (SC-42)', () => {
  it('sin el permiso abre la ventana 🔑 y repite la acción con la autorización', async () => {
    const send = vi.fn((vars: Vars) =>
      vars.authorization
        ? Promise.resolve<OperationOutcome<Occupancy>>({ status: 'applied', data: occupancy })
        : Promise.reject(needsKey),
    );
    const onDone = setup(send);

    await userEvent.click(screen.getByRole('button', { name: 'Unir' }));
    expect(await screen.findByText(/Unir la mesa 6: necesita el PIN/)).toBeInTheDocument();
    // El error no se queda en la pantalla: lo resuelve la ventana
    expect(screen.queryByText(/Error en pantalla/)).not.toBeInTheDocument();

    // Solo Gina puede autorizar: va directo a su PIN
    await screen.findByText(/escribe tu PIN/);
    await typePin('4821');
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar' }));

    expect(send).toHaveBeenLastCalledWith(
      { tableName: '6', authorization: { userId: GINA.id, pin: '4821' } },
      expect.anything(),
    );
    expect(onDone).toHaveBeenCalledWith({ status: 'applied', data: occupancy });
  });

  it('PIN incorrecto: el mensaje queda en la ventana y se puede reintentar', async () => {
    const send = vi.fn((vars: Vars) =>
      Promise.reject(
        vars.authorization
          ? new OutboxRejectedError({ code: 'PIN_INVALID', message: 'PIN incorrecto' })
          : needsKey,
      ),
    );
    const onDone = setup(send);

    await userEvent.click(screen.getByRole('button', { name: 'Unir' }));
    await screen.findByText(/escribe tu PIN/);
    await typePin('0000');
    await userEvent.click(screen.getByRole('button', { name: 'Autorizar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('PIN incorrecto');
    expect(screen.queryByText(/Error en pantalla/)).not.toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('otros errores se quedan en la pantalla, sin ventana', async () => {
    const send = vi.fn(() =>
      Promise.reject(
        new OutboxRejectedError({ code: 'TABLE_OCCUPIED', message: 'La mesa ya está ocupada' }),
      ),
    );
    setup(send);
    await userEvent.click(screen.getByRole('button', { name: 'Unir' }));
    expect(
      await screen.findByText(/Error en pantalla: La mesa ya está ocupada/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/necesita el PIN/)).not.toBeInTheDocument();
  });
});
