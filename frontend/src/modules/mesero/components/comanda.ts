// Comanda desde el mesero (Docs/11 §4.1, #14 del plan): se imprime con el diálogo del sistema al
// enviar la ronda (también sin conexión, desde el borrador) y se puede reimprimir por ronda.
import type { FloorTable, Occupancy } from '@mise/shared/contracts/floor';
import type { Order, OrderItem } from '@mise/shared/contracts/orders';
import { formatDateTime, type Regional } from '../../../core/format/index.js';
import {
  cancellationDocument,
  comandaDocument,
  type PrintDocument,
  type ComandaItem,
} from '../../../core/print/index.js';
import type { OrderDraft } from '../hooks/order-draft.js';

/** "5 + 6 · Salón" para la comanda; null en para llevar. */
export function comandaTable(occ: Occupancy, zones: { name: string; tables: FloorTable[] }[]) {
  for (const z of zones) {
    const t = z.tables.find((x) => x.id === occ.tableId);
    if (t) return `${[t.name, ...occ.mergedTables.map((m) => m.name)].join(' + ')} · ${z.name}`;
  }
  return null;
}

const fromItem = (i: OrderItem): ComandaItem => ({
  quantity: i.quantity,
  name: i.productName,
  modifiers: i.modifiers.map((m) => m.name),
  components: i.components.map((c) => ({
    name: c.name,
    modifiers: c.modifiers.map((m) => m.name),
  })),
  note: i.note,
});

interface Context {
  occupancy: Occupancy;
  table: string | null;
  regional: Regional;
  /** Imprime con la plantilla COMANDA (useTicketPrinter) */
  print: (doc: PrintDocument) => Promise<void>;
}

function common(ctx: Context) {
  return {
    table: ctx.table,
    customerName: ctx.occupancy.customerName,
    customerPhone: ctx.occupancy.customerPhone,
    waiterName: ctx.occupancy.waiterName,
    guests: ctx.occupancy.tableId ? ctx.occupancy.guests : null,
  };
}

/** Imprime la comanda de una ronda que ya está en el servidor. */
export function printOrderComanda(order: Order, ctx: Context): void {
  void ctx.print(
    comandaDocument({
      ...common(ctx),
      folio: order.folio ?? order.tempFolio ?? 'SIN FOLIO',
      tempFolio: order.folio ? order.tempFolio : null,
      roundNumber: order.roundNumber,
      sentAt: formatDateTime(order.sentAt, ctx.regional),
      items: order.items.filter((i) => i.status !== 'CANCELADO').map(fromItem),
    }),
  );
}

/** Sin conexión la ronda aún no tiene folio: se imprime desde el borrador que se envió. */
export function printDraftComanda(draft: OrderDraft, roundNumber: number, ctx: Context): void {
  void ctx.print(
    comandaDocument({
      ...common(ctx),
      folio: 'SIN CONEXIÓN',
      roundNumber,
      sentAt: formatDateTime(new Date().toISOString(), ctx.regional),
      items: draft.lines.map((l) => ({
        quantity: l.quantity,
        name: l.name,
        modifiers: l.modifiers.map((m) => m.name),
        components: (l.components ?? []).map((c) => ({
          name: c.name,
          modifiers: c.modifiers.map((m) => m.name),
        })),
        note: l.note || null,
      })),
    }),
  );
}

/** Comanda de cancelación de un ítem (Docs/11 §4.1). */
export function printCancellation(
  input: { order: Order | undefined; item: OrderItem; reason: string; cancelledBy: string },
  ctx: Context,
): void {
  void ctx.print(
    cancellationDocument({
      folio: input.order?.folio ?? input.order?.tempFolio ?? '—',
      table: ctx.table,
      cancelledAt: formatDateTime(new Date().toISOString(), ctx.regional),
      cancelledBy: input.cancelledBy,
      reason: input.reason,
      item: fromItem(input.item),
    }),
  );
}
