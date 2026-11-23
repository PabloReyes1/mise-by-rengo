// Comprobante de retiro o depósito de efectivo (Docs/11 §4.5): tipo, monto, motivo, usuario,
// autorizador, hora y firmas. Se imprime al registrarlo en Caja y se puede reimprimir. Dueño: Pablito.
import type { PrintDocument, PrintLine } from '../layout.js';

export interface MovimientoInput {
  restaurant: string;
  register: string;
  type: 'RETIRO' | 'DEPOSITO';
  /** Montos y fecha ya formateados */
  amount: string;
  at: string;
  reason: string | null;
  note: string | null;
  user: string;
  /** Quien autorizó con 🔑, si hizo falta */
  authorizedBy: string | null;
  reprint: boolean;
}

export function movimientoDocument(m: MovimientoInput): PrintDocument {
  const label = m.type === 'RETIRO' ? 'RETIRO DE EFECTIVO' : 'DEPÓSITO DE EFECTIVO';
  const optional = (text: string | null, prefix: string): PrintLine[] =>
    text ? [{ kind: 'text', text: `${prefix}${text}` }] : [];
  return {
    title: m.type === 'RETIRO' ? 'Retiro de efectivo' : 'Depósito de efectivo',
    lines: [
      { kind: 'text', text: m.restaurant.toUpperCase(), align: 'center', bold: true },
      { kind: 'rule', char: '=' },
      { kind: 'text', text: label, align: 'center', bold: true, size: 'tall' },
      ...(m.reprint ? [{ kind: 'text', text: 'REIMPRESIÓN', align: 'center' } as PrintLine] : []),
      { kind: 'rule' },
      { kind: 'pair', left: `Caja: ${m.register}`, right: m.at },
      { kind: 'rule', char: '=' },
      { kind: 'pair', left: 'MONTO', right: m.amount, bold: true, size: 'tall' },
      { kind: 'rule', char: '=' },
      ...optional(m.reason, 'Motivo: '),
      ...optional(m.note, 'Nota: '),
      { kind: 'text', text: `Registró: ${m.user}` },
      ...optional(m.authorizedBy, 'Autorizó: '),
      { kind: 'feed', lines: 2 },
      { kind: 'pair', left: '______________', right: '______________' },
      { kind: 'pair', left: '  Entrega', right: 'Recibe  ' },
      { kind: 'rule', char: '=' },
    ],
  };
}
