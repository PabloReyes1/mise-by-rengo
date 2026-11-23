// Documento → XML ePOS-Print de Epson (Docs/11 §1 regla 2, ADR-003 opción D).
// La impresora recibe el sobre SOAP en https://<ip>/cgi-bin/epos/service.cgi y convierte el texto a
// su página de códigos. Pendiente de validar con la impresora real (R-01, PA-021).
import { layoutRows, type PaperWidth, type PrintDocument, type TextSize } from './layout.js';

const SIZE: Record<TextSize, { dw: boolean; dh: boolean }> = {
  normal: { dw: false, dh: false },
  tall: { dw: false, dh: true },
  wide: { dw: true, dh: false },
  big: { dw: true, dh: true },
};

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Cuerpo `<epos-print>` del documento. */
export function encodeEposPrint(doc: PrintDocument, width: PaperWidth): string {
  const parts: string[] = [];
  let state = { align: '', em: false, dw: false, dh: false };
  for (const row of layoutRows(doc, width)) {
    const { dw, dh } = SIZE[row.size];
    // Solo se repiten los atributos que cambian (el estado de <text> se mantiene en la impresora)
    const attrs: string[] = [];
    if (row.align !== state.align) attrs.push(`align="${row.align}"`);
    if (row.bold !== state.em) attrs.push(`em="${row.bold}"`);
    if (dw !== state.dw) attrs.push(`dw="${dw}"`);
    if (dh !== state.dh) attrs.push(`dh="${dh}"`);
    if (attrs.length) parts.push(`<text ${attrs.join(' ')}/>`);
    state = { align: row.align, em: row.bold, dw, dh };
    parts.push(`<text>${escapeXml(row.text)}&#10;</text>`);
  }
  if (doc.openDrawer) parts.push('<pulse drawer="drawer_1" time="pulse_100"/>');
  if (doc.beep) parts.push('<sound pattern="pattern_a" repeat="1"/>');
  // En ePOS el corte total o parcial lo decide la impresora; "feed" avanza el papel y corta
  if (doc.cut !== 'none') parts.push('<cut type="feed"/>');
  return (
    '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">' +
    '<text lang="en" smooth="true"/>' +
    parts.join('') +
    '</epos-print>'
  );
}

/** Sobre SOAP que espera el servicio ePOS de la impresora. */
export function eposEnvelope(body: string): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">' +
    `<s:Body>${body}</s:Body>` +
    '</s:Envelope>'
  );
}
