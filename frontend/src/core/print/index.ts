// core/print: impresión desde el navegador (Docs/11, ADR-003). Dueño: Deniscito.
// Los impresos de cada módulo se arman con PrintDocument en documents/ (comanda: Deniscito;
// pre-cuenta, recibo, corte y movimientos: Pablito) y se imprimen con printDocument.
export { testPage } from './documents/test-page.js';
export { encodeEposPrint, eposEnvelope } from './epos-xml.js';
export { encodeEscPos } from './escpos.js';
export {
  columnsFor,
  layoutRows,
  renderText,
  wrap,
  type Align,
  type PaperWidth,
  type PrintDocument,
  type PrintLine,
  type PrintRow,
  type TextSize,
} from './layout.js';
export { printDocument, RETRY_DELAYS_MS } from './print-service.js';
export { printerStore, usePrinters } from './printers.js';
export { chooseUsbPrinter, isWebUsbSupported } from './transports/webusb.js';
export {
  PrintError,
  type PrinterConfig,
  type PrinterTransport,
  type PrintErrorCode,
} from './types.js';
