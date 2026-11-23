// Consultas y cambios de usuarios, roles y permisos (Docs/08 §2.3; H3 #21).
import type {
  AdminUser,
  CreateRoleRequest,
  CreateUserRequest,
  DiscountLimitsRequest,
  Role,
  UpdateRoleRequest,
  UpdateUserRequest,
} from '@mise/shared/contracts/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';

const USERS_KEY = ['users'] as const;
const ROLES_KEY = ['roles'] as const;

export function useUsers() {
  return useQuery({ queryKey: USERS_KEY, queryFn: () => apiFetch<AdminUser[]>('/users') });
}

export function useRoles() {
  return useQuery({ queryKey: ROLES_KEY, queryFn: () => apiFetch<Role[]>('/roles') });
}

/** Cualquier cambio de un usuario vuelve a leer la lista y el conteo de usuarios por rol. */
function useUserMutation<TVars>(fn: (vars: TVars) => Promise<AdminUser>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: USERS_KEY });
      void qc.invalidateQueries({ queryKey: ROLES_KEY });
    },
  });
}

export const useCreateUser = () =>
  useUserMutation((body: CreateUserRequest) =>
    apiFetch<AdminUser>('/users', { method: 'POST', body }),
  );

export const useUpdateUser = () =>
  useUserMutation(({ id, body }: { id: string; body: UpdateUserRequest }) =>
    apiFetch<AdminUser>(`/users/${id}`, { method: 'PUT', body }),
  );

export const useSetUserPin = () =>
  useUserMutation(({ id, pin }: { id: string; pin: string | null }) =>
    apiFetch<AdminUser>(`/users/${id}/pin`, { method: 'POST', body: { pin } }),
  );

// Roles y permisos (Docs/03; H3 #21)

export function usePermissions() {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => apiFetch<{ code: string; description: string }[]>('/permissions'),
    staleTime: Infinity,
  });
}

/** Cualquier cambio de un rol vuelve a leer la lista de roles. */
function useRoleMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ROLES_KEY }),
  });
}

export const useCreateRole = () =>
  useRoleMutation((body: CreateRoleRequest) => apiFetch<Role>('/roles', { method: 'POST', body }));

export const useUpdateRole = () =>
  useRoleMutation(({ id, body }: { id: string; body: UpdateRoleRequest }) =>
    apiFetch<Role>(`/roles/${id}`, { method: 'PUT', body }),
  );

export const useDeleteRole = () =>
  useRoleMutation((id: string) => apiFetch<void>(`/roles/${id}`, { method: 'DELETE' }));

export const useSetDiscountLimits = () =>
  useRoleMutation(({ id, body }: { id: string; body: DiscountLimitsRequest }) =>
    apiFetch<Role>(`/roles/${id}/discount-limits`, { method: 'PUT', body }),
  );
