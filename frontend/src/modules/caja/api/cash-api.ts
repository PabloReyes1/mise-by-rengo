// Caja: cajas, turno y movimientos (Docs/08 §2.8). Reasignado a Deniscito (doc 17 §3.1, H3 #18).
// Abrir turno es solo en línea (PA-042): va directo a la API, sin outbox.
import type { Authorization } from '@mise/shared/contracts/auth';
import type { PaidBillSummary } from '@mise/shared/contracts/billing';
import type {
  CashRegister,
  ShiftDetail,
  ShiftReport,
  ShiftSummary,
} from '@mise/shared/contracts/cash';
import type { Reason } from '@mise/shared/contracts/config';
import type { FloorResponse, Occupancy } from '@mise/shared/contracts/floor';
import { newId } from '@mise/shared/domain/ids';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';

export const REGISTERS_KEY = ['cash', 'registers'] as const;
export const shiftKey = (id: string) => ['cash', 'shift', id] as const;

export function useCashRegisters() {
  return useQuery({
    queryKey: REGISTERS_KEY,
    queryFn: () => apiFetch<CashRegister[]>('/cash-registers'),
  });
}

export function useShift(id: string | null) {
  return useQuery({
    queryKey: shiftKey(id ?? ''),
    queryFn: () => apiFetch<ShiftDetail>(`/shifts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCashReasons(type: 'CASH_WITHDRAWAL' | 'CASH_DEPOSIT') {
  return useQuery({
    queryKey: ['reasons', type],
    queryFn: () => apiFetch<Reason[]>(`/reasons?type=${type}`),
    staleTime: 10 * 60_000,
  });
}

export function useOpenShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { cashRegisterId: string; openingFloat: string }) =>
      apiFetch<ShiftSummary>('/shifts', { method: 'POST', body: { id: newId(), ...v } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: REGISTERS_KEY }),
  });
}

export interface MovementInput {
  shiftId: string;
  type: 'DEPOSITO' | 'RETIRO';
  amount: string;
  reasonId: string;
  note?: string;
  authorization?: Authorization;
}

export function useAddMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, ...body }: MovementInput & { id: string }) =>
      apiFetch<ShiftDetail>(`/shifts/${shiftId}/movements`, { method: 'POST', body }),
    onSuccess: (shift) => {
      qc.setQueryData(shiftKey(shift.id), shift);
      void qc.invalidateQueries({ queryKey: REGISTERS_KEY });
    },
  });
}

/** Nombre de cada mesa (id → nombre) para listar lo que hay por cobrar. */
export function useFloorNames(): Map<string, string> {
  const floor = useQuery({ queryKey: ['floor'], queryFn: () => apiFetch<FloorResponse>('/floor') });
  return new Map(
    (floor.data?.zones ?? []).flatMap((z) => z.tables.map((t) => [t.id, t.name] as const)),
  );
}

/** Mesas y órdenes para llevar abiertas, para cobrarlas desde la caja (Docs/05 paso 11). */
export function useOpenOccupancies() {
  return useQuery({
    queryKey: ['occupancies', 'ABIERTA'],
    queryFn: () => apiFetch<Occupancy[]>('/occupancies?status=ABIERTA'),
    refetchInterval: 15_000,
  });
}

/** Empezar el corte: el turno deja de recibir efectivo (Docs/05 paso 13). */
export function useStartClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (shiftId: string) =>
      apiFetch<ShiftReport>(`/shifts/${shiftId}/start-close`, { method: 'POST', body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: REGISTERS_KEY }),
  });
}

export function useCloseShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      shiftId: string;
      countedCash: string;
      counts?: { denomination: string; quantity: number }[];
      comment?: string;
    }) => {
      const { shiftId, ...body } = v;
      return apiFetch<ShiftReport>(`/shifts/${shiftId}/close`, { method: 'POST', body });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: REGISTERS_KEY }),
  });
}

/** Cuentas pagadas hoy (para reabrir) y reabiertas pendientes (Docs/05 paso 14). */
export function useTodayBills() {
  return useQuery({
    queryKey: ['bills', 'today'],
    queryFn: () =>
      apiFetch<{ paid: PaidBillSummary[]; reopened: PaidBillSummary[] }>('/bills/today'),
    refetchInterval: 30_000,
  });
}

export function useReopenBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: {
      billId: string;
      reasonId: string;
      note?: string;
      cashRegisterId: string;
      version: number;
      authorization?: Authorization;
    }) => {
      const { billId, ...body } = v;
      return apiFetch<{ ok: boolean }>(`/bills/${billId}/reopen`, { method: 'POST', body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bills', 'today'] });
      void qc.invalidateQueries({ queryKey: REGISTERS_KEY });
    },
  });
}

export function useReopenReasons() {
  return useQuery({
    queryKey: ['reasons', 'REOPEN_BILL'],
    queryFn: () => apiFetch<Reason[]>('/reasons?type=REOPEN_BILL'),
    staleTime: 10 * 60_000,
  });
}
