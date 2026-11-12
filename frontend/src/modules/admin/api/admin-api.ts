// Consultas y cambios del módulo admin (Docs/08 §2.3 y §2.4).
import type {
  ComboGroup,
  MenuResponse,
  ModifierGroup,
  Product,
} from '@mise/shared/contracts/catalog';
import type { License, Settings } from '@mise/shared/contracts/config';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';
import { PUBLIC_CONFIG_KEY } from '../../../core/config/index.js';

export const MENU_KEY = ['menu'] as const;
const SETTINGS_KEY = ['config', 'settings'] as const;

export function useMenu() {
  return useQuery({ queryKey: MENU_KEY, queryFn: () => apiFetch<MenuResponse>('/menu') });
}

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiFetch<Settings>('/config/settings'),
  });
}

export function useLicense() {
  return useQuery({ queryKey: ['license'], queryFn: () => apiFetch<License>('/license') });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Settings> & { settingsVersion: number }) =>
      apiFetch<Settings>('/config/settings', { method: 'PUT', body }),
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEY, data);
      void qc.invalidateQueries({ queryKey: PUBLIC_CONFIG_KEY });
    },
  });
}

export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiFetch<{ logoUrl: string }>('/config/logo', { method: 'POST', formData });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SETTINGS_KEY });
      void qc.invalidateQueries({ queryKey: PUBLIC_CONFIG_KEY });
    },
  });
}

/** Cualquier cambio del menú vuelve a leer el menú completo. */
function useMenuMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: MENU_KEY }),
  });
}

export function useSaveCategory() {
  return useMenuMutation((v: { id?: string; name?: string; active?: boolean }) =>
    v.id
      ? apiFetch(`/categories/${v.id}`, { method: 'PUT', body: { name: v.name, active: v.active } })
      : apiFetch('/categories', { method: 'POST', body: { name: v.name } }),
  );
}

export interface ProductDraft {
  categoryId: string;
  name: string;
  shortDescription: string | null;
  sku: string;
  price: string;
  isCombo: boolean;
  status: Product['status'];
  modifierGroupIds: string[];
}

export function useSaveProduct() {
  return useMenuMutation((v: { id?: string | undefined; draft: ProductDraft }) =>
    v.id
      ? apiFetch<Product>(`/products/${v.id}`, { method: 'PUT', body: v.draft })
      : apiFetch<Product>('/products', { method: 'POST', body: v.draft }),
  );
}

export function useSetProductStatus() {
  return useMenuMutation((v: { id: string; status: Product['status'] }) =>
    apiFetch<Product>(`/products/${v.id}/status`, { method: 'PATCH', body: { status: v.status } }),
  );
}

export function useUploadProductImage() {
  return useMenuMutation((v: { id: string; file: File }) => {
    const formData = new FormData();
    formData.append('file', v.file);
    return apiFetch<{ imageUrl: string }>(`/products/${v.id}/image`, { method: 'POST', formData });
  });
}

export function useSaveComboGroups() {
  return useMenuMutation((v: { id: string; groups: ComboGroup[] }) =>
    apiFetch<Product>(`/products/${v.id}/combo-groups`, {
      method: 'PUT',
      body: { groups: v.groups },
    }),
  );
}

export interface ModifierGroupDraft {
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  modifiers: {
    id?: string | undefined;
    name: string;
    priceDelta: string;
    status: ModifierGroup['modifiers'][number]['status'];
  }[];
}

export function useSaveModifierGroup() {
  return useMenuMutation((v: { id?: string | undefined; draft: ModifierGroupDraft }) =>
    v.id
      ? apiFetch<ModifierGroup>(`/modifier-groups/${v.id}`, { method: 'PUT', body: v.draft })
      : apiFetch<ModifierGroup>('/modifier-groups', { method: 'POST', body: v.draft }),
  );
}

export function useCreatePairingCode() {
  return useMutation({
    mutationFn: (branchId: string) =>
      apiFetch<{ code: string; expiresAt: string }>('/devices/pairing-codes', {
        method: 'POST',
        body: { branchId },
      }),
  });
}

/** "58" o "58.5" → "58.50"; null si no es un monto válido. */
export function toMoney(input: string): string | null {
  const value = input.trim().replace(',', '.');
  if (!/^\d{1,10}(\.\d{0,2})?$/.test(value)) return null;
  const [int, dec = ''] = value.split('.');
  return `${Number(int)}.${dec.padEnd(2, '0')}`;
}
