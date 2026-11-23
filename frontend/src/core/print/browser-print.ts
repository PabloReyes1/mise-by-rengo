// Impresión con el diálogo del sistema (decisión de RENGO, 2026-11-23, ADR-003 actualizado).
// No hay que configurar impresoras: el documento se arma como ticket (58 u 80 mm) en un iframe
// oculto y se abre el diálogo de imprimir del navegador; la persona elige cualquier impresora
// instalada en el equipo (USB, red, AirPrint/Mopria en el celular). Funciona sin internet si la
// impresora se alcanza por la red local o el cable.
import { layoutRows, type PaperWidth, type PrintDocument, type PrintRow } from './layout.js';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SIZE_STYLE: Record<PrintRow['size'], string> = {
  normal: '',
  tall: 'font-size:2em;line-height:1.1;',
  wide: 'font-size:2em;line-height:1.1;',
  big: 'font-size:2em;line-height:1.1;',
};

/** HTML del ticket: una fila por línea, letra monoespaciada y ancho del papel. */
export function ticketHtml(doc: PrintDocument, width: PaperWidth): string {
  const rows = layoutRows(doc, width)
    .map((row) => {
      const style = `text-align:${row.align};${row.bold ? 'font-weight:700;' : ''}${SIZE_STYLE[row.size]}`;
      return `<div style="${style}">${escapeHtml(row.text) || '&nbsp;'}</div>`;
    })
    .join('');
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(doc.title)}</title>
<style>
@page { size: ${width}mm auto; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: ${width === 80 ? 72 : 48}mm; padding: 2mm; font: 12px/1.25 ui-monospace, 'Courier New', monospace; white-space: pre; }
</style></head><body>${rows}</body></html>`;
}

/**
 * Abre el diálogo de imprimir con el documento. Se resuelve cuando el diálogo se cierra
 * (el navegador no dice si de verdad se imprimió).
 */
export function printWithDialog(doc: PrintDocument, width: PaperWidth = 80): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    const win = frame.contentWindow;
    if (!win) {
      frame.remove();
      resolve();
      return;
    }
    // El iframe se quita al cerrar el diálogo; en celulares print() no bloquea, así que si
    // afterprint no llega se quita al minuto (antes rompería la impresión en curso)
    const remove = () => frame.remove();
    win.addEventListener('afterprint', () => setTimeout(remove, 500), { once: true });
    setTimeout(remove, 60_000);
    win.document.open();
    win.document.write(ticketHtml(doc, width));
    win.document.close();
    win.focus();
    win.print();
    resolve();
  });
}
