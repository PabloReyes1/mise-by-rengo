// Recibo (Docs/11 §4.3): no es factura (no hay FEL ni IVA por ahora, PA-002). Folio, mesa, cajero,
// ítems, descuentos, propina, total pagado, pagos con referencia, efectivo recibido y cambio,
// NIT/CF. Reimpresión marcada. Del plan: Pablito; reasignado a Deniscito (doc 17 §3.1, H3 #19).
import type { PrintDocument, PrintLine } from '../layout.js';

export interface ReciboInput {
  restaurant: string;
  legalLine?: string | null;
  folio: string;
  /** Ya formateada */
  paidAt: string;
  /** "Mesa 5 · Cuenta 1" o "Para llevar" */
  where: string;
  cashier: string;
  waiter: string;
  customer: string;
  items: { quantity: number; name: string; amount: string }[];
  subtotal: string;
  discount: string | null;
  tip: string | null;
  total: string;
  payments: { label: string; amount: string }[];
  /** Efectivo recibido y cambio, si hubo efectivo */
  cash: { tendered: string; change: string } | null;
  reprint: boolean;
  legend: string;
  footer?: string;
}

export function reciboDocument(r: ReciboInput): PrintDocument {
  return {
    title: `Recibo ${r.folio}`,
    lines: [
      { kind: 'text', text: r.restaurant.toUpperCase(), align: 'center', bold: true },
      ...(r.legalLine ? [{ kind: 'text', text: r.legalLine, align: 'center' } as PrintLine] : []),
      { kind: 'rule', char: '=' },
      { kind: 'text', text: 'RECIBO', align: 'center', bold: true, size: 'tall' },
      ...(r.reprint ? [{ kind: 'text', text: 'REIMPRESIÓN', align: 'center' } as PrintLine] : []),
      { kind: 'rule' },
      { kind: 'pair', left: `Recibo: ${r.folio}`, right: r.paidAt },
      { kind: 'text', text: r.where },
      { kind: 'pair', left: `Cajero: ${r.cashier}`, right: `Mesero: ${r.waiter}` },
      { kind: 'text', text: `Cliente: ${r.customer}` },
      { kind: 'rule' },
      ...r.items.map((i): PrintLine => ({
        kind: 'pair',
        left: `${i.quantity} ${i.name}`,
        right: i.amount,
      })),
      { kind: 'rule' },
      { kind: 'pair', left: 'Subtotal', right: r.subtotal },
      ...(r.discount
        ? [{ kind: 'pair', left: 'Descuento', right: `-${r.discount}` } as PrintLine]
        : []),
      ...(r.tip ? [{ kind: 'pair', left: 'Propina', right: r.tip } as PrintLine] : []),
      { kind: 'rule', char: '=' },
      { kind: 'pair', left: 'TOTAL PAGADO', right: r.total, bold: true, size: 'tall' },
      { kind: 'rule', char: '=' },
      ...r.payments.map((p): PrintLine => ({ kind: 'pair', left: p.label, right: p.amount })),
      ...(r.cash
        ? [
            { kind: 'pair', left: 'Efectivo recibido', right: r.cash.tendered } as PrintLine,
            { kind: 'pair', left: 'Cambio', right: r.cash.change } as PrintLine,
          ]
        : []),
      { kind: 'rule' },
      { kind: 'text', text: 'Precios incluyen impuestos.', align: 'center' },
      { kind: 'text', text: r.legend, align: 'center' },
      ...(r.footer ? [{ kind: 'text', text: r.footer, align: 'center' } as PrintLine] : []),
      { kind: 'rule', char: '=' },
    ],
  };
}
