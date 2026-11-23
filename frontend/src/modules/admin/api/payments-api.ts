// Métodos de pago, motivos y cajas (Docs/08 §2.3 y §2.8; H3 #21).
import type {
  CashRegister,
  CreateCashRegisterRequest,
  UpdateCashRegisterRequest,
} from '@mise/shared/contracts/cash';
import type {
  CreatePaymentMethodRequest,
  PaymentMethodAdmin,
  UpdatePaymentMethodRequest,
} from '@mise/shared/contracts/billing';
import type {
  CreateReasonRequest,
  ReasonAdmin,
  UpdateReasonRequest,
} from '@mise/shared/contracts/config';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';

const METHODS_KEY = ['payment-methods'] as const;
const REASONS_KEY = ['reasons'] as const;

export function useAllPaymentMethods() {
  return useQuery({
    queryKey: [...METHODS_KEY, 'all'],
    queryFn: () => apiFetch<PaymentMethodAdmin[]>('/payment-methods?all=true'),
  });
}

/** Cambiar un método vuelve a leer también la lista que usa el cobro. */
function useMethodMutation<TVars>(fn: (vars: TVars) => Promise<PaymentMethodAdmin>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: METHODS_KEY }),
  });
}

export const useCreatePaymentMethod = () =>
  useMethodMutation((body: CreatePaymentMethodRequest) =>
    apiFetch<PaymentMethodAdmin>('/payment-methods', { method: 'POST', body }),
  );

export const useUpdatePaymentMethod = () =>
  useMethodMutation(({ id, body }: { id: string; body: UpdatePaymentMethodRequest }) =>
    apiFetch<PaymentMethodAdmin>(`/payment-methods/${id}`, { method: 'PUT', body }),
  );

export function useAllReasons() {
  return useQuery({
    queryKey: [...REASONS_KEY, 'all'],
    queryFn: () => apiFetch<ReasonAdmin[]>('/reasons?all=true'),
  });
}

function useReasonMutation<TVars>(fn: (vars: TVars) => Promise<ReasonAdmin>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: REASONS_KEY }),
  });
}

export const useCreateReason = () =>
  useReasonMutation((body: CreateReasonRequest) =>
    apiFetch<ReasonAdmin>('/reasons', { method: 'POST', body }),
  );

export const useUpdateReason = () =>
  useReasonMutation(({ id, body }: { id: string; body: UpdateReasonRequest }) =>
    apiFetch<ReasonAdmin>(`/reasons/${id}`, { method: 'PUT', body }),
  );

// Cajas (H3 #21). Misma raíz de clave que la pantalla de Caja, para que vea los cambios
const REGISTERS_KEY = ['cash', 'registers'] as const;

export function useAllCashRegisters() {
  return useQuery({
    queryKey: [...REGISTERS_KEY, 'all'],
    queryFn: () => apiFetch<CashRegister[]>('/cash-registers?all=true'),
  });
}

function useRegisterMutation<TVars>(fn: (vars: TVars) => Promise<CashRegister>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: REGISTERS_KEY }),
  });
}

export const useCreateCashRegister = () =>
  useRegisterMutation((body: CreateCashRegisterRequest) =>
    apiFetch<CashRegister>('/cash-registers', { method: 'POST', body }),
  );

export const useUpdateCashRegister = () =>
  useRegisterMutation(({ id, body }: { id: string; body: UpdateCashRegisterRequest }) =>
    apiFetch<CashRegister>(`/cash-registers/${id}`, { method: 'PUT', body }),
  );
