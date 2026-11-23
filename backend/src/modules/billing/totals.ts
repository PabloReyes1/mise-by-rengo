// Totales de las cuentas (Docs/07 §4.4 bills). Dueño: Pablito.
// Los calcula siempre el servidor: subtotal = Σ line_total de los ítems no cancelados;
// total = subtotal − descuentos + propina. Descuentos y propina llegan en H3 (cobro).
import { Prisma } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/** Recalcula subtotal y total de las cuentas indicadas (uuid de la base), en la transacción. */
export async function recomputeBills(tx: Tx, billIds: Iterable<string>): Promise<void> {
  for (const id of new Set(billIds)) {
    const sum = await tx.orderItem.aggregate({
      where: { billId: id, status: { not: 'CANCELADO' } },
      _sum: { lineTotal: true },
    });
    const bill = await tx.bill.findUniqueOrThrow({
      where: { id },
      select: { discountTotal: true, tipAmount: true },
    });
    const subtotal = sum._sum.lineTotal ?? new Prisma.Decimal(0);
    await tx.bill.update({
      where: { id },
      data: {
        subtotal,
        total: subtotal.minus(bill.discountTotal).plus(bill.tipAmount),
        version: { increment: 1 },
      },
    });
  }
}
