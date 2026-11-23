// Cola y acciones del KDS (Docs/08 §2.6). Dueño: Deniscito.
// El KDS trabaja con conexión (Docs/09 §8: sin internet no recibe pedidos): las acciones van
// directo a la API, sin outbox. Los cambios de otras pantallas llegan por tiempo real.
import type { KdsOrder } from '@mise/shared/contracts/kitchen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';
import { realtime } from '../../../core/realtime/index.js';

export const KDS_KEY = ['kds', 'orders'] as const;

/** Respaldo por si se pierde el tiempo real: cada 60 s con él, cada 10 s sin él. */
const poll = () => (realtime.isConnected() ? 60_000 : 10_000);

export function useKdsOrders() {
  return useQuery({
    queryKey: KDS_KEY,
    queryFn: () => apiFetch<KdsOrder[]>('/kds/orders'),
    refetchInterval: poll,
  });
}

/** Reemplaza el pedido en la cola con lo que devolvió el servidor. */
function useKdsAction<V>(path: (v: V) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => apiFetch<KdsOrder>(path(v), { method: 'POST', body: {} }),
    onSuccess: (order) => {
      qc.setQueryData<KdsOrder[]>(KDS_KEY, (list) =>
        list?.map((o) => (o.id === order.id ? order : o)),
      );
    },
  });
}

export const useAccept = () => useKdsAction((orderId: string) => `/orders/${orderId}/accept`);
export const useOrderReady = () => useKdsAction((orderId: string) => `/orders/${orderId}/ready`);
export const useItemReady = () => useKdsAction((itemId: string) => `/order-items/${itemId}/ready`);
export const useRecall = () => useKdsAction((orderId: string) => `/orders/${orderId}/recall`);
