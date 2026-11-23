// Métodos de pago y motivos (Docs/08 §2.3; H3 #21).
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
