// Configuración › Mesas: zonas y mesas (Docs/08 §2.5, permiso config.tables).
// Los endpoints son del módulo floor (Pablito); esta pantalla de configuración es de admin (doc 17 §5).
// Es configuración, no operación: va directo a la API, sin outbox (Docs/09 §8: solo con conexión).
import type {
  CreateTable,
  DiningTable,
  FloorResponse,
  SaveZone,
  UpdateTable,
  Zone,
} from '@mise/shared/contracts/floor';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';

const ZONES_KEY = ['zones'] as const;
/** La misma clave que usa el mapa del mesero: al guardar aquí, el mapa se actualiza. */
const FLOOR_KEY = ['floor'] as const;

/** Todas las zonas, también las inactivas. */
export function useZones() {
  return useQuery({ queryKey: ZONES_KEY, queryFn: () => apiFetch<Zone[]>('/zones') });
}

/** Mesas activas de las zonas activas, con su estado. */
export function useFloorTables() {
  return useQuery({ queryKey: FLOOR_KEY, queryFn: () => apiFetch<FloorResponse>('/floor') });
}

function useTablesMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ZONES_KEY });
      void qc.invalidateQueries({ queryKey: FLOOR_KEY });
    },
  });
}

export function useSaveZone() {
  return useTablesMutation((v: { id?: string | undefined; body: SaveZone }) =>
    v.id
      ? apiFetch<Zone>(`/zones/${v.id}`, { method: 'PUT', body: v.body })
      : apiFetch<Zone>('/zones', { method: 'POST', body: v.body }),
  );
}

export function useCreateTable() {
  return useTablesMutation((body: CreateTable) =>
    apiFetch<DiningTable>('/tables', { method: 'POST', body }),
  );
}

export function useUpdateTable() {
  return useTablesMutation((v: { id: string; body: UpdateTable }) =>
    apiFetch<DiningTable>(`/tables/${v.id}`, { method: 'PUT', body: v.body }),
  );
}
