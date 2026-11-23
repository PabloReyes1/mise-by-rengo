// Documento → bytes ESC/POS con @point-of-sale/receipt-printer-encoder (Docs/11 §1 regla 2).
// Lo usan los transportes que mandan bytes crudos (webusb; después webserial, webbluetooth y qz).
import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder';
import {
  columnsFor,
  layoutRows,
  type PaperWidth,
  type PrintDocument,
  type TextSize,
} from './layout.js';

export interface EscPosOptions {
  width: PaperWidth;
  /** Página de códigos (Docs/11 §1 regla 5). Por defecto cp858: ñ, á, é, í, ó, ú, ü, ¿, ¡ */
  codepage?: string;
}

const SIZE: Record<TextSize, [number, number]> = {
  normal: [1, 1],
  tall: [1, 2],
  wide: [2, 1],
  big: [2, 2],
};

export function encodeEscPos(doc: PrintDocument, options: EscPosOptions): Uint8Array {
  const encoder = new ReceiptPrinterEncoder({
    language: 'esc-pos',
    columns: columnsFor(options.width),
    codepageMapping: 'epson',
    // El encoder translitera lo que la página de códigos no tenga (Docs/11 §1 regla 5)
    errors: 'relaxed',
  });
  encoder.initialize();
  // El tipo de la librería solo acepta sus nombres; la página viene de la configuración
  encoder.codepage((options.codepage ?? 'cp858') as Parameters<typeof encoder.codepage>[0]);
  for (const row of layoutRows(doc, options.width)) {
    const [w, h] = SIZE[row.size];
    encoder.align(row.align).bold(row.bold).size(w, h).line(row.text);
  }
  encoder.size(1, 1).bold(false).align('left');
  if (doc.openDrawer) encoder.pulse();
  // Zumbador (ESC B n t): 2 pitidos de 100 ms, en las impresoras Epson que lo traen
  if (doc.beep) encoder.raw([0x1b, 0x42, 2, 1]);
  if (doc.cut !== 'none') encoder.newline(3).cut(doc.cut === 'partial' ? 'partial' : 'full');
  return encoder.encode();
}
