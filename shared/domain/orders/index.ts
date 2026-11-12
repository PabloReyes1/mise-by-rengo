// Estados del pedido (ronda) y del ítem, y las transiciones permitidas (doc 05 §5.3 y §5.4).
// Los valores son los de la columna status de orders y order_items (doc 07).

export const ORDER_STATUSES = [
  'ENVIADO',
  'EN_PREPARACION',
  'LISTO',
  'ENTREGADO',
  'CANCELADO',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Estados del ítem que se guardan en la base. */
export const PERSISTED_ITEM_STATUSES = ORDER_STATUSES;

/** BORRADOR vive solo en el dispositivo (IndexedDB); al quitarlo no queda registro (RF-066). */
export const ITEM_STATUSES = ['BORRADOR', ...PERSISTED_ITEM_STATUSES] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  ENVIADO: ['EN_PREPARACION', 'CANCELADO'], // cocina acepta / cancelar todos los ítems
  EN_PREPARACION: ['LISTO', 'CANCELADO'], // todos los ítems listos / cancelar todos los ítems
  LISTO: ['EN_PREPARACION', 'ENTREGADO'], // recall (permiso) / mesero entrega
  ENTREGADO: [],
  CANCELADO: [],
};

const ITEM_TRANSITIONS: Record<ItemStatus, readonly ItemStatus[]> = {
  BORRADOR: ['ENVIADO'],
  ENVIADO: ['EN_PREPARACION', 'CANCELADO'],
  EN_PREPARACION: ['LISTO', 'CANCELADO'],
  LISTO: ['ENTREGADO', 'CANCELADO'], // cancelar = merma
  ENTREGADO: ['CANCELADO'], // merma
  CANCELADO: [],
};

export function canOrderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function canItemTransition(from: ItemStatus, to: ItemStatus): boolean {
  return ITEM_TRANSITIONS[from].includes(to);
}

export function isFinalOrderStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status].length === 0;
}
