// Documento de impresión independiente del transporte (Docs/11 §2 y §4).
// Los impresos (comanda, pre-cuenta, recibo, corte, página de prueba) se describen con
// PrintDocument; `layoutRows` los acomoda al ancho del papel y los renderizadores (ESC/POS, ePOS XML
// y la vista previa en texto) solo traducen cada fila. Así el papel sale igual por cualquier ruta.

export type PaperWidth = 58 | 80;
export type Align = 'left' | 'center' | 'right';
/** normal · tall = doble alto (comanda) · wide = doble ancho · big = doble alto y ancho */
export type TextSize = 'normal' | 'tall' | 'wide' | 'big';

export type PrintLine =
  | {
      kind: 'text';
      text: string;
      align?: Align;
      bold?: boolean;
      size?: TextSize;
      /** Sangría en columnas; las líneas que se parten la conservan (Docs/11 §2) */
      indent?: number;
    }
  /** Texto a la izquierda y monto a la derecha ("Subtotal ........ Q285.00") */
  | { kind: 'pair'; left: string; right: string; bold?: boolean; size?: TextSize }
  /** Línea de lado a lado: '-' o '=' */
  | { kind: 'rule'; char?: '-' | '=' }
  | { kind: 'feed'; lines?: number };

export interface PrintDocument {
  /** Nombre para el aviso de error y la bitácora: "Comanda C-000131", "Página de prueba" */
  title: string;
  lines: PrintLine[];
  cut?: 'full' | 'partial' | 'none';
  /** Zumbador de la impresora (comanda, Docs/11 §6 `beep`) */
  beep?: boolean;
  /** Pulso al cajón de dinero (Docs/11 §5) */
  openDrawer?: boolean;
}

/** Fila lista para imprimir: el texto ya cabe en el ancho de su tamaño de letra. */
export interface PrintRow {
  text: string;
  align: Align;
  bold: boolean;
  size: TextSize;
}

/** Columnas con la fuente A (Docs/11 §2): 48 en 80 mm, 32 en 58 mm. */
export function columnsFor(width: PaperWidth): number {
  return width === 80 ? 48 : 32;
}

/** Las letras de doble ancho ocupan dos columnas. */
function columnsAt(size: TextSize, columns: number): number {
  return size === 'wide' || size === 'big' ? Math.floor(columns / 2) : columns;
}

/** Parte un texto en líneas de `width` columnas sin cortar palabras (salvo las que no caben). */
export function wrap(text: string, width: number, indent = 0): string[] {
  const out: string[] = [];
  const pad = ' '.repeat(indent);
  const room = Math.max(1, width - indent);
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word;
      while (rest.length > room) {
        if (line) {
          out.push(pad + line);
          line = '';
        }
        out.push(pad + rest.slice(0, room));
        rest = rest.slice(room);
      }
      if (!line) line = rest;
      else if (line.length + 1 + rest.length <= room) line += ` ${rest}`;
      else {
        out.push(pad + line);
        line = rest;
      }
    }
    out.push(pad + line);
  }
  return out;
}

/** Texto a la izquierda y valor a la derecha en una fila; si no caben, el texto se parte arriba. */
function pairRows(left: string, right: string, width: number): string[] {
  const room = width - right.length - 1;
  if (room < 1) return [...wrap(left, width), right.padStart(width)];
  const lines = wrap(left, room);
  const last = lines.pop() ?? '';
  return [...lines, last.padEnd(room) + ' ' + right];
}

/** Acomoda el documento al papel: parte textos largos y arma pares y reglas. */
export function layoutRows(doc: PrintDocument, width: PaperWidth): PrintRow[] {
  const columns = columnsFor(width);
  const rows: PrintRow[] = [];
  for (const line of doc.lines) {
    switch (line.kind) {
      case 'text': {
        const size = line.size ?? 'normal';
        for (const text of wrap(line.text, columnsAt(size, columns), line.indent ?? 0)) {
          rows.push({ text, align: line.align ?? 'left', bold: line.bold ?? false, size });
        }
        break;
      }
      case 'pair': {
        const size = line.size ?? 'normal';
        for (const text of pairRows(line.left, line.right, columnsAt(size, columns))) {
          rows.push({ text, align: 'left', bold: line.bold ?? false, size });
        }
        break;
      }
      case 'rule':
        rows.push({
          text: (line.char ?? '-').repeat(columns),
          align: 'left',
          bold: false,
          size: 'normal',
        });
        break;
      case 'feed':
        for (let i = 0; i < (line.lines ?? 1); i++)
          rows.push({ text: '', align: 'left', bold: false, size: 'normal' });
        break;
    }
  }
  return rows;
}

/**
 * Vista previa en texto, como en los ejemplos de Docs/11 §4 (alineación aplicada; el doble ancho
 * se muestra con letras separadas). Sirve para la pantalla y para las pruebas.
 */
export function renderText(doc: PrintDocument, width: PaperWidth): string {
  const columns = columnsFor(width);
  return layoutRows(doc, width)
    .map((row) => {
      const wide = row.size === 'wide' || row.size === 'big';
      const text = wide ? row.text.split('').join(' ') : row.text;
      const free = Math.max(0, columns - text.length);
      if (row.align === 'center') return (' '.repeat(Math.floor(free / 2)) + text).trimEnd();
      if (row.align === 'right') return ' '.repeat(free) + text;
      return text.trimEnd();
    })
    .join('\n');
}
