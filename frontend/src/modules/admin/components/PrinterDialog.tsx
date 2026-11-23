// Agregar o editar una impresora de este dispositivo (Docs/07 `printers`, Docs/11 §3 y §6).
import { newId } from '@mise/shared/domain/ids';
import { Usb } from 'lucide-react';
import { useState } from 'react';
import {
  chooseUsbPrinter,
  isWebUsbSupported,
  PrintError,
  type PaperWidth,
  type PrinterConfig,
  type PrinterTransport,
} from '../../../core/print/index.js';
import { Button, cx, Modal, Select, Switch, TextInput } from '../../../core/ui/index.js';

const TRANSPORTS: { value: PrinterTransport; label: string; hint: string }[] = [
  {
    value: 'EPOS_LAN',
    label: 'Epson por red',
    hint: 'Recomendada para cocina. Funciona en cualquier celular, también sin internet.',
  },
  {
    value: 'WEBUSB',
    label: 'Por cable USB',
    hint: 'Android con Chrome o una PC con el driver WinUSB.',
  },
];

const CODEPAGES = [
  { value: 'cp858', label: 'CP858 (español, recomendada)' },
  { value: 'cp850', label: 'CP850 (español)' },
  { value: 'cp437', label: 'CP437 (básica)' },
];

const CUTS = [
  { value: 'partial', label: 'Corte parcial' },
  { value: 'full', label: 'Corte total' },
  { value: 'none', label: 'Sin corte' },
];

/** IPv4 o nombre de equipo de la red local. */
const ADDRESS = /^[a-z0-9.-]+(:\d{1,5})?$/i;

export function PrinterDialog({
  printer,
  onSave,
  onClose,
}: {
  printer: PrinterConfig | null;
  onSave: (printer: PrinterConfig) => void;
  onClose: () => void;
}) {
  const usbSupported = isWebUsbSupported();
  const [draft, setDraft] = useState<PrinterConfig>(
    printer ?? {
      id: newId(),
      name: '',
      transport: 'EPOS_LAN',
      address: '',
      paperWidth: 80,
      codepage: 'cp858',
      cut: 'partial',
      drawerKick: false,
    },
  );
  const [usbName, setUsbName] = useState<string | null>(null);
  const [usbError, setUsbError] = useState<string | null>(null);
  const set = <K extends keyof PrinterConfig>(key: K, value: PrinterConfig[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const addressValid =
    draft.transport === 'EPOS_LAN' ? ADDRESS.test(draft.address.trim()) : Boolean(draft.address);
  const valid = draft.name.trim().length > 0 && addressValid;

  return (
    <Modal open onClose={onClose} title={printer ? `Impresora ${printer.name}` : 'Nueva impresora'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSave({ ...draft, name: draft.name.trim(), address: draft.address.trim() });
        }}
      >
        <TextInput
          label="Nombre"
          hint="Ej. Cocina o Caja"
          value={draft.name}
          maxLength={40}
          onChange={(e) => set('name', e.target.value)}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Cómo se conecta</legend>
          {TRANSPORTS.map((t) => {
            const disabled = t.value === 'WEBUSB' && !usbSupported;
            const checked = draft.transport === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={disabled}
                onClick={() => setDraft((d) => ({ ...d, transport: t.value, address: '' }))}
                className={cx(
                  'flex min-h-16 flex-col items-start gap-1 rounded-md border p-3 text-left disabled:cursor-not-allowed disabled:opacity-60',
                  checked
                    ? 'border-2 border-primary bg-surface'
                    : 'border-secondary bg-background hover:bg-surface',
                )}
              >
                <span className="text-base font-bold">{t.label}</span>
                <span className="text-sm text-secondary">
                  {disabled
                    ? 'Este navegador no tiene USB (por ejemplo, Safari en iPhone).'
                    : t.hint}
                </span>
              </button>
            );
          })}
        </fieldset>

        {draft.transport === 'EPOS_LAN' ? (
          <TextInput
            label="IP de la impresora"
            hint="Fija en el router, ej. 192.168.1.50"
            inputMode="decimal"
            autoCapitalize="none"
            spellCheck={false}
            value={draft.address}
            error={draft.address && !addressValid ? 'Escribe una IP como 192.168.1.50' : undefined}
            onChange={(e) => set('address', e.target.value)}
          />
        ) : (
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              icon={<Usb />}
              onClick={() => {
                setUsbError(null);
                chooseUsbPrinter()
                  .then((chosen) => {
                    set('address', chosen.address);
                    setUsbName(chosen.name);
                  })
                  .catch((e: unknown) =>
                    setUsbError(e instanceof PrintError ? e.message : 'No se pudo elegir'),
                  );
              }}
            >
              {draft.address ? 'Elegir otra impresora USB' : 'Elegir impresora USB'}
            </Button>
            {draft.address && (
              <p className="text-sm">
                {usbName ?? 'Impresora USB'}{' '}
                <span className="tabular text-secondary">({draft.address})</span>
              </p>
            )}
            {usbError && (
              <p role="alert" className="text-sm">
                {usbError}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Papel"
            value={String(draft.paperWidth)}
            options={[
              { value: '80', label: '80 mm' },
              { value: '58', label: '58 mm' },
            ]}
            onChange={(e) => set('paperWidth', Number(e.target.value) as PaperWidth)}
          />
          <Select
            label="Corte"
            value={draft.cut}
            options={CUTS}
            onChange={(e) => set('cut', e.target.value as PrinterConfig['cut'])}
          />
        </div>
        <Select
          label="Página de códigos"
          hint="Para que salgan bien la ñ y los acentos"
          value={draft.codepage}
          options={CODEPAGES}
          onChange={(e) => set('codepage', e.target.value)}
        />
        <Switch
          label="Abre el cajón de dinero"
          hint="Solo la impresora de caja con cajón conectado"
          checked={draft.drawerKick}
          onChange={(v) => set('drawerKick', v)}
        />

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid}>
            {printer ? 'Guardar' : 'Agregar impresora'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
