// Consultas y acciones de mesas del mesero (Docs/08 §2.5). Dueño: Pablito.
// Las lecturas van directo a la API; las acciones pasan por la outbox (core/offline).
import type { Authorization } from '@mise/shared/contracts/auth';
import type {
  FloorResponse,
  MergeOccupancyRequest,
  MoveOccupancyRequest,
  Occupancy,
  OpenOccupancyRequest,
  TransferOccupancyRequest,
} from '@mise/shared/contracts/floor';
import { newId } from '@mise/shared/domain/ids';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../core/api/index.js';
import { runOperation, type OperationOutcome } from '../../../core/offline/index.js';
import { sessionStore } from '../../../core/session/index.js';
import { buildLocalOccupancy, cacheLocalOccupancy } from './local-occupancy.js';

export const FLOOR_KEY = ['floor'] as const;
const occupancyKey = (id: string) => ['occupancy', id] as const;
// Mismas claves que order-api (no se importa para no crear un ciclo entre los dos archivos)
const ordersKey = (id: string) => ['occupancy', id, 'orders'] as const;
const billsKey = (id: string) => ['occupancy', id, 'bills'] as const;
const OPEN_KEY = ['occupancies', 'ABIERTA'] as const;

/** Hasta que exista realtime (H2, Deniscito) el mapa se vuelve a leer cada 10 s. */
const POLL_MS = 10_000;

export function useFloor() {
  return useQuery({
    queryKey: FLOOR_KEY,
    queryFn: () => apiFetch<FloorResponse>('/floor'),
    refetchInterval: POLL_MS,
  });
}

export function useOpenOccupancies() {
  return useQuery({
    queryKey: OPEN_KEY,
    queryFn: () => apiFetch<Occupancy[]>('/occupancies?status=ABIERTA'),
    refetchInterval: POLL_MS,
  });
}

export function useOccupancy(id: string) {
  return useQuery({
    queryKey: occupancyKey(id),
    queryFn: () => apiFetch<Occupancy>(`/occupancies/${id}`),
    refetchInterval: POLL_MS,
  });
}

/** Usuarios de la sucursal para transferir (SC-36: solo los que tienen PIN). */
export function useBranchUsers() {
  return useQuery({
    queryKey: ['auth', 'device-users'],
    queryFn: () => apiFetch<{ id: string; fullName: string }[]>('/auth/device-users'),
  });
}

/** Toda acción de mesas puede repetirse con la 🔑 de quien sí puede (SC-42). */
export type WithAuthorization<T> = T & { authorization?: Authorization };

/** Acción de mesas: al aplicarse vuelve a leer el mapa y la ocupación. */
function useFloorAction<TVars extends { authorization?: Authorization }>(
  build: (vars: TVars) => {
    type: string;
    entityId: string;
    method: 'POST' | 'PATCH';
    path: string;
    body: unknown;
    label: string;
  },
  /** Sin conexión: arma la versión local para seguir trabajando (solo abrir mesa) */
  local?: (body: unknown) => Occupancy | null,
) {
  const qc = useQueryClient();
  return useMutation({
    // Sin conexión TanStack pausaría la mutación y la acción no llegaría a la outbox (SC-39)
    networkMode: 'always',
    mutationFn: async (vars: TVars): Promise<OperationOutcome<Occupancy>> => {
      const op = build(vars);
      // La 🔑 viaja en el cuerpo (Docs/08 §1); el servidor la valida al aplicar la acción
      const body = vars.authorization
        ? { ...(op.body as object), authorization: vars.authorization }
        : op.body;
      const outcome = await runOperation<Occupancy>({ ...op, body });
      if (outcome.status === 'queued' && local) {
        const occ = local(op.body);
        if (occ) {
          cacheLocalOccupancy(qc, occ, {
            floor: FLOOR_KEY,
            open: OPEN_KEY,
            occupancy: occupancyKey(occ.id),
            orders: ordersKey(occ.id),
            bills: billsKey(occ.id),
          });
          return { status: 'queued', data: occ } satisfies OperationOutcome<Occupancy>;
        }
      }
      return outcome;
    },
    onSuccess: (outcome: OperationOutcome<Occupancy>) => {
      if (outcome.status === 'applied')
        qc.setQueryData(occupancyKey(outcome.data.id), outcome.data);
      // Sin conexión no se vuelve a leer: se perdería la copia local hasta que se envíe
      if (outcome.status === 'queued' && outcome.data) return;
      void qc.invalidateQueries({ queryKey: FLOOR_KEY });
      void qc.invalidateQueries({ queryKey: OPEN_KEY });
    },
  });
}

export function useOpenTable() {
  return useFloorAction(
    (v: Omit<OpenOccupancyRequest, 'id' | 'billId'> & { tableName?: string }) => {
      const { tableName, authorization: _authorization, ...rest } = v;
      const id = newId();
      // La Cuenta 1 también nace con id del dispositivo (SC-28)
      const body: OpenOccupancyRequest = { ...rest, id, billId: newId() };
      return {
        type: 'occupancy.open',
        entityId: id,
        method: 'POST',
        path: '/occupancies',
        body,
        label: tableName ? `Abrir mesa ${tableName}` : 'Abrir orden para llevar',
      };
    },
    (body) => {
      const session = sessionStore.getSession();
      const device = sessionStore.getDevice();
      if (!session || !device) return null;
      return buildLocalOccupancy(body as OpenOccupancyRequest, {
        branchId: device.branchId,
        waiterId: session.user.id,
        waiterName: session.user.fullName,
        now: new Date(),
      });
    },
  );
}

export function useUpdateGuests() {
  return useFloorAction(
    (v: WithAuthorization<{ id: string; guests: number; version: number }>) => ({
      type: 'occupancy.update',
      entityId: v.id,
      method: 'PATCH',
      path: `/occupancies/${v.id}`,
      body: { guests: v.guests, version: v.version },
      label: `Cambiar a ${v.guests} comensales`,
    }),
  );
}

export function useMoveOccupancy() {
  return useFloorAction((v: MoveOccupancyRequest & { id: string; tableName: string }) => ({
    type: 'occupancy.move',
    entityId: v.id,
    method: 'POST',
    path: `/occupancies/${v.id}/move`,
    body: { targetTableId: v.targetTableId },
    label: `Trasladar a la mesa ${v.tableName}`,
  }));
}

export function useMergeOccupancy() {
  return useFloorAction((v: MergeOccupancyRequest & { id: string; tableName: string }) => ({
    type: 'occupancy.merge',
    entityId: v.id,
    method: 'POST',
    path: `/occupancies/${v.id}/merge`,
    body: { sourceOccupancyId: v.sourceOccupancyId },
    label: `Unir la mesa ${v.tableName}`,
  }));
}

export function useTransferOccupancy() {
  return useFloorAction((v: TransferOccupancyRequest & { id: string; waiterName: string }) => ({
    type: 'occupancy.transfer',
    entityId: v.id,
    method: 'POST',
    path: `/occupancies/${v.id}/transfer`,
    body: { waiterId: v.waiterId },
    label: `Transferir a ${v.waiterName}`,
  }));
}
