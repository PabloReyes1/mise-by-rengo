// Página de prueba (Docs/11 §4.5): dispositivo, impresora, transporte, ancho y tabla de caracteres
// especiales, para revisar la instalación y la página de códigos.
import type { PrintDocument } from '../layout.js';
import type { PrinterConfig } from '../types.js';

const TRANSPORT_LABEL: Record<PrinterConfig['transport'], string> = {
  EPOS_LAN: 'Epson ePOS por red (epos-lan)',
  WEBUSB: 'USB (webusb)',
};

export function testPage(input: {
  printer: PrinterConfig;
  deviceName: string;
  /** Texto ya formateado con la configuración regional */
  printedAt: string;
}): PrintDocument {
  const { printer } = input;
  return {
    title: 'Página de prueba',
    cut: printer.cut,
    lines: [
      { kind: 'rule', char: '=' },
      { kind: 'text', text: 'PÁGINA DE PRUEBA', align: 'center', bold: true, size: 'tall' },
      { kind: 'text', text: 'Mise by Rengo', align: 'center' },
      { kind: 'rule', char: '=' },
      { kind: 'pair', left: 'Dispositivo:', right: input.deviceName },
      { kind: 'pair', left: 'Impresora:', right: printer.name },
      { kind: 'text', text: `Transporte: ${TRANSPORT_LABEL[printer.transport]}` },
      { kind: 'pair', left: 'Dirección:', right: printer.address },
      { kind: 'pair', left: 'Papel:', right: `${printer.paperWidth} mm` },
      { kind: 'pair', left: 'Página de códigos:', right: printer.codepage },
      { kind: 'pair', left: 'Fecha:', right: input.printedAt },
      { kind: 'rule' },
      { kind: 'text', text: 'Caracteres especiales:', bold: true },
      { kind: 'text', text: 'ñ Ñ á é í ó ú Á É Í Ó Ú ü Ü ¿ ¡', indent: 2 },
      { kind: 'text', text: '¿Señor Muñoz? ¡Pingüino!', indent: 2 },
      { kind: 'pair', left: 'Monto:', right: 'Q1,234.50' },
      { kind: 'rule' },
      { kind: 'text', text: 'Tamaños:', bold: true },
      { kind: 'text', text: 'Normal' },
      { kind: 'text', text: 'Negrita', bold: true },
      { kind: 'text', text: 'Doble alto', size: 'tall' },
      { kind: 'text', text: 'Doble', size: 'big' },
      { kind: 'rule' },
      {
        kind: 'text',
        text: `Esta línea es larga a propósito para revisar que el texto se parte en ${printer.paperWidth === 80 ? 48 : 32} columnas sin cortar palabras.`,
      },
      { kind: 'rule', char: '=' },
      { kind: 'text', text: 'Si lees todo bien, la impresora está lista.', align: 'center' },
    ],
  };
}
