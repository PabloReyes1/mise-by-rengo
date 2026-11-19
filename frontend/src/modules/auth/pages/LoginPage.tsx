// Iniciar sesión en un dispositivo emparejado (Docs/03 §6):
// caja y cocina (compartidos) → elegir el nombre y PIN; mesero y administración → usuario y contraseña.
import type { SessionResponse } from '@mise/shared/contracts/auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { ApiError, apiFetch } from '../../../core/api/index.js';
import { homePathFor, sessionStore, useDevice } from '../../../core/session/index.js';
import { Button, NumericKeypad, TextInput } from '../../../core/ui/index.js';
import { AuthLayout, FormError } from './AuthLayout.js';

type Mode = 'pin' | 'password';

function errorText(error: unknown): string | null {
  if (!error) return null;
  return error instanceof ApiError ? error.message : 'No se pudo iniciar sesión';
}

export function LoginPage() {
  const device = useDevice();
  const navigate = useNavigate();
  const shared = device?.type === 'CASH' || device?.type === 'KDS';
  const [mode, setMode] = useState<Mode>(shared ? 'pin' : 'password');
  const [userId, setUserId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const users = useQuery({
    queryKey: ['auth', 'device-users', device?.deviceId],
    queryFn: () => apiFetch<{ id: string; fullName: string }[]>('/auth/device-users'),
    enabled: Boolean(device) && mode === 'pin',
  });

  const login = useMutation({
    mutationFn: () =>
      mode === 'pin'
        ? apiFetch<SessionResponse>('/auth/pin', {
            method: 'POST',
            body: { userId, pin },
            skipRefresh: true,
          })
        : apiFetch<SessionResponse>('/auth/login', {
            method: 'POST',
            body: { username: username.trim(), password },
            skipRefresh: true,
          }),
    onSuccess: (session) => {
      sessionStore.setSession(session);
      if (device) void navigate(homePathFor(device.type), { replace: true });
    },
    onError: () => setPin(''),
  });

  if (!device) return <Navigate to="/emparejar" replace />;
  const selected = users.data?.find((u) => u.id === userId);

  return (
    <AuthLayout
      title={selected ? `Hola, ${selected.fullName}` : 'Iniciar sesión'}
      description={device.name ? `En ${device.name}` : undefined}
    >
      {mode === 'pin' && !selected && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">¿Quién eres?</h2>
          {users.isPending && <p className="text-base text-secondary">Cargando usuarios…</p>}
          {users.data?.length === 0 && (
            <p className="text-base text-secondary">
              Nadie tiene PIN en esta sucursal todavía. Entra con usuario y contraseña.
            </p>
          )}
          <ul className="grid grid-cols-2 gap-2">
            {users.data?.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => setUserId(u.id)}
                  className="flex min-h-16 w-full items-center rounded-md bg-surface px-4 text-left text-base font-semibold transition-transform duration-100 hover:bg-accent/40 active:scale-[0.98]"
                >
                  {u.fullName}
                </button>
              </li>
            ))}
          </ul>
          <FormError message={errorText(users.error)} />
        </div>
      )}

      {mode === 'pin' && selected && (
        <form
          className="flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (pin.length >= 4) login.mutate();
          }}
        >
          <NumericKeypad mode="pin" maxLength={6} value={pin} onChange={setPin} label="PIN" />
          <FormError message={errorText(login.error)} />
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={pin.length < 4}
            loading={login.isPending}
          >
            Entrar
          </Button>
          <Button
            variant="outline"
            icon={<ArrowLeft />}
            onClick={() => {
              setUserId(null);
              setPin('');
              login.reset();
            }}
          >
            Elegir a otra persona
          </Button>
        </form>
      )}

      {mode === 'password' && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate();
          }}
        >
          <TextInput
            label="Usuario"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextInput
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FormError message={errorText(login.error)} />
          <Button
            type="submit"
            size="lg"
            fullWidth
            disabled={!username.trim() || !password}
            loading={login.isPending}
          >
            Entrar
          </Button>
        </form>
      )}

      <button
        type="button"
        className="self-center text-base font-semibold text-secondary underline underline-offset-4"
        onClick={() => {
          setMode(mode === 'pin' ? 'password' : 'pin');
          setUserId(null);
          login.reset();
        }}
      >
        {mode === 'pin' ? 'Entrar con usuario y contraseña' : 'Entrar con PIN'}
      </button>
    </AuthLayout>
  );
}
