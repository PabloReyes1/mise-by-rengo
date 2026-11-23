// Cuentas de la mesa desde el mesero (Docs/08 §2.7, RF-102 a RF-104, #17 del plan).
// Reasignado a Deniscito (doc 17 §3.1). Las acciones pasan por la outbox (también sin conexión).
import type { Authorization } from '@mise/shared/contracts/auth';
import type {
  Bill,
  PayBillRequest,
  PaymentMethod,
  PrecheckResponse,
  Receipt,
} from '@mise/shared/contracts/billing';
import { newId } from '@mise/shared/domain/ids';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';
import { runOperation, type OperationOutcome } from '../../../core/offline/index.js';
import { billsKey, ordersKey } from './order-api.js';

interface Op {
  type: string;
  entityId: string;
  method: 'POST' | 'PATCH';
  path: string;
  body: object;
  label: string;
}

function useBillAction<V extends { authorization?: Authorization }, T>(
  occupancyId: string,
  build: (v: V) => Op,
) {
  const qc = useQueryClient();
  return useMutation({
    // Sin conexión TanStack pausaría la mutación y no llegaría a la outbox (SC-39)
    networkMode: 'always',
    mutationFn: (v: V): Promise<OperationOutcome<T>> => {
      const op = build(v);
      const body = v.authorization ? { ...op.body, authorization: v.authorization } : op.body;
      return runOperation<T>({ ...op, body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billsKey(occupancyId) });
      void qc.invalidateQueries({ queryKey: ordersKey(occupancyId) });
      void qc.invalidateQueries({ queryKey: ['floor'] });
    },
  });
}

export function useCreateBill(occupancyId: string) {
  return useBillAction<{ name: string; authorization?: Authorization }, Bill>(occupancyId, (v) => {
    const id = newId();
    return {
      type: 'bill.create',
      entityId: id,
      method: 'POST',
      path: `/occupancies/${occupancyId}/bills`,
      body: { id, name: v.name },
      label: `Crear ${v.name}`,
    };
  });
}

export function useRenameBill(occupancyId: string) {
  return useBillAction<{ bill: Bill; name: string; authorization?: Authorization }, Bill>(
    occupancyId,
    (v) => ({
      type: 'bill.update',
      entityId: v.bill.id,
      method: 'PATCH',
      path: `/bills/${v.bill.id}`,
      body: { name: v.name, version: v.bill.version },
      label: `Renombrar ${v.bill.name}`,
    }),
  );
}

export function useMoveItems(occupancyId: string) {
  return useBillAction<
    {
      itemIds: string[];
      target: Bill;
      versions: Record<string, number>;
      authorization?: Authorization;
    },
    { bills: Bill[] }
  >(occupancyId, (v) => ({
    type: 'bill.move_items',
    entityId: v.target.id,
    method: 'POST',
    path: '/bills/move-items',
    body: { itemIds: v.itemIds, targetBillId: v.target.id, versions: v.versions },
    label: `Mover ${v.itemIds.length} a ${v.target.name}`,
  }));
}

export function useSplitItem(occupancyId: string) {
  return useBillAction<
    {
      itemId: string;
      name: string;
      quantity: number;
      version: number;
      targetBillId?: string | undefined;
      authorization?: Authorization;
    },
    unknown
  >(occupancyId, (v) => ({
    type: 'order_item.split',
    entityId: v.itemId,
    method: 'POST',
    path: `/order-items/${v.itemId}/split`,
    body: {
      newItemId: newId(),
      quantity: v.quantity,
      version: v.version,
      ...(v.targetBillId ? { targetBillId: v.targetBillId } : {}),
    },
    label: `Separar ${v.quantity} de ${v.name}`,
  }));
}

/** Pre-cuenta (Docs/05 paso 10): con 🔑 si es reimpresión. */
export function usePrecheck(occupancyId: string) {
  return useBillAction<{ bill: Bill; authorization?: Authorization }, PrecheckResponse>(
    occupancyId,
    (v) => ({
      type: 'bill.precheck',
      entityId: v.bill.id,
      method: 'POST',
      path: `/bills/${v.bill.id}/precheck`,
      body: {},
      label: `Pre-cuenta de ${v.bill.name}`,
    }),
  );
}

/** Métodos de pago activos (Docs/08 §2.7). */
export function usePaymentMethods() {
  return useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => apiFetch<PaymentMethod[]>('/payment-methods'),
    staleTime: 10 * 60_000,
  });
}

/** Cobrar una cuenta (Docs/05 paso 11, H3 #19): por la outbox, con los ids de pago del dispositivo. */
export function usePayBill(occupancyId: string) {
  return useBillAction<
    { bill: Bill; body: Omit<PayBillRequest, 'authorization'>; authorization?: Authorization },
    Receipt
  >(occupancyId, (v) => ({
    type: 'bill.pay',
    entityId: v.bill.id,
    method: 'POST',
    path: `/bills/${v.bill.id}/pay`,
    body: v.body,
    label: `Cobrar ${v.bill.name}`,
  }));
}
