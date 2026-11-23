// Mesa abierta sin conexión (Docs/09 §8: abrir mesas y tomar pedidos funciona sin internet).
// Mientras "abrir mesa" espera en la outbox, el celular arma la ocupación con los mismos ids que
// enviará (ocupación y Cuenta 1, SC-28) y la pone en el caché: el mapa la muestra ocupada y el
// mesero puede entrar a tomar el pedido. Al volver la conexión, la outbox la envía y la próxima
// lectura del servidor reemplaza esta copia. Reasignada a Deniscito (doc 17 §3.1).
import type { Bill } from '@mise/shared/contracts/billing';
import type { FloorResponse, Occupancy, OpenOccupancyRequest } from '@mise/shared/contracts/floor';
import type { Order } from '@mise/shared/contracts/orders';
import type { QueryClient } from '@tanstack/react-query';

export interface LocalContext {
  branchId: string;
  waiterId: string;
  waiterName: string;
  now: Date;
}

/** La ocupación como la devolvería el servidor al abrirla. */
export function buildLocalOccupancy(req: OpenOccupancyRequest, ctx: LocalContext): Occupancy {
  const openedAt = ctx.now.toISOString();
  return {
    id: req.id,
    branchId: ctx.branchId,
    tableId: req.tableId ?? null,
    orderTypeCode: req.orderTypeCode,
    waiterId: req.waiterId ?? ctx.waiterId,
    waiterName: ctx.waiterName,
    guests: req.guests,
    customerName: req.customerName ?? null,
    customerPhone: req.customerPhone ?? null,
    status: 'ABIERTA',
    mergedIntoId: null,
    openedAt,
    closedAt: null,
    // Aproximado (el servidor usa zona horaria y hora de corte, ADR-011); se corrige al sincronizar
    businessDate: openedAt.slice(0, 10),
    version: 0,
    bills: req.billId ? [{ id: req.billId, name: 'Cuenta 1', status: 'ABIERTA', version: 0 }] : [],
    mergedTables: [],
  };
}

/** Pone la ocupación local en el mapa, en la lista de abiertas y en el detalle de la mesa. */
export function cacheLocalOccupancy(
  qc: QueryClient,
  occ: Occupancy,
  keys: {
    floor: readonly unknown[];
    open: readonly unknown[];
    occupancy: readonly unknown[];
    orders: readonly unknown[];
    bills: readonly unknown[];
  },
): void {
  qc.setQueryData(keys.occupancy, occ);
  qc.setQueryData<Order[]>(keys.orders, []);
  qc.setQueryData<Bill[]>(
    keys.bills,
    occ.bills.map((b) => ({
      id: b.id,
      occupancyId: occ.id,
      name: b.name,
      status: b.status,
      folio: null,
      subtotal: '0.00',
      discountTotal: '0.00',
      tipAmount: '0.00',
      total: '0.00',
      customerNit: null,
      customerTaxName: null,
      version: b.version,
    })),
  );
  qc.setQueryData<Occupancy[]>(keys.open, (list) =>
    list ? [...list.filter((o) => o.id !== occ.id), occ] : [occ],
  );
  if (!occ.tableId) return;
  qc.setQueryData<FloorResponse>(keys.floor, (floor) =>
    floor
      ? {
          ...floor,
          zones: floor.zones.map((z) => ({
            ...z,
            tables: z.tables.map((t) =>
              t.id === occ.tableId
                ? {
                    ...t,
                    status: 'OCUPADA',
                    currentOccupancyId: occ.id,
                    occupancy: {
                      id: occ.id,
                      waiterId: occ.waiterId,
                      waiterName: occ.waiterName,
                      guests: occ.guests,
                      openedAt: occ.openedAt,
                      version: occ.version,
                    },
                  }
                : t,
            ),
          })),
        }
      : floor,
  );
}
