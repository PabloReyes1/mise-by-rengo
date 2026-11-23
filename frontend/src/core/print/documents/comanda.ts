// Comanda de cocina (Docs/11 §4.1): normal, "ADICIONAL" en rondas ≥ 2, para llevar y de
// cancelación. Sin precios. Cantidades y nombres en grande; modificadores sangrados; notas
// resaltadas; componentes del combo. Dueño: Deniscito.
import type { PrintDocument, PrintLine } from '../layout.js';

export interface ComandaItem {
  quantity: number;
  name: string;
  modifiers: string[];
  /** Componentes del combo, con sus modificadores */
  components: { name: string; modifiers: string[] }[];
  note: string | null;
}

export interface ComandaInput {
  /** Folio definitivo o, sin conexión, el temporal */
  folio: string;
  /** Folio temporal además del definitivo, si lo tuvo: "(M3-0005)" */
  tempFolio?: string | null;
  roundNumber: number;
  /** "Mesa 5 · Salón"; null en para llevar */
  table: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  waiterName: string;
  guests: number | null;
  /** Ya formateado con la configuración regional */
  sentAt: string;
  items: ComandaItem[];
}

const head = (title: string, extra?: PrintLine): PrintLine[] => [
  { kind: 'rule', char: '=' },
  { kind: 'text', text: title, align: 'center', bold: true, size: 'tall' },
  ...(extra ? [extra] : []),
  { kind: 'rule', char: '=' },
];

function itemLines(item: ComandaItem, sign = ''): PrintLine[] {
  return [
    {
      kind: 'text',
      text: `${sign}${item.quantity} ${item.name.toUpperCase()}`,
      bold: true,
      size: 'tall',
    },
    ...item.modifiers.map((m): PrintLine => ({ kind: 'text', text: `> ${m}`, indent: 5 })),
    ...item.components.flatMap((c): PrintLine[] => [
      { kind: 'text', text: `- ${c.name}`, indent: 5 },
      ...c.modifiers.map((m): PrintLine => ({ kind: 'text', text: `> ${m}`, indent: 7 })),
    ]),
    ...(item.note
      ? [{ kind: 'text', text: `*** NOTA: ${item.note} ***`, indent: 5, bold: true } as PrintLine]
      : []),
  ];
}

/** Comanda de una ronda. */
export function comandaDocument(c: ComandaInput): PrintDocument {
  const additional = c.roundNumber >= 2;
  const header: PrintLine[] = c.table
    ? head(
        '** COMANDA **',
        additional ? { kind: 'text', text: 'ADICIONAL', align: 'center', bold: true } : undefined,
      )
    : head('** COMANDA **', {
        kind: 'text',
        text: '>>>>>  PARA LLEVAR  <<<<<',
        align: 'center',
        bold: true,
      });
  const count = c.items.reduce((n, i) => n + i.quantity, 0);
  return {
    title: `Comanda ${c.folio}`,
    beep: true,
    lines: [
      ...header,
      { kind: 'pair', left: `ORDEN: ${c.folio}`, right: c.tempFolio ? `(${c.tempFolio})` : '' },
      ...(c.table
        ? [
            {
              kind: 'pair',
              left: `MESA: ${c.table}`,
              right: c.guests ? `Comensales: ${c.guests}` : '',
              bold: true,
            } as PrintLine,
          ]
        : [
            {
              kind: 'text',
              text:
                [
                  c.customerName && `Cliente: ${c.customerName}`,
                  c.customerPhone && `Tel: ${c.customerPhone}`,
                ]
                  .filter(Boolean)
                  .join('   ') || 'Cliente: —',
            } as PrintLine,
          ]),
      { kind: 'text', text: `Mesero: ${c.waiterName}` },
      { kind: 'pair', left: `Enviado: ${c.sentAt}`, right: `Ronda: ${c.roundNumber}` },
      { kind: 'rule' },
      ...c.items.flatMap((i) => itemLines(i)),
      { kind: 'rule' },
      { kind: 'text', text: `Ítems: ${count}` },
      { kind: 'rule', char: '=' },
    ],
  };
}

export interface CancellationInput {
  folio: string;
  table: string | null;
  /** Ya formateada */
  cancelledAt: string;
  cancelledBy: string;
  authorizedBy?: string | null;
  reason: string;
  item: ComandaItem;
}

/** Comanda de cancelación de un ítem ya enviado (Docs/11 §4.1). */
export function cancellationDocument(c: CancellationInput): PrintDocument {
  return {
    title: `Cancelación ${c.folio}`,
    beep: true,
    lines: [
      ...head('!!!  CANCELACIÓN  !!!'),
      {
        kind: 'pair',
        left: `ORDEN: ${c.folio}`,
        right: c.table ? `MESA: ${c.table}` : 'PARA LLEVAR',
        bold: true,
      },
      { kind: 'text', text: `Cancelado: ${c.cancelledAt} por ${c.cancelledBy}` },
      ...(c.authorizedBy
        ? [{ kind: 'text', text: `Autorizó: ${c.authorizedBy}` } as PrintLine]
        : []),
      { kind: 'text', text: `Motivo: ${c.reason}` },
      { kind: 'rule' },
      ...itemLines(c.item, '-'),
      { kind: 'rule', char: '=' },
    ],
  };
}
