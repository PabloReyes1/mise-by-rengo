// PrintService (ADR-003 decisión 1): elige el transporte de la impresora, genera el formato que
// pide y reintenta 2 veces (1 s y 3 s) antes de avisar (Docs/11 §3).
// El aviso "Reintentar / Imprimir en otra / Omitir" y print_jobs llegan con los impresos de H2.
import { encodeEposPrint } from './epos-xml.js';
import { encodeEscPos } from './escpos.js';
import type { PrintDocument } from './layout.js';
import { eposLan } from './transports/epos-lan.js';
import { webUsb } from './transports/webusb.js';
import { PrintError, type PrinterConfig, type PrinterTransport, type Transport } from './types.js';

const TRANSPORTS: Record<PrinterTransport, Transport> = {
  EPOS_LAN: eposLan,
  WEBUSB: webUsb,
};

/** Esperas entre intentos (Docs/11 §3): 1 s y 3 s. */
export const RETRY_DELAYS_MS = [1_000, 3_000];

export interface PrintOptions {
  /** Para las pruebas */
  transports?: Partial<Record<PrinterTransport, Transport>>;
  sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** El documento con las opciones de la impresora (corte y cajón, Docs/11 §5 y §6). */
function forPrinter(doc: PrintDocument, printer: PrinterConfig): PrintDocument {
  return {
    ...doc,
    cut: doc.cut ?? printer.cut,
    openDrawer: Boolean(doc.openDrawer && printer.drawerKick),
  };
}

/** Imprime o lanza PrintError después de los reintentos. */
export async function printDocument(
  doc: PrintDocument,
  printer: PrinterConfig,
  options: PrintOptions = {},
): Promise<void> {
  const transport = options.transports?.[printer.transport] ?? TRANSPORTS[printer.transport];
  const sleep = options.sleep ?? wait;
  const final = forPrinter(doc, printer);
  const payload = {
    escpos: () => encodeEscPos(final, { width: printer.paperWidth, codepage: printer.codepage }),
    epos: () => encodeEposPrint(final, printer.paperWidth),
  };

  let lastError: PrintError = new PrintError('UNKNOWN');
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS_MS[attempt - 1]!);
    try {
      await transport.send(printer, payload);
      return;
    } catch (error) {
      lastError =
        error instanceof PrintError
          ? error
          : new PrintError('UNKNOWN', error instanceof Error ? error.message : undefined);
      if (!lastError.retryable) break;
    }
  }
  throw lastError;
}
