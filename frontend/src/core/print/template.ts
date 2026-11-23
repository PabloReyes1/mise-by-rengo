// Plantilla de cada impreso (Docs/11, client ticket_templates; H3 #21): encabezado, pie, logo y
// ancho del papel los configura el restaurante en Configuración › Tickets. Nada fijo en el código.
import type { PaperWidth, PrintDocument, PrintLine } from './layout.js';

export interface TicketStyle {
  /** Varias líneas, separadas por salto de línea (dirección, NIT, teléfono…) */
  header: string;
  footer: string;
  showLogo: boolean;
  paperWidth: PaperWidth;
}

/** Sin plantilla (todavía no carga o sin conexión la primera vez): sin encabezado ni pie, 80 mm. */
export const PLAIN_TICKET: TicketStyle = {
  header: '',
  footer: '',
  showLogo: false,
  paperWidth: 80,
};

const centered = (text: string): PrintLine[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => ({ kind: 'text', text: l, align: 'center' }));

/**
 * El encabezado va arriba de todo; el pie, antes de la última raya del documento (o al final).
 * El logo solo sale en la impresión con el diálogo del sistema.
 */
export function withTemplate(
  doc: PrintDocument,
  style: TicketStyle,
  logoUrl: string | null,
): PrintDocument {
  const header = centered(style.header);
  const footer = centered(style.footer);
  const last = doc.lines.at(-1);
  const body =
    last?.kind === 'rule' && footer.length > 0
      ? [...doc.lines.slice(0, -1), ...footer, last]
      : [...doc.lines, ...footer];
  return {
    ...doc,
    lines: [...header, ...body],
    ...(style.showLogo && logoUrl ? { logoUrl } : {}),
  };
}
