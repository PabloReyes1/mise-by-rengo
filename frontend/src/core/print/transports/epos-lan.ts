// Transporte epos-lan: impresora Epson con ePOS-Print por la red local (ADR-003 opción D).
// Funciona desde cualquier navegador, iPhone incluido, y sin internet mientras la red local siga.
// Requiere HTTPS activado en la impresora y su certificado aceptado una vez en cada dispositivo.
// Pendiente de validar con la impresora real (R-01, PA-021).
import { eposEnvelope } from '../epos-xml.js';
import { PrintError, type PrintErrorCode, type Transport } from '../types.js';

const TIMEOUT_MS = 10_000;

/** URL del servicio ePOS. `devid=local_printer` es el nombre por defecto de la impresora. */
export function eposUrl(address: string): string {
  const host = address
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  return `https://${host}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=${TIMEOUT_MS}`;
}

/** Códigos de error de ePOS-Print → nuestros códigos. */
const CODES: Record<string, PrintErrorCode> = {
  EPTR_COVER_OPEN: 'COVER_OPEN',
  EPTR_REC_EMPTY: 'PAPER_OUT',
  EPTR_AUTOMATICAL: 'OFFLINE',
  EPTR_CUTTER: 'OFFLINE',
  EPTR_MECHANICAL: 'OFFLINE',
  EPTR_UNRECOVERABLE: 'OFFLINE',
  DeviceNotFound: 'OFFLINE',
  EX_TIMEOUT: 'OFFLINE',
  EX_ENPC_TIMEOUT: 'OFFLINE',
  EX_BADPORT: 'OFFLINE',
  SchemaError: 'UNKNOWN',
  ParameterError: 'UNKNOWN',
};

/** Lee `<response success="..." code="..."/>` de la respuesta. */
export function parseEposResponse(xml: string): { success: boolean; code: string } {
  const tag = /<response\b[^>]*>/.exec(xml)?.[0] ?? '';
  const attr = (name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
  return { success: attr('success') === 'true', code: attr('code') };
}

export const eposLan: Transport = {
  async send(printer, payload) {
    let response: Response;
    try {
      response = await fetch(eposUrl(printer.address), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: '""',
          'If-Modified-Since': 'Thu, 01 Jan 1970 00:00:00 GMT',
        },
        body: eposEnvelope(payload.epos()),
        signal: AbortSignal.timeout(TIMEOUT_MS + 2_000),
      });
    } catch {
      // Red, certificado no aceptado o permiso de red local de Chrome: el navegador no distingue
      throw new PrintError('UNREACHABLE');
    }
    if (!response.ok) throw new PrintError('OFFLINE', `HTTP ${response.status}`);
    const result = parseEposResponse(await response.text());
    if (!result.success)
      throw new PrintError(CODES[result.code] ?? 'UNKNOWN', result.code || undefined);
  },
};
