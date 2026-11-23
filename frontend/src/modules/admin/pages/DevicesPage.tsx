// Configuración › Dispositivos: código para emparejar un dispositivo nuevo (ADR-008), la lista de
// los de la sucursal con su nombre y revocarlos (H3 #21, SC-65), y la prueba de impresión.
import type { AdminDevice, DeviceType } from '@mise/shared/contracts/auth';
import { KeyRound, Pencil, Printer } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatDateTime } from '../../../core/format/index.js';
import { printWithDialog, testPage, type PaperWidth } from '../../../core/print/index.js';
import { useDevice } from '../../../core/session/index.js';
import { Badge, Button, Card, Modal, Select, TextInput } from '../../../core/ui/index.js';
import {
  useCreatePairingCode,
  useDevices,
  useRenameDevice,
  useRevokeDevice,
} from '../api/admin-api.js';

const TYPE_LABEL: Record<DeviceType, string> = {
  WAITER: 'Mesero',
  CASH: 'Caja',
  KDS: 'Cocina',
  ADMIN: 'Administración',
};

function useCountdown(until: string | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.max(0, Math.round((Date.parse(until) - now) / 1000)) : 0;
}

export function DevicesPage() {
  const device = useDevice();
  const create = useCreatePairingCode();
  const left = useCountdown(create.data?.expiresAt);
  const expired = create.isSuccess && left === 0;

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Dispositivos</h1>
        <p className="text-base text-secondary">
          Para usar un celular, una caja o una pantalla de cocina, primero se empareja con un código
          de un solo uso.
        </p>
      </header>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">Emparejar un dispositivo nuevo</h2>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-base">
          <li>Abre Mise en el dispositivo nuevo.</li>
          <li>Genera un código aquí y escríbelo allá.</li>
          <li>El código vence en 10 minutos y sirve una sola vez.</li>
        </ol>

        {create.data && !expired && (
          <div
            className="flex flex-col items-center gap-2 rounded-md bg-background py-6"
            aria-live="polite"
          >
            <span className="text-sm font-semibold text-secondary">Código</span>
            <span className="text-2xl font-bold tracking-[0.3em] tabular">{create.data.code}</span>
            <span className="text-sm text-secondary tabular">
              Vence en {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </span>
          </div>
        )}
        {expired && <p className="text-base">El código venció. Genera otro.</p>}
        {create.error && (
          <p role="alert" className="text-base">
            {create.error instanceof ApiError
              ? create.error.message
              : 'No se pudo generar el código'}
          </p>
        )}

        <Button
          icon={<KeyRound />}
          size="lg"
          loading={create.isPending}
          disabled={!device}
          onClick={() => device && create.mutate(device.branchId)}
        >
          {create.data && !expired ? 'Generar otro código' : 'Generar código'}
        </Button>
      </Card>

      <DeviceList />

      <PrintTestCard deviceName={device?.name ?? 'Este dispositivo'} />
    </div>
  );
}

/** Los dispositivos de la sucursal: renombrar y revocar (el revocado ya no entra ni sincroniza). */
function DeviceList() {
  const devices = useDevices();
  const regional = useRegional();
  const [editing, setEditing] = useState<AdminDevice | null>(null);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Dispositivos emparejados</h2>
      {devices.isPending ? (
        <p className="text-base text-secondary">Cargando…</p>
      ) : devices.error || !devices.data ? (
        <p role="alert">No se pudo cargar la lista.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface">
          {devices.data.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={d.revokedAt ? 'text-base text-secondary' : 'text-base font-semibold'}
                  >
                    {d.name}
                  </span>
                  <span className="text-sm text-secondary">{TYPE_LABEL[d.type]}</span>
                  {d.current && <Badge tone="neutral">Este</Badge>}
                  {d.revokedAt && <Badge tone="neutral">Revocado</Badge>}
                </div>
                <span className="text-sm text-secondary">
                  {d.revokedAt
                    ? `Revocado el ${formatDateTime(d.revokedAt, regional)}`
                    : d.lastSeenAt
                      ? `Visto por última vez: ${formatDateTime(d.lastSeenAt, regional)}`
                      : `Emparejado el ${formatDateTime(d.createdAt, regional)}`}
                </span>
              </div>
              {!d.revokedAt && (
                <Button
                  variant="outline"
                  icon={<Pencil />}
                  aria-label={`Editar ${d.name}`}
                  onClick={() => setEditing(d)}
                >
                  Editar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <DeviceDialog key={editing.id} device={editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

function DeviceDialog({ device, onClose }: { device: AdminDevice; onClose: () => void }) {
  const [name, setName] = useState(device.name);
  const [confirm, setConfirm] = useState(false);
  const rename = useRenameDevice();
  const revoke = useRevokeDevice();
  const failure = rename.error ?? revoke.error;
  const error =
    failure instanceof ApiError ? failure.message : failure ? 'No se pudo guardar' : null;

  return (
    <Modal open onClose={onClose} title={device.name} description={TYPE_LABEL[device.type]}>
      {confirm ? (
        <div className="flex flex-col gap-4">
          <p className="text-base">
            {device.name} se cierra y ya no podrá entrar ni sincronizar. Lo que tenga sin enviar se
            pierde. Para volver a usarlo hay que emparejarlo de nuevo con un código.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirm(false)}>
              No, volver
            </Button>
            <Button
              variant="danger"
              loading={revoke.isPending}
              onClick={() => revoke.mutate(device.id, { onSuccess: onClose })}
            >
              Revocar {device.name}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim())
              rename.mutate({ id: device.id, name: name.trim() }, { onSuccess: onClose });
          }}
        >
          <TextInput
            label="Nombre"
            value={name}
            maxLength={60}
            required
            onChange={(e) => setName(e.target.value)}
          />
          {error && (
            <p
              role="alert"
              className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={device.current}
              title={device.current ? 'Revócalo desde otro dispositivo' : undefined}
              onClick={() => setConfirm(true)}
            >
              Revocar
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!name.trim()} loading={rename.isPending}>
                Guardar
              </Button>
            </div>
          </div>
          {device.current && (
            <p className="text-sm text-secondary">
              Es el dispositivo que estás usando: para revocarlo, hazlo desde otro.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

/** Imprime la página de prueba con el diálogo del sistema (ADR-003 actualizado, 2026-11-23). */
function PrintTestCard({ deviceName }: { deviceName: string }) {
  const regional = useRegional();
  const [width, setWidth] = useState<PaperWidth>(80);
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Probar impresión</h2>
      <p className="text-base">
        No hay que configurar impresoras: al imprimir se abre el diálogo del sistema y eliges la
        impresora que quieras (USB, red o AirPrint).
      </p>
      <Select
        label="Papel"
        value={String(width)}
        options={[
          { value: '80', label: '80 mm' },
          { value: '58', label: '58 mm' },
        ]}
        onChange={(e) => setWidth(e.target.value === '58' ? 58 : 80)}
      />
      <Button
        variant="secondary"
        icon={<Printer />}
        onClick={() =>
          void printWithDialog(
            testPage({
              deviceName,
              paperWidth: width,
              printedAt: formatDateTime(new Date().toISOString(), regional),
            }),
            width,
          )
        }
      >
        Imprimir página de prueba
      </Button>
    </Card>
  );
}
