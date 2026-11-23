import { afterEach, describe, expect, it, vi } from 'vitest';
import { ticketHtml } from './browser-print.js';
import { testPage } from './documents/test-page.js';
import { encodeEposPrint, eposEnvelope } from './epos-xml.js';
import { encodeEscPos } from './escpos.js';
import { layoutRows, renderText, wrap, type PrintDocument } from './layout.js';
import { printDocument, RETRY_DELAYS_MS } from './print-service.js';
import { eposLan, eposUrl, parseEposResponse } from './transports/epos-lan.js';
import { PrintError, type PrinterConfig, type Transport } from './types.js';

const printer: PrinterConfig = {
  id: 'p1',
  name: 'Cocina',
  transport: 'EPOS_LAN',
  address: '192.168.1.50',
  paperWidth: 80,
  codepage: 'cp858',
  cut: 'partial',
  drawerKick: false,
};

/** Fragmento de comanda de Docs/11 §4.1 */
const comanda: PrintDocument = {
  title: 'Comanda C-000131',
  beep: true,
  lines: [
    { kind: 'rule', char: '=' },
    { kind: 'text', text: '** COMANDA **', align: 'center', bold: true },
    { kind: 'text', text: 'ADICIONAL', align: 'center' },
    { kind: 'rule', char: '=' },
    { kind: 'pair', left: 'ORDEN: C-000131', right: '(M3-0005)' },
    { kind: 'text', text: '2  LOMITO', size: 'tall', bold: true },
    { kind: 'text', text: '> Término: Medio', indent: 5 },
    { kind: 'text', text: '*** NOTA: sin cebolla ***', indent: 5, bold: true },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('layout (Docs/11 §2)', () => {
  it('48 columnas en 80 mm y 32 en 58 mm', () => {
    const rule = { title: 'x', lines: [{ kind: 'rule' as const }] };
    expect(layoutRows(rule, 80)[0]!.text).toHaveLength(48);
    expect(layoutRows(rule, 58)[0]!.text).toHaveLength(32);
  });

  it('parte el texto largo sin cortar palabras y conserva la sangría', () => {
    const lines = wrap('Pollo a la plancha con vegetales salteados y arroz', 20, 3);
    expect(lines).toEqual([
      '   Pollo a la',
      '   plancha con',
      '   vegetales',
      '   salteados y arroz',
    ]);
    expect(lines.every((l) => l.length <= 20)).toBe(true);
  });

  it('una palabra más larga que la línea se corta', () => {
    expect(wrap('ABCDEFGHIJ', 4)).toEqual(['ABCD', 'EFGH', 'IJ']);
  });

  it('el par pone el valor pegado a la derecha', () => {
    const [row] = layoutRows(
      { title: 'x', lines: [{ kind: 'pair', left: 'Subtotal', right: 'Q285.00' }] },
      80,
    );
    expect(row!.text).toBe('Subtotal' + ' '.repeat(33) + 'Q285.00');
    expect(row!.text).toHaveLength(48);
  });

  it('el doble ancho usa la mitad de las columnas', () => {
    const rows = layoutRows(
      { title: 'x', lines: [{ kind: 'text', text: 'X'.repeat(30), size: 'big' }] },
      80,
    );
    expect(rows.map((r) => r.text.length)).toEqual([24, 6]);
  });

  it('la vista previa se parece a los ejemplos del doc 11', () => {
    const text = renderText(comanda, 80).split('\n');
    expect(text[1]).toBe(' '.repeat(17) + '** COMANDA **');
    expect(text[4]).toBe('ORDEN: C-000131' + ' '.repeat(24) + '(M3-0005)');
    expect(text[6]).toBe('     > Término: Medio');
  });
});

describe('ESC/POS', () => {
  const bytes = (doc: PrintDocument, cut?: PrintDocument['cut']) =>
    Array.from(encodeEscPos({ ...doc, cut }, { width: 80, codepage: 'cp858' }));
  const has = (data: number[], seq: number[]) =>
    data.some((_, i) => seq.every((b, j) => data[i + j] === b));

  it('inicia la impresora y escribe la ñ y la á con la página de códigos (no "?")', () => {
    const data = bytes({ title: 'x', lines: [{ kind: 'text', text: 'Muñoz Término' }] });
    expect(has(data, [0x1b, 0x40])).toBe(true); // ESC @
    expect(data).toContain(0xa4); // ñ en CP858
    expect(data).toContain(0x82); // é en CP858
    expect(has(data, [0x4d, 0x75, 0x3f])).toBe(false); // "Mu?"
  });

  it('corta el papel salvo con cut = none, y hace sonar el zumbador si se pide', () => {
    expect(has(bytes(comanda, 'partial'), [0x1d, 0x56])).toBe(true); // GS V
    expect(has(bytes(comanda, 'none'), [0x1d, 0x56])).toBe(false);
    expect(has(bytes(comanda, 'none'), [0x1b, 0x42, 2, 1])).toBe(true); // ESC B
  });
});

describe('ePOS XML', () => {
  it('escapa el texto y marca negrita y doble alto con atributos', () => {
    const xml = encodeEposPrint(
      { title: 'x', lines: [{ kind: 'text', text: 'Café & <té>', bold: true, size: 'tall' }] },
      80,
    );
    expect(xml).toContain('<text align="left" em="true" dh="true"/>');
    expect(xml).toContain('<text>Café &amp; &lt;té&gt;&#10;</text>');
    expect(xml).toContain('<cut type="feed"/>');
  });

  it('el sobre SOAP envuelve el cuerpo', () => {
    expect(eposEnvelope('<x/>')).toContain('<s:Body><x/></s:Body>');
  });
});

describe('transporte epos-lan', () => {
  it('arma la URL del servicio de la impresora con HTTPS', () => {
    expect(eposUrl('http://192.168.1.50/')).toBe(
      'https://192.168.1.50/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000',
    );
  });

  it('lee la respuesta de la impresora', () => {
    expect(
      parseEposResponse('<response success="false" code="EPTR_REC_EMPTY" status="1"/>'),
    ).toEqual({ success: false, code: 'EPTR_REC_EMPTY' });
  });

  it('"sin papel" llega como PAPER_OUT y la red caída como UNREACHABLE', async () => {
    const payload = { escpos: () => new Uint8Array(), epos: () => '<epos-print/>' };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('<response success="false" code="EPTR_REC_EMPTY"/>')),
      ),
    );
    await expect(eposLan.send(printer, payload)).rejects.toMatchObject({ code: 'PAPER_OUT' });

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(eposLan.send(printer, payload)).rejects.toMatchObject({ code: 'UNREACHABLE' });
  });
});

describe('printDocument (Docs/11 §3)', () => {
  it('reintenta 2 veces (1 s y 3 s) y luego avisa con el error de la impresora', async () => {
    const send = vi.fn(() => Promise.reject(new PrintError('COVER_OPEN')));
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    await expect(
      printDocument(comanda, printer, { transports: { EPOS_LAN: { send } }, sleep }),
    ).rejects.toMatchObject({ code: 'COVER_OPEN' });
    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual(RETRY_DELAYS_MS);
  });

  it('si se arregla en un reintento, imprime', async () => {
    const send = vi
      .fn<Transport['send']>()
      .mockRejectedValueOnce(new PrintError('OFFLINE'))
      .mockResolvedValueOnce();
    await printDocument(comanda, printer, {
      transports: { EPOS_LAN: { send } },
      sleep: () => Promise.resolve(),
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('los errores de configuración no se reintentan', async () => {
    const send = vi.fn(() => Promise.reject(new PrintError('NOT_SUPPORTED')));
    await expect(
      printDocument(
        comanda,
        { ...printer, transport: 'WEBUSB' },
        {
          transports: { WEBUSB: { send } },
          sleep: () => Promise.resolve(),
        },
      ),
    ).rejects.toMatchObject({ code: 'NOT_SUPPORTED' });
    expect(send).toHaveBeenCalledOnce();
  });

  it('el cajón solo se abre si la impresora lo tiene (drawer_kick)', async () => {
    let xml = '';
    const send: Transport['send'] = (_p, payload) => {
      xml = payload.epos();
      return Promise.resolve();
    };
    await printDocument({ ...comanda, openDrawer: true }, printer, {
      transports: { EPOS_LAN: { send } },
    });
    expect(xml).not.toContain('<pulse');
    await printDocument(
      { ...comanda, openDrawer: true },
      { ...printer, drawerKick: true },
      {
        transports: { EPOS_LAN: { send } },
      },
    );
    expect(xml).toContain('<pulse');
  });
});

describe('diálogo del sistema (ADR-003, 2026-11-23)', () => {
  it('arma el ticket con el ancho del papel, escapa el texto y respeta negrita y alineación', () => {
    const html = ticketHtml(
      { title: 'Prueba', lines: [{ kind: 'text', text: 'A & <B>', bold: true, align: 'center' }] },
      58,
    );
    expect(html).toContain('@page { size: 58mm auto; margin: 0; }');
    expect(html).toContain(
      '<div style="text-align:center;font-weight:700;">A &amp; &lt;B&gt;</div>',
    );
  });
});

describe('página de prueba (Docs/11 §4.5)', () => {
  it('trae dispositivo, ancho y caracteres especiales, y cabe en 58 mm', () => {
    const page = testPage({ deviceName: 'Caja 1', printedAt: '22/11/2026 21:40', paperWidth: 58 });
    const text = renderText(page, 58);
    for (const piece of ['Caja 1', '58 mm', 'ñ Ñ á é í ó ú', '¿Señor Muñoz?'])
      expect(text).toContain(piece);
    expect(Math.max(...text.split('\n').map((l) => l.length))).toBeLessThanOrEqual(32 + 16);
    expect(layoutRows(page, 58).every((r) => r.text.length <= 32)).toBe(true);
  });
});
