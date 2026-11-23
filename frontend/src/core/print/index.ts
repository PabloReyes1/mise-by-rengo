// core/print: impresión desde el navegador (Docs/11, ADR-003). Dueño: Deniscito.
// Los impresos de cada módulo se arman con PrintDocument en documents/ (comanda: Deniscito;
// pre-cuenta, recibo, corte y movimientos: Pablito) y se imprimen con printWithDialog: se abre
// el diálogo del sistema y se elige cualquier impresora (RENGO, 2026-11-23).
// En reserva (no se usan hoy, con sus pruebas): ESC/POS, XML ePOS y los transportes directos
// epos-lan y webusb, por si después hace falta que la comanda salga sola sin tocar "Imprimir".
export { printWithDialog, ticketHtml } from './browser-print.js';
export {
  cancellationDocument,
  comandaDocument,
  type CancellationInput,
  type ComandaInput,
  type ComandaItem,
} from './documents/comanda.js';
export {
  precuentaDocument,
  type PrecuentaInput,
  type PrecuentaItem,
} from './documents/precuenta.js';
export { testPage } from './documents/test-page.js';
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
