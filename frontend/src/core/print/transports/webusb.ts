// Transporte webusb: ESC/POS por cable USB (ADR-003 opción A). Android con Chrome; en Windows
// necesita el driver WinUSB (Zadig). Safari (iPhone/iPad) no tiene WebUSB.
// Pendiente de validar con la impresora real (R-01, PA-021).
import { PrintError, type Transport } from '../types.js';

// Tipos mínimos de WebUSB (no vienen en la librería DOM de TypeScript)
interface UsbEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
}
interface UsbInterface {
  interfaceNumber: number;
  alternate: { endpoints: UsbEndpoint[] };
}
export interface UsbDeviceLike {
  vendorId: number;
  productId: number;
  productName?: string | undefined;
  opened: boolean;
  configuration: { interfaces: UsbInterface[] } | null;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(value: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: Uint8Array): Promise<{ status: string }>;
}
interface UsbLike {
  getDevices(): Promise<UsbDeviceLike[]>;
  requestDevice(options: { filters: { classCode?: number }[] }): Promise<UsbDeviceLike>;
}

function usb(): UsbLike | null {
  const nav = typeof navigator === 'undefined' ? null : (navigator as { usb?: UsbLike });
  return nav?.usb ?? null;
}

export function isWebUsbSupported(): boolean {
  return usb() !== null;
}

const hex = (n: number) => n.toString(16).padStart(4, '0');

/** "04b8:0e28" a partir del dispositivo. */
export function usbAddress(device: { vendorId: number; productId: number }): string {
  return `${hex(device.vendorId)}:${hex(device.productId)}`;
}

/**
 * Pide al usuario que elija la impresora USB (necesita un toque: el navegador lo exige) y devuelve
 * su dirección para guardarla en la configuración. 7 = clase de impresora USB.
 */
export async function chooseUsbPrinter(): Promise<{ address: string; name: string }> {
  const api = usb();
  if (!api) throw new PrintError('NOT_SUPPORTED');
  try {
    const device = await api.requestDevice({ filters: [{ classCode: 7 }, {}] });
    return { address: usbAddress(device), name: device.productName ?? 'Impresora USB' };
  } catch {
    throw new PrintError('PERMISSION');
  }
}

/** Primera interfaz con una salida bulk: por ahí van los bytes ESC/POS. */
function bulkOut(
  device: UsbDeviceLike,
): { interfaceNumber: number; endpointNumber: number } | null {
  for (const iface of device.configuration?.interfaces ?? []) {
    const out = iface.alternate.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
    if (out) return { interfaceNumber: iface.interfaceNumber, endpointNumber: out.endpointNumber };
  }
  return null;
}

export const webUsb: Transport = {
  async send(printer, payload) {
    const api = usb();
    if (!api) throw new PrintError('NOT_SUPPORTED');
    // Solo dispositivos a los que el usuario ya dio permiso (chooseUsbPrinter)
    const device = (await api.getDevices()).find(
      (d) => usbAddress(d) === printer.address.toLowerCase(),
    );
    if (!device) throw new PrintError('PERMISSION', 'elige la impresora USB otra vez');

    let claimed: number | null = null;
    try {
      if (!device.opened) await device.open();
      if (!device.configuration) await device.selectConfiguration(1);
      const target = bulkOut(device);
      if (!target) throw new PrintError('NOT_SUPPORTED', 'el dispositivo no recibe datos');
      await device.claimInterface(target.interfaceNumber);
      claimed = target.interfaceNumber;
      const result = await device.transferOut(target.endpointNumber, payload.escpos());
      if (result.status !== 'ok') throw new PrintError('OFFLINE', result.status);
    } catch (error) {
      if (error instanceof PrintError) throw error;
      // En Windows el driver del fabricante "toma" la impresora: hace falta WinUSB (ADR-003)
      throw new PrintError('OFFLINE', error instanceof Error ? error.message : undefined);
    } finally {
      if (claimed !== null) await device.releaseInterface(claimed).catch(() => {});
      await device.close().catch(() => {});
    }
  },
};
