// Emparejar este dispositivo con el código de 6 dígitos que genera un administrador (ADR-008).
import type { DeviceType, PairDeviceResponse } from '@mise/shared/contracts/auth';
import { useMutation } from '@tanstack/react-query';
import { ChefHat, LayoutDashboard, Smartphone, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../../../core/api/index.js';
import { sessionStore } from '../../../core/session/index.js';
import { Button, cx, NumericKeypad, TextInput } from '../../../core/ui/index.js';
import { AuthLayout, FormError } from './AuthLayout.js';

const TYPES: { type: DeviceType; label: string; hint: string; Icon: typeof Smartphone }[] = [
  { type: 'WAITER', label: 'Mesero', hint: 'Celular para tomar pedidos', Icon: Smartphone },
  { type: 'CASH', label: 'Caja', hint: 'Cobro y corte', Icon: Wallet },
  { type: 'KDS', label: 'Cocina', hint: 'Pantalla de pedidos', Icon: ChefHat },
  { type: 'ADMIN', label: 'Administración', hint: 'Menú y configuración', Icon: LayoutDashboard },
];

export function PairDevicePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType | null>(null);

  const pair = useMutation({
    mutationFn: () =>
      apiFetch<PairDeviceResponse>('/devices/pair', {
        method: 'POST',
        body: { code, name: name.trim(), type },
      }),
    onSuccess: (device) => {
      sessionStore.setDevice({ ...device, name: name.trim() });
      void navigate('/entrar', { replace: true });
    },
  });

  const ready = code.length === 6 && name.trim().length > 0 && type !== null;
  const error =
    pair.error instanceof ApiError
      ? pair.error.message
      : pair.error
        ? 'No se pudo emparejar'
        : null;

  return (
    <AuthLayout
      title="Emparejar este dispositivo"
      description="Escribe el código de 6 dígitos que te dio un administrador. Vale 10 minutos."
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) pair.mutate();
        }}
      >
        <NumericKeypad
          mode="code"
          maxLength={6}
          value={code}
          onChange={setCode}
          label="Código de emparejamiento"
        />

        <TextInput
          label="Nombre del dispositivo"
          hint="Para reconocerlo en la lista, ej. Caja 1 o Celular de Ana"
          value={name}
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">¿Para qué se usa?</legend>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map(({ type: t, label, hint, Icon }) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={type === t}
                onClick={() => setType(t)}
                className={cx(
                  'flex min-h-20 flex-col items-start gap-1 rounded-md border p-3 text-left transition-transform duration-100 active:scale-[0.98]',
                  type === t
                    ? 'border-2 border-primary bg-surface'
                    : 'border-secondary bg-background hover:bg-surface',
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span className="text-base font-bold">{label}</span>
                <span className="text-xs text-secondary">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <FormError message={error} />
        <Button type="submit" size="lg" fullWidth disabled={!ready} loading={pair.isPending}>
          Emparejar
        </Button>
      </form>
    </AuthLayout>
  );
}
