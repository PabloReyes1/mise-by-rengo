// Página de prueba (Docs/11 §4.5): dispositivo, ancho y tabla de caracteres especiales, para
// revisar que la impresora elegida en el diálogo del sistema imprime bien el ticket.
import type { PaperWidth, PrintDocument } from '../layout.js';

export function testPage(input: {
  deviceName: string;
  /** Texto ya formateado con la configuración regional */
  printedAt: string;
  paperWidth: PaperWidth;
}): PrintDocument {
  return {
    title: 'Página de prueba',
    lines: [
      { kind: 'rule', char: '=' },
      { kind: 'text', text: 'PÁGINA DE PRUEBA', align: 'center', bold: true, size: 'tall' },
      { kind: 'text', text: 'Mise by Rengo', align: 'center' },
      { kind: 'rule', char: '=' },
      { kind: 'pair', left: 'Dispositivo:', right: input.deviceName },
      { kind: 'pair', left: 'Papel:', right: `${input.paperWidth} mm` },
      { kind: 'pair', left: 'Fecha:', right: input.printedAt },
      { kind: 'rule' },
      { kind: 'text', text: 'Caracteres especiales:', bold: true },
      { kind: 'text', text: 'ñ Ñ á é í ó ú Á É Í Ó Ú ü Ü ¿ ¡', indent: 2 },
      { kind: 'text', text: '¿Señor Muñoz? ¡Pingüino!', indent: 2 },
      { kind: 'pair', left: 'Monto:', right: 'Q1,234.50' },
      { kind: 'rule' },
      { kind: 'text', text: 'Normal' },
      { kind: 'text', text: 'Negrita', bold: true },
      { kind: 'text', text: 'Grande', size: 'tall' },
      { kind: 'rule' },
      {
        kind: 'text',
        text: `Esta línea es larga a propósito para revisar que el texto se parte en ${input.paperWidth === 80 ? 48 : 32} columnas sin cortar palabras.`,
      },
      { kind: 'rule', char: '=' },
      { kind: 'text', text: 'Si lees todo bien, la impresora está lista.', align: 'center' },
    ],
  };
}
