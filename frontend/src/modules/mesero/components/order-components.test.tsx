import type { ModifierGroup, Product } from '@mise/shared/contracts/catalog';
import type { Order } from '@mise/shared/contracts/orders';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { OrderList } from './OrderList.js';
import { ProductDialog } from './ProductDialog.js';

const ID = (n: number) => `01JD4K7P000000000000000${String(n).padStart(3, '0')}`;

beforeAll(() => {
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

function wrap(node: ReactNode) {
  // La configuración pública no responde: se usa la regional por defecto
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('sin red'))),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{node}</QueryClientProvider>);
}

const termino: ModifierGroup = {
  id: ID(10),
  name: 'Término de la carne',
  required: true,
  minSelect: 1,
  maxSelect: 1,
  sort: 0,
  modifiers: [
    { id: ID(11), name: 'Término medio', priceDelta: '0.00', status: 'ACTIVE', sort: 0 },
    { id: ID(12), name: 'Bien cocido', priceDelta: '0.00', status: 'ACTIVE', sort: 1 },
  ],
};
const extras: ModifierGroup = {
  id: ID(20),
  name: 'Extras',
  required: false,
  minSelect: 0,
  maxSelect: 2,
  sort: 1,
  modifiers: [
    { id: ID(21), name: 'Aguacate', priceDelta: '8.00', status: 'ACTIVE', sort: 0 },
    { id: ID(22), name: 'Queso fresco', priceDelta: '6.00', status: 'ACTIVE', sort: 1 },
    { id: ID(23), name: 'Tortillas extra', priceDelta: '4.00', status: 'SOLD_OUT', sort: 2 },
  ],
};
const churrasco: Product = {
  id: ID(1),
  categoryId: ID(2),
  name: 'Churrasco',
  shortDescription: null,
  sku: 'CHU',
  price: '95.00',
  isCombo: false,
  status: 'ACTIVE',
  sort: 0,
  imageUrl: null,
  modifierGroupIds: [termino.id, extras.id],
  comboGroups: [],
};

describe('ProductDialog: reglas de los grupos', () => {
  it('no agrega sin el grupo obligatorio y dice qué falta', async () => {
    const onAdd = vi.fn();
    wrap(
      <ProductDialog
        product={churrasco}
        groups={[termino, extras]}
        onClose={() => {}}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Agregar/ }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Falta elegir: Término de la carne');
  });

  it('respeta el máximo, no deja elegir agotados y calcula el precio', async () => {
    const onAdd = vi.fn();
    wrap(
      <ProductDialog
        product={churrasco}
        groups={[termino, extras]}
        onClose={() => {}}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(screen.getByRole('radio', { name: /Término medio/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Aguacate/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Queso fresco/ }));
    // Ya hay 2 de 2 y el tercero está agotado
    expect(screen.getByRole('checkbox', { name: /Tortillas extra/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /uno más/ }));
    // (95 + 8 + 6) × 2 = 218
    const add = screen.getByRole('button', { name: /Agregar/ });
    expect(add).toHaveTextContent('218.00');
    await userEvent.click(add);
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: churrasco.id,
        quantity: 2,
        modifiers: [
          { modifierId: ID(11), name: 'Término medio', priceDelta: '0.00' },
          { modifierId: ID(21), name: 'Aguacate', priceDelta: '8.00' },
          { modifierId: ID(22), name: 'Queso fresco', priceDelta: '6.00' },
        ],
      }),
    );
  });
});

describe('OrderList: estado en texto', () => {
  const order: Order = {
    id: ID(30),
    occupancyId: ID(31),
    roundNumber: 2,
    folio: '000007',
    tempFolio: null,
    status: 'LISTO',
    sentBy: ID(32),
    sentAt: '2026-11-22T20:00:00Z',
    acceptedAt: null,
    readyAt: null,
    deliveredAt: null,
    deliveredAuto: false,
    syncedLate: false,
    printedAt: null,
    version: 1,
    items: [
      {
        id: ID(33),
        orderId: ID(30),
        billId: ID(34),
        productId: ID(1),
        productName: 'Café de olla',
        quantity: 2,
        unitPrice: '12.00',
        modifiersTotal: '0.00',
        lineTotal: '24.00',
        note: null,
        status: 'CANCELADO',
        modifiers: [],
        components: [],
        splitFromId: null,
        readyAt: null,
        cancelledAt: '2026-11-22T20:05:00Z',
        version: 1,
      },
    ],
  };

  it('muestra la ronda, el estado, los cancelados y el botón de entregar', async () => {
    const onDeliver = vi.fn();
    wrap(<OrderList orders={[order]} onDeliver={onDeliver} />);
    expect(screen.getByRole('heading', { name: /Ronda 2/ })).toHaveTextContent('000007');
    expect(screen.getByText('Listo para entregar')).toBeInTheDocument();
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar entregado' }));
    expect(onDeliver).toHaveBeenCalledWith(order);
  });
});
