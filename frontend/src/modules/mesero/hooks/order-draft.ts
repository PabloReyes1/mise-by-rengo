// Borrador del pedido (Docs/05 pasos 3 y 4, RF-066). Dueño: Pablito.
// Lógica pura: agregar, juntar líneas iguales, cambiar cantidad, totales y armar la ronda.
// El precio de cada línea es el del menú al momento de agregarla: es el que vio el mesero y el
// que respeta el servidor (Docs/09 §6.3).
import type { SendOrderRequest } from '@mise/shared/contracts/orders';
import { lineTotal, sumMoney } from '@mise/shared/domain/billing';

export const MAX_QUANTITY = 99;

export interface DraftModifier {
  modifierId: string;
  name: string;
  priceDelta: string;
}

export interface DraftLine {
  /** Id local de la línea; al enviar se vuelve el id del ítem */
  key: string;
  productId: string;
  name: string;
  unitPrice: string;
  quantity: number;
  modifiers: DraftModifier[];
  note: string;
}

export interface OrderDraft {
  lines: DraftLine[];
}

export const EMPTY_DRAFT: OrderDraft = { lines: [] };

/** Dos líneas son "la misma" si piden lo mismo: se suman en vez de repetirse. */
function sameLine(a: Omit<DraftLine, 'key' | 'quantity'>, b: DraftLine): boolean {
  const ids = (l: { modifiers: DraftModifier[] }) =>
    l.modifiers
      .map((m) => m.modifierId)
      .sort()
      .join(',');
  return (
    a.productId === b.productId &&
    a.unitPrice === b.unitPrice &&
    a.note.trim() === b.note.trim() &&
    ids(a) === ids(b)
  );
}

export function addLine(draft: OrderDraft, line: DraftLine): OrderDraft {
  const twin = draft.lines.find((l) => sameLine(line, l));
  if (!twin) return { lines: [...draft.lines, { ...line, note: line.note.trim() }] };
  return setQuantity(draft, twin.key, twin.quantity + line.quantity);
}

export function setQuantity(draft: OrderDraft, key: string, quantity: number): OrderDraft {
  if (quantity <= 0) return removeLine(draft, key);
  return {
    lines: draft.lines.map((l) =>
      l.key === key ? { ...l, quantity: Math.min(MAX_QUANTITY, quantity) } : l,
    ),
  };
}

/** Quitar del borrador no deja registro (RF-066). */
export function removeLine(draft: OrderDraft, key: string): OrderDraft {
  return { lines: draft.lines.filter((l) => l.key !== key) };
}

export function draftLineTotal(line: DraftLine): string {
  return lineTotal(
    line.unitPrice,
    line.modifiers.map((m) => m.priceDelta),
    line.quantity,
  );
}

export function draftTotal(draft: OrderDraft): string {
  return sumMoney(draft.lines.map(draftLineTotal));
}

export function draftCount(draft: OrderDraft): number {
  return draft.lines.reduce((n, l) => n + l.quantity, 0);
}

/** Arma el cuerpo de POST /api/orders. Todas las líneas van a la cuenta elegida (RF-103). */
export function toSendOrder(
  draft: OrderDraft,
  input: { id: string; occupancyId: string; billId: string; now: Date },
): SendOrderRequest {
  return {
    id: input.id,
    occupancyId: input.occupancyId,
    clientSentAt: input.now.toISOString(),
    items: draft.lines.map((l) => ({
      id: l.key,
      billId: input.billId,
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      modifiers: l.modifiers.map(({ modifierId, priceDelta }) => ({ modifierId, priceDelta })),
      components: [],
      ...(l.note.trim() ? { note: l.note.trim() } : {}),
    })),
  };
}
