// Corte de caja (Docs/11 §4.4): ventas por método, efectivo (fondo, cobros, depósitos, retiros,
// reversos por reapertura), esperado, contado, diferencia, conteo y firmas. Del plan: Pablito;
// reasignado a Deniscito (doc 17 §3.1, H3 #20).
import type { PrintDocument, PrintLine } from '../layout.js';

export interface CorteInput {
  restaurant: string;
  register: string;
  openedBy: string;
  openedAt: string;
  closedBy: string;
  closedAt: string;
  /** Montos ya formateados */
  salesByMethod: { method: string; count: number; amount: string }[];
  totalCollected: string;
  tips: string;
  openingFloat: string;
  cashSales: string;
  deposits: { count: number; amount: string };
  withdrawals: { count: number; amount: string };
  reversals: { count: number; amount: string };
  expected: string;
  counted: string;
  difference: string;
  comment: string | null;
  counts: { denomination: string; quantity: number; amount: string }[];
  billsPaid: number;
  discounts: string;
  netSales: string;
  reprint: boolean;
}

export function corteDocument(c: CorteInput): PrintDocument {
  return {
    title: `Corte ${c.register}`,
    lines: [
      { kind: 'rule', char: '=' },
      { kind: 'text', text: 'CORTE DE CAJA', align: 'center', bold: true, size: 'tall' },
      { kind: 'text', text: c.restaurant.toUpperCase(), align: 'center' },
      ...(c.reprint ? [{ kind: 'text', text: 'REIMPRESIÓN', align: 'center' } as PrintLine] : []),
      { kind: 'rule', char: '=' },
      { kind: 'text', text: `Caja: ${c.register}` },
      { kind: 'pair', left: `Abrió: ${c.openedBy}`, right: c.openedAt },
      { kind: 'pair', left: `Cerró: ${c.closedBy}`, right: c.closedAt },
      { kind: 'rule' },
      { kind: 'text', text: 'VENTAS POR MÉTODO', bold: true },
      ...c.salesByMethod.map((m): PrintLine => ({
        kind: 'pair',
        left: `${m.method} (${m.count})`,
        right: m.amount,
      })),
      { kind: 'pair', left: 'Total cobrado', right: c.totalCollected, bold: true },
      { kind: 'pair', left: '  de lo cual propinas', right: c.tips },
      { kind: 'rule' },
      { kind: 'text', text: 'EFECTIVO', bold: true },
      { kind: 'pair', left: 'Fondo inicial', right: c.openingFloat },
      { kind: 'pair', left: '+ Cobros en efectivo', right: c.cashSales },
      { kind: 'pair', left: `+ Depósitos (${c.deposits.count})`, right: c.deposits.amount },
      { kind: 'pair', left: `- Retiros (${c.withdrawals.count})`, right: c.withdrawals.amount },
      {
        kind: 'pair',
        left: `- Reversos por reapertura (${c.reversals.count})`,
        right: c.reversals.amount,
      },
      { kind: 'pair', left: '= Efectivo esperado', right: c.expected, bold: true },
      { kind: 'pair', left: '  Efectivo contado', right: c.counted },
      { kind: 'pair', left: '  DIFERENCIA', right: c.difference, bold: true },
      ...(c.comment ? [{ kind: 'text', text: `Comentario: ${c.comment}` } as PrintLine] : []),
      ...(c.counts.length
        ? [
            { kind: 'rule' } as PrintLine,
            { kind: 'text', text: 'CONTEO', bold: true } as PrintLine,
            ...c.counts.map((n): PrintLine => ({
              kind: 'pair',
              left: `${n.denomination} × ${n.quantity}`,
              right: n.amount,
            })),
          ]
        : []),
      { kind: 'rule' },
      { kind: 'pair', left: 'Cuentas pagadas', right: String(c.billsPaid) },
      { kind: 'pair', left: 'Descuentos', right: c.discounts },
      { kind: 'pair', left: 'Ventas netas (sin propina)', right: c.netSales },
      { kind: 'rule' },
      { kind: 'feed', lines: 2 },
      { kind: 'pair', left: '______________', right: '______________' },
      { kind: 'pair', left: '  Cajero', right: 'Gerente  ' },
      { kind: 'rule', char: '=' },
    ],
  };
}
