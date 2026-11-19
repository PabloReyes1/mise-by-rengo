// Configuración › Dispositivos: código para emparejar un dispositivo nuevo (ADR-008).
// La lista de dispositivos y revocarlos desde la app llegan en H3 (admin completo).
import { KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { useDevice } from '../../../core/session/index.js';
import { Button, Card } from '../../../core/ui/index.js';
import { useCreatePairingCode } from '../api/admin-api.js';

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
    </div>
  );
}
