// Caja: cajas, turno y movimientos (Docs/08 §2.8). Reasignado a Deniscito (doc 17 §3.1, H3 #18).
// Abrir turno es solo en línea (PA-042): va directo a la API, sin outbox.
import type { Authorization } from '@mise/shared/contracts/auth';
import type { CashRegister, ShiftDetail, ShiftSummary } from '@mise/shared/contracts/cash';
import type { Reason } from '@mise/shared/contracts/config';
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
