// Impresora y errores de impresión (Docs/07 `printers`, Docs/11 §3).
import type { PaperWidth } from './layout.js';

/** Transportes de H1. webserial, webbluetooth, qz y delegate llegan después (doc 17 §5). */
export type PrinterTransport = 'EPOS_LAN' | 'WEBUSB';

/** Misma forma que `printers` de Docs/07 §4 (hasta H3 se guarda solo en el dispositivo, SC-43). */
export interface PrinterConfig {
  id: string;
  name: string;
  transport: PrinterTransport;
  /**
   * EPOS_LAN: IP o nombre de la impresora ("192.168.1.50").
   * WEBUSB: "vendorId:productId" en hexadecimal ("04b8:0e28").
   */
  address: string;
  paperWidth: PaperWidth;
  codepage: string;
  cut: 'full' | 'partial' | 'none';
  drawerKick: boolean;
}

export type PrintErrorCode =
  | 'NOT_SUPPORTED'
  | 'PERMISSION'
  | 'UNREACHABLE'
  | 'PAPER_OUT'
  | 'COVER_OPEN'
  | 'OFFLINE'
  | 'UNKNOWN';

const MESSAGES: Record<PrintErrorCode, string> = {
  NOT_SUPPORTED: 'Este navegador no puede usar esa impresora.',
  PERMISSION: 'Falta dar permiso para usar la impresora.',
  UNREACHABLE:
    'No se encontró la impresora en la red. Revisa la IP, que esté encendida y que su certificado esté aceptado en este dispositivo.',
  PAPER_OUT: 'La impresora no tiene papel.',
  COVER_OPEN: 'La tapa de la impresora está abierta.',
  OFFLINE: 'La impresora no responde.',
  UNKNOWN: 'La impresora devolvió un error.',
};

export class PrintError extends Error {
  readonly code: PrintErrorCode;
  /** Los de configuración no mejoran reintentando */
  readonly retryable: boolean;

  constructor(code: PrintErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]} (${detail})` : MESSAGES[code]);
    this.name = 'PrintError';
    this.code = code;
    this.retryable = code !== 'NOT_SUPPORTED' && code !== 'PERMISSION';
  }
}

/** Un transporte entrega bytes o XML a la impresora, o lanza PrintError. */
export interface Transport {
  send(
    printer: PrinterConfig,
    payload: { escpos: () => Uint8Array; epos: () => string },
  ): Promise<void>;
}
