import type { FloorTable } from '@mise/shared/contracts/floor';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { GuestsStepper } from './GuestsStepper.js';
import { TableCard } from './TableCard.js';

const base: FloorTable = {
  id: '01JD4K7P0000000000000000A1',
  zoneId: '01JD4K7P0000000000000000B1',
  name: '5',
  capacity: 4,
  shape: 'SQUARE',
  posX: null,
  posY: null,
  width: null,
  height: null,
  status: 'LIBRE',
  active: true,
  currentOccupancyId: null,
  version: 0,
  occupancy: null,
  joinedTo: null,
};

const occupancy = {
  id: '01JD4K7P0000000000000000C1',
  waiterId: '01JD4K7P0000000000000000D1',
  waiterName: 'Ana',
  guests: 3,
  openedAt: '2026-11-18T19:00:00Z',
  version: 0,
};

describe('TableCard (RF-109): el estado nunca solo con color', () => {
  it('libre: muestra el estado en texto y los lugares', async () => {
    const onSelect = vi.fn();
    render(<TableCard table={base} isMine={false} onSelect={onSelect} />);
    const card = screen.getByRole('button', { name: /Mesa 5, Libre/ });
    expect(card).toHaveTextContent('4 lugares');
    await userEvent.click(card);
    expect(onSelect).toHaveBeenCalledWith(base);
  });

  it('ocupada: personas y quién la atiende', () => {
    render(
      <TableCard
        table={{ ...base, status: 'OCUPADA', occupancy }}
        isMine={false}
        onSelect={() => {}}
      />,
    );
    const card = screen.getByRole('button', { name: /Ocupada.*Atiende Ana/ });
    expect(card).toHaveTextContent('3 personas');
    expect(card).toHaveTextContent('Ana');
  });

  it('unida: dice a qué mesa', () => {
    render(
      <TableCard
        table={{
          ...base,
          name: '6',
          status: 'UNIDA',
          occupancy,
          joinedTo: { tableId: base.id, tableName: '5' },
        }}
        isMine
        onSelect={() => {}}
      />,
    );
    expect(screen.getByRole('button')).toHaveTextContent('Unida a 5');
  });

  it('bloqueada: no se puede tocar', () => {
    render(<TableCard table={{ ...base, status: 'BLOQUEADA' }} isMine onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /Bloqueada/ })).toBeDisabled();
  });
});

function Stepper({ start }: { start: number }) {
  const [value, setValue] = useState(start);
  return <GuestsStepper value={value} onChange={setValue} />;
}

describe('GuestsStepper (1 a 99)', () => {
  it('no baja de 1', async () => {
    render(<Stepper start={1} />);
    expect(screen.getByRole('button', { name: /uno menos/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /uno más/ }));
    expect(screen.getByRole('textbox', { name: 'Comensales' })).toHaveValue('2');
  });

  it('no pasa de 99', () => {
    render(<Stepper start={99} />);
    expect(screen.getByRole('button', { name: /uno más/ })).toBeDisabled();
  });

  it('se puede borrar y escribir el número (no se queda un 0 pegado)', async () => {
    render(<Stepper start={4} />);
    const input = screen.getByRole('textbox', { name: 'Comensales' });
    await userEvent.clear(input);
    expect(input).toHaveValue('');
    await userEvent.type(input, '12');
    expect(input).toHaveValue('12');
    await userEvent.click(screen.getByRole('button', { name: /uno más/ }));
    expect(input).toHaveValue('13');
  });

  it('si queda vacío, al salir vuelve al último valor válido', async () => {
    render(<Stepper start={4} />);
    const input = screen.getByRole('textbox', { name: 'Comensales' });
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue('4');
  });
});
