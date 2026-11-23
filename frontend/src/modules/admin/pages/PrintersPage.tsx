// Configuración › Impresoras (H1, doc 17 §4.2 módulo 11): impresoras de ESTE dispositivo y página
// de prueba (Docs/11 §4.5). La administración completa de impresoras y rutas por dispositivo es de
// H3; mientras tanto la configuración vive solo en este equipo (SC-43).
import { ExternalLink, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useRegional } from '../../../core/config/index.js';
import { formatDateTime } from '../../../core/format/index.js';
import {
  printDocument,
  printerStore,
  PrintError,
  renderText,
  testPage,
  usePrinters,
  type PrinterConfig,
} from '../../../core/print/index.js';
import { useDevice } from '../../../core/session/index.js';
import { Badge, Button, Card } from '../../../core/ui/index.js';
import { PrinterDialog } from '../components/PrinterDialog.js';

type TestState =
  | { status: 'idle' }
  | { status: 'printing' }
  | { status: 'done'; at: string }
  | { status: 'error'; message: string };

export function PrintersPage() {
  const printers = usePrinters();
  const device = useDevice();
  const regional = useRegional();
  const [editing, setEditing] = useState<PrinterConfig | 'new' | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const pageFor = (p: PrinterConfig) =>
    testPage({
      printer: p,
      deviceName: device?.name ?? 'Este dispositivo',
      printedAt: formatDateTime(new Date().toISOString(), regional),
    });

  const runTest = (p: PrinterConfig) => {
    setTests((t) => ({ ...t, [p.id]: { status: 'printing' } }));
    printDocument(pageFor(p), p)
      .then(() =>
        setTests((t) => ({
          ...t,
          [p.id]: { status: 'done', at: formatDateTime(new Date().toISOString(), regional) },
        })),
      )
      .catch((e: unknown) =>
        setTests((t) => ({
          ...t,
          [p.id]: {
            status: 'error',
            message: e instanceof PrintError ? e.message : 'No se pudo imprimir',
          },
        })),
      );
  };

  const preview = printers.find((p) => p.id === previewId);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Impresoras</h1>
          <p className="text-base text-secondary">
            Impresoras que usa <span className="font-semibold">este dispositivo</span>
            {device?.name ? ` (${device.name})` : ''}. Cada celular, caja o tablet configura las
            suyas.
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => setEditing('new')}>
          Agregar impresora
        </Button>
      </header>

      {printers.length === 0 ? (
        <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
          Este dispositivo no tiene impresoras. Agrega la de cocina o la de caja para imprimir una
          página de prueba.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {printers.map((p) => {
            const test = tests[p.id] ?? { status: 'idle' };
            return (
              <li key={p.id}>
                <Card className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col">
                      <h2 className="text-lg font-bold">{p.name}</h2>
                      <span className="text-sm text-secondary">
                        {p.transport === 'EPOS_LAN' ? 'Epson por red' : 'USB'} ·{' '}
                        <span className="tabular">{p.address}</span> · {p.paperWidth} mm
                        {p.drawerKick ? ' · con cajón' : ''}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        icon={<Pencil />}
                        aria-label={`Editar ${p.name}`}
                        onClick={() => setEditing(p)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        icon={<Trash2 />}
                        aria-label={`Quitar ${p.name}`}
                        onClick={() => printerStore.remove(p.id)}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>

                  {p.transport === 'EPOS_LAN' && (
                    <p className="text-sm">
                      Primera vez en este dispositivo: abre la impresora y acepta su certificado; si
                      no, el navegador no la deja imprimir.{' '}
                      <a
                        href={`https://${p.address}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-secondary underline underline-offset-4"
                      >
                        Abrir la impresora
                        <ExternalLink aria-hidden className="size-4" />
                      </a>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      icon={<Printer />}
                      loading={test.status === 'printing'}
                      onClick={() => runTest(p)}
                    >
                      Imprimir página de prueba
                    </Button>
                    <Button
                      variant="outline"
                      aria-expanded={previewId === p.id}
                      onClick={() => setPreviewId(previewId === p.id ? null : p.id)}
                    >
                      {previewId === p.id ? 'Ocultar vista previa' : 'Ver vista previa'}
                    </Button>
                    <span aria-live="polite">
                      {test.status === 'done' && <Badge tone="success">Impresa · {test.at}</Badge>}
                    </span>
                  </div>
                  {test.status === 'error' && (
                    <p
                      role="alert"
                      className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
                    >
                      No se imprimió la página de prueba. {test.message}
                    </p>
                  )}
                  {preview?.id === p.id && (
                    <pre
                      aria-label={`Vista previa en ${p.paperWidth} mm`}
                      className="self-start overflow-x-auto rounded-md border border-accent bg-background p-4 font-mono text-xs leading-snug"
                    >
                      {renderText(pageFor(p), p.paperWidth)}
                    </pre>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <PrinterDialog
          printer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            printerStore.save(p);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
