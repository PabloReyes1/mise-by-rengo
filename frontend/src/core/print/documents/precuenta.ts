// Pre-cuenta (Docs/11 §4.2): NO es comprobante de pago. Detalle con precios, descuentos, total,
// propina sugerida y total con propina. El QR para cobrar sin conexión llega con H4 (Docs/09 §6.2).
// Del plan: Pablito; reasignado a Deniscito (doc 17 §3.1).
import type { PrintDocument, PrintLine } from '../layout.js';

export interface PrecuentaItem {
  quantity: number;
  name: string;
  /** Modificadores y componentes en una línea: "Término medio, Extra queso" */
  detail: string;
  /** Ya formateado: "Q190.00" */
  amount: string;
}

export interface PrecuentaInput {
  restaurant: string;
  /** "Mesa 5" o "Para llevar" */
  where: string;
  billName: string;
  /** "1 de 2" */
  billPosition: string;
  waiterName: string;
  guests: number | null;
  /** Ya formateada */
  printedAt: string;
  items: PrecuentaItem[];
  subtotal: string;
  /** null si no hay descuento */
  discount: string | null;
  total: string;
  /** null si no se sugiere propina */
  tip: { pct: string; amount: string; totalWithTip: string } | null;
  reprint: boolean;
  /** Sin conexión: se imprimió con los datos del celular */
  offline?: boolean;
  footer?: string;
}

export function precuentaDocument(p: PrecuentaInput): PrintDocument {
  const tipLines: PrintLine[] = p.tip
    ? [
        { kind: 'pair', left: `Propina sugerida (${p.tip.pct}%)`, right: p.tip.amount },
        { kind: 'pair', left: 'TOTAL CON PROPINA', right: p.tip.totalWithTip, bold: true },
        { kind: 'rule' },
        { kind: 'text', text: 'La propina es voluntaria.', align: 'center' },
      ]
    : [{ kind: 'rule' }];
  return {
    title: `Pre-cuenta ${p.where} · ${p.billName}`,
    lines: [
      { kind: 'text', text: p.restaurant.toUpperCase(), align: 'center', bold: true },
      { kind: 'rule', char: '=' },
      { kind: 'text', text: 'PRE-CUENTA', align: 'center', bold: true, size: 'tall' },
      ...(p.reprint ? [{ kind: 'text', text: 'REIMPRESIÓN', align: 'center' } as PrintLine] : []),
      ...(p.offline
        ? [{ kind: 'text', text: '(sin conexión)', align: 'center' } as PrintLine]
        : []),
      { kind: 'text', text: '*** NO ES COMPROBANTE DE PAGO ***', align: 'center', bold: true },
      { kind: 'rule' },
      { kind: 'pair', left: p.where, right: `${p.billName} (${p.billPosition})` },
      {
        kind: 'pair',
        left: `Mesero: ${p.waiterName}`,
        right: p.guests ? `Comensales: ${p.guests}` : '',
      },
      { kind: 'text', text: p.printedAt },
      { kind: 'rule' },
      ...p.items.flatMap((i): PrintLine[] => [
        { kind: 'pair', left: `${i.quantity} ${i.name}`, right: i.amount },
        ...(i.detail ? [{ kind: 'text', text: i.detail, indent: 2 } as PrintLine] : []),
      ]),
      { kind: 'rule' },
      { kind: 'pair', left: 'Subtotal', right: p.subtotal },
      ...(p.discount
        ? [{ kind: 'pair', left: 'Descuento', right: `-${p.discount}` } as PrintLine]
        : []),
      { kind: 'pair', left: 'TOTAL', right: p.total, bold: true, size: 'tall' },
      ...tipLines,
      { kind: 'text', text: p.footer ?? '¡Gracias por su visita!', align: 'center' },
      { kind: 'rule', char: '=' },
    ],
  };
}
