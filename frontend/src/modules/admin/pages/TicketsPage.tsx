// Configuración › Tickets (permiso config.restaurant; H3 #21). Dueño: Deniscito; reasignado a
// Pablito (Docs/17 §3.1). Encabezado, pie, logo y papel de cada impreso de la sucursal (Docs/11).
// La vista previa usa el mismo armado que la impresión (withTemplate + renderText).
import type { DocType, TicketTemplate } from '@mise/shared/contracts/config';
import { Printer } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { usePublicConfig, useTicketTemplates } from '../../../core/config/index.js';
import {
  printWithDialog,
  renderText,
  withTemplate,
  type PaperWidth,
  type PrintDocument,
} from '../../../core/print/index.js';
import { useDevice } from '../../../core/session/index.js';
import { Button, cx, Select, Switch, TextArea } from '../../../core/ui/index.js';
import { useSaveTicketTemplate } from '../api/admin-api.js';

const DOCS: { type: DocType; label: string; hint: string }[] = [
  { type: 'COMANDA', label: 'Comanda', hint: 'Lo que sale para cocina y barra' },
  {
    type: 'PRECUENTA',
    label: 'Pre-cuenta',
    hint: 'La cuenta que se lleva a la mesa antes de pagar',
  },
  { type: 'RECIBO', label: 'Recibo', hint: 'El comprobante al cobrar' },
  { type: 'CORTE', label: 'Corte de caja', hint: 'El reporte al cerrar el turno' },
  {
    type: 'MOVIMIENTO',
    label: 'Retiro y depósito',
    hint: 'El comprobante de un movimiento de efectivo',
  },
];

/** Documento de muestra para la vista previa y la prueba. */
function sample(restaurant: string, label: string): PrintDocument {
  return {
    title: `Prueba de ${label}`,
    lines: [
      { kind: 'text', text: restaurant.toUpperCase(), align: 'center', bold: true },
      { kind: 'rule', char: '=' },
      { kind: 'text', text: label.toUpperCase(), align: 'center', bold: true },
      { kind: 'rule' },
      { kind: 'text', text: '(contenido del impreso)', align: 'center' },
      { kind: 'rule', char: '=' },
    ],
  };
}

export function TicketsPage() {
  const device = useDevice();
  const templates = useTicketTemplates();
  const [chosen, setChosen] = useState<DocType>('COMANDA');

  if (templates.isPending) return <p className="text-base text-secondary">Cargando tickets…</p>;
  if (templates.error || !templates.data || !device)
    return <p role="alert">No se pudieron cargar las plantillas de ticket.</p>;

  const doc = DOCS.find((d) => d.type === chosen)!;
  const template = templates.data.find((t) => t.docType === chosen);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Tickets</h1>
        <p className="text-base text-secondary">
          Encabezado, pie, logo y papel de cada impreso de esta sucursal.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Impresos">
          <ul className="flex flex-col gap-1">
            {DOCS.map((d) => {
              const active = d.type === chosen;
              return (
                <li key={d.type}>
                  <button
                    type="button"
                    aria-current={active ? 'true' : undefined}
                    onClick={() => setChosen(d.type)}
                    className={cx(
                      'flex min-h-12 w-full items-center rounded-md px-3 text-left text-base font-semibold',
                      active ? 'bg-primary text-white' : 'hover:bg-surface',
                    )}
                  >
                    {d.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        {template ? (
          <TemplateForm
            key={chosen}
            branchId={device.branchId}
            template={template}
            label={doc.label}
            hint={doc.hint}
          />
        ) : (
          <p className="text-base">Esta sucursal no tiene plantilla para {doc.label}.</p>
        )}
      </div>
    </div>
  );
}

function TemplateForm({
  branchId,
  template,
  label,
  hint,
}: {
  branchId: string;
  template: TicketTemplate;
  label: string;
  hint: string;
}) {
  const { data: config } = usePublicConfig();
  const [header, setHeader] = useState(template.header);
  const [footer, setFooter] = useState(template.footer);
  const [showLogo, setShowLogo] = useState(template.showLogo);
  const [paperWidth, setPaperWidth] = useState<PaperWidth>(template.paperWidth);
  const [saved, setSaved] = useState(false);
  const save = useSaveTicketTemplate(branchId);
  const style = { header, footer, showLogo, paperWidth };
  const logoUrl = config?.logoUrl ?? null;
  const preview = withTemplate(sample(config?.tradeName ?? '', label), style, logoUrl);
  const error =
    save.error instanceof ApiError ? save.error.message : save.error ? 'No se pudo guardar' : null;
  const touch = () => setSaved(false);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[1fr_auto]">
      <form
        className="flex min-w-0 flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          save.mutate(
            { docType: template.docType, body: style },
            { onSuccess: () => setSaved(true) },
          );
        }}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">{label}</h2>
          <p className="text-sm text-secondary">{hint}</p>
        </div>
        <TextArea
          label="Encabezado"
          hint="Sale arriba de todo, centrado. Ej. dirección, NIT, teléfono (una línea por renglón)"
          value={header}
          maxLength={500}
          onChange={(e) => (touch(), setHeader(e.target.value))}
        />
        <TextArea
          label="Pie"
          hint='Sale al final. Ej. "Gracias por su visita", "Esta no es una factura"'
          value={footer}
          maxLength={500}
          onChange={(e) => (touch(), setFooter(e.target.value))}
        />
        <Switch
          label="Mostrar el logo"
          hint={
            logoUrl
              ? 'Sale arriba, en gris. El logo se cambia en Restaurante'
              : 'Todavía no hay logo: súbelo en Restaurante'
          }
          checked={showLogo}
          onChange={(v) => (touch(), setShowLogo(v))}
        />
        <Select
          label="Papel"
          value={String(paperWidth)}
          options={[
            { value: '80', label: '80 mm' },
            { value: '58', label: '58 mm' },
          ]}
          onChange={(e) => (touch(), setPaperWidth(e.target.value === '58' ? 58 : 80))}
          className="sm:max-w-48"
        />
        {error && (
          <p
            role="alert"
            className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
          >
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm">
            Plantilla guardada. Los siguientes impresos ya salen así.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            variant="outline"
            icon={<Printer />}
            onClick={() => void printWithDialog(preview, paperWidth)}
          >
            Imprimir prueba
          </Button>
          <Button type="submit" loading={save.isPending}>
            Guardar
          </Button>
        </div>
      </form>
      <figure className="flex flex-col gap-2">
        <figcaption className="text-sm font-semibold text-secondary">Vista previa</figcaption>
        <div className="overflow-x-auto rounded-md border border-accent bg-background p-3">
          {preview.logoUrl && (
            <img src={preview.logoUrl} alt="Logo" className="mx-auto mb-2 max-h-16 grayscale" />
          )}
          <pre className="font-mono text-xs leading-tight text-primary">
            {renderText(preview, paperWidth)}
          </pre>
        </div>
      </figure>
    </div>
  );
}
