// Totales de las cuentas (Docs/05 §4, Docs/07 §4.4 bills). Dueño: Pablito; descuentos de H3 #19
// reasignados a Deniscito (doc 17 §3.1). Los calcula siempre el servidor:
//   subtotal = Σ line_total de los ítems no cancelados
//   descuento de ítem = % × línea o monto fijo (≤ línea)
//   descuento de cuenta = % × (subtotal − descuentos de ítem) o monto fijo (≤ eso)
//   discount_total = descuentos de ítem + descuento de cuenta
//   total = subtotal − discount_total + propina
// Redondeo half-up a 2 decimales en cada descuento (Docs/05 §4 regla 9).
import { Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;
const D = Prisma.Decimal;

/** Monto de un descuento sobre una base, nunca mayor que la base. */
export function discountAmount(kind: string, value: Prisma.Decimal, base: Prisma.Decimal) {
  const raw = kind === 'PCT' ? base.times(value).dividedBy(100) : value;
  const amount = raw.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return amount.gt(base) ? base : amount;
}

/** Recalcula subtotal, descuentos y total de las cuentas indicadas (uuid de la base). */
export async function recomputeBills(tx: Tx, billIds: Iterable<string>): Promise<void> {
  for (const id of new Set(billIds)) {
    const items = await tx.orderItem.findMany({
      where: { billId: id, status: { not: 'CANCELADO' } },
      select: { id: true, lineTotal: true },
    });
    const subtotal = items.reduce((t, i) => t.plus(i.lineTotal), new D(0));
    const lineOf = new Map(items.map((i) => [i.id, i.lineTotal]));

    // Descuentos de ítem (los de ítems cancelados o movidos a otra cuenta no cuentan aquí)
    const itemDiscounts = await tx.appliedDiscount.findMany({
      where: { orderItemId: { in: items.map((i) => i.id) } },
    });
    let itemTotal = new D(0);
    for (const d of itemDiscounts) {
      const amount = discountAmount(d.kind, d.value, lineOf.get(d.orderItemId!)!);
      if (!amount.eq(d.amount))
        await tx.appliedDiscount.update({ where: { id: d.id }, data: { amount } });
      itemTotal = itemTotal.plus(amount);
    }
    // Descuento de cuenta sobre lo que queda
    let billTotal = new D(0);
    for (const d of await tx.appliedDiscount.findMany({ where: { billId: id } })) {
      const amount = discountAmount(d.kind, d.value, subtotal.minus(itemTotal).minus(billTotal));
      if (!amount.eq(d.amount))
        await tx.appliedDiscount.update({ where: { id: d.id }, data: { amount } });
      billTotal = billTotal.plus(amount);
    }
    const discountTotal = itemTotal.plus(billTotal);
    const bill = await tx.bill.findUniqueOrThrow({ where: { id }, select: { tipAmount: true } });
    await tx.bill.update({
      where: { id },
      data: {
        subtotal,
        discountTotal,
        total: subtotal.minus(discountTotal).plus(bill.tipAmount),
        version: { increment: 1 },
      },
    });
  }
}
