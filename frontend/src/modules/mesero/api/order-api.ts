// Menú, pedidos y cuentas de la mesa para el mesero (Docs/08 §2.4, §2.6, §2.7). Dueño: Pablito.
// Las lecturas van directo a la API; enviar y entregar pasan por la outbox (core/offline).
import type { Bill } from '@mise/shared/contracts/billing';
import type { MenuResponse } from '@mise/shared/contracts/catalog';
import type { DeliverOrderRequest, Order, SendOrderRequest } from '@mise/shared/contracts/orders';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';
import { runOperation } from '../../../core/offline/index.js';
import { FLOOR_KEY } from './floor-api.js';

const POLL_MS = 10_000;

export const ordersKey = (occupancyId: string) => ['occupancy', occupancyId, 'orders'] as const;
export const billsKey = (occupancyId: string) => ['occupancy', occupancyId, 'bills'] as const;

/** El menú cambia poco: se guarda 5 min (agotados al día llegan por tiempo real en H2) */
export function useMenu() {
  return useQuery({
    queryKey: ['menu'],
    queryFn: () => apiFetch<MenuResponse>('/menu'),
    staleTime: 5 * 60_000,
  });
}

export function useOccupancyOrders(occupancyId: string) {
  return useQuery({
    queryKey: ordersKey(occupancyId),
    queryFn: () => apiFetch<Order[]>(`/occupancies/${occupancyId}/orders`),
    refetchInterval: POLL_MS,
  });
}

export function useOccupancyBills(occupancyId: string) {
  return useQuery({
    queryKey: billsKey(occupancyId),
    queryFn: () => apiFetch<Bill[]>(`/occupancies/${occupancyId}/bills`),
    refetchInterval: POLL_MS,
  });
}

function useOrderAction<TVars extends { authorization?: unknown }>(
  occupancyId: string,
  build: (vars: TVars) => {
    type: string;
    entityId: string;
    path: string;
    body: object;
    label: string;
  },
) {
  const qc = useQueryClient();
  return useMutation({
    // Sin conexión TanStack pausaría la mutación y la acción no llegaría a la outbox (SC-39)
    networkMode: 'always',
    mutationFn: (vars: TVars) => {
      const op = build(vars);
      const body = vars.authorization ? { ...op.body, authorization: vars.authorization } : op.body;
      return runOperation<Order>({ ...op, method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ordersKey(occupancyId) });
      void qc.invalidateQueries({ queryKey: billsKey(occupancyId) });
      void qc.invalidateQueries({ queryKey: FLOOR_KEY });
    },
  });
}

/** Enviar la ronda a cocina (Docs/05 paso 4) */
export function useSendOrder(occupancyId: string) {
  return useOrderAction(
    occupancyId,
    (v: { body: SendOrderRequest; label: string } & Pick<SendOrderRequest, 'authorization'>) => ({
      type: 'order.send',
      // Depende de la mesa: si abrirla se rechaza, la ronda tampoco se envía (Docs/09 §4.2)
      entityId: occupancyId,
      path: '/orders',
      body: v.body,
      label: v.label,
    }),
  );
}

/** Marcar entregado (Docs/05 paso 9) */
export function useDeliverOrder(occupancyId: string) {
  return useOrderAction(
    occupancyId,
    (v: { orderId: string; label: string } & DeliverOrderRequest) => ({
      type: 'order.deliver',
      entityId: v.orderId,
      path: `/orders/${v.orderId}/deliver`,
      body: {},
      label: v.label,
    }),
  );
}
