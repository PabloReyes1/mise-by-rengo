// Autorización 🔑 (Docs/03 §5 regla 3, Docs/08 §1): cuando la API responde
// 403 AUTHORIZATION_REQUIRED, otra persona presente que sí tiene el permiso elige su nombre y
// escribe su PIN en este mismo dispositivo, y la acción se repite con { authorization }.
// Vale para una sola acción. Está en core/ porque la usan varios módulos (mesero, caja, admin).
// Sin conexión (H4) el PIN se validará contra pin_cache (Docs/09 §7).
import type { Authorization } from '@mise/shared/contracts/auth';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { apiFetch } from '../api/index.js';
import { Button, Modal, NumericKeypad } from '../ui/index.js';

/** Qué se pide autorizar: el permiso que falta y la acción en palabras ("Unir la mesa 6"). */
export interface AuthorizationRequest {
  permission: string;
  actionLabel: string;
}

/**
 * Si el error es `AUTHORIZATION_REQUIRED`, devuelve el permiso que falta; si no, null.
 * Sirve para ApiError y para los rechazos de la outbox (los dos traen `code` y `details`).
 */
export function authorizationRequired(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const e = error as { code?: unknown; details?: { permission?: unknown } };
  if (e.code !== 'AUTHORIZATION_REQUIRED') return null;
  return typeof e.details?.permission === 'string' ? e.details.permission : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'No se pudo autorizar. Intenta de nuevo.';
}

export interface AuthorizationDialogProps {
  /** null = cerrada */
  request: AuthorizationRequest | null;
  /**
   * Repite la acción con la autorización. Si falla (PIN incorrecto, sin permiso, cuenta
   * bloqueada) el mensaje se muestra en la ventana y se puede volver a intentar.
   */
  onAuthorize: (authorization: Authorization) => Promise<unknown>;
  onClose: () => void;
}

export function AuthorizationDialog({ request, onAuthorize, onClose }: AuthorizationDialogProps) {
  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title="Autorización necesaria"
      description={
        request
          ? `${request.actionLabel}: necesita el PIN de alguien que pueda autorizarlo.`
          : undefined
      }
    >
      {/* key: cada pedido empieza de cero (sin el PIN ni la persona del anterior) */}
      {request && (
        <AuthorizationForm
          key={`${request.permission}:${request.actionLabel}`}
          permission={request.permission}
          onAuthorize={onAuthorize}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function AuthorizationForm({
  permission,
  onAuthorize,
  onDone,
}: {
  permission: string;
  onAuthorize: (authorization: Authorization) => Promise<unknown>;
  onDone: () => void;
}) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const users = useQuery({
    queryKey: ['auth', 'device-users', permission],
    queryFn: () =>
      apiFetch<{ id: string; fullName: string }[]>(
        `/auth/device-users?permission=${encodeURIComponent(permission)}`,
      ),
  });

  // Si solo una persona puede autorizar, se va directo a su PIN
  const only = users.data?.length === 1 ? users.data[0] : undefined;
  const userId = chosenId ?? only?.id ?? null;
  const selected = users.data?.find((u) => u.id === userId);

  const submit = async () => {
    if (!userId || pin.length < 4 || sending) return;
    setSending(true);
    setError(null);
    try {
      await onAuthorize({ userId, pin });
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setPin('');
    } finally {
      setSending(false);
    }
  };

  if (!selected) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">¿Quién autoriza?</h3>
        {users.isPending && <p className="text-base text-secondary">Cargando…</p>}
        {users.error && <AuthError message={errorMessage(users.error)} />}
        {users.data?.length === 0 && (
          <p className="text-base">
            Nadie con PIN en esta sucursal puede autorizar esta acción. Pide al gerente que la haga
            desde su usuario.
          </p>
        )}
        <ul className="grid grid-cols-2 gap-2">
          {users.data?.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setChosenId(u.id)}
                className="flex min-h-16 w-full items-center rounded-md bg-surface px-4 text-left text-base font-semibold transition-transform duration-100 hover:bg-accent/40 active:scale-[0.98]"
              >
                {u.fullName}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-base">
        <span className="font-semibold">{selected.fullName}</span>, escribe tu PIN.
      </p>
      <NumericKeypad
        mode="pin"
        maxLength={6}
        value={pin}
        onChange={setPin}
        label={`PIN de ${selected.fullName}`}
      />
      {error && <AuthError message={error} />}
      <Button
        type="submit"
        size="lg"
        fullWidth
        icon={<KeyRound />}
        disabled={pin.length < 4}
        loading={sending}
      >
        Autorizar
      </Button>
      {!only && (
        <Button
          variant="outline"
          icon={<ArrowLeft />}
          onClick={() => {
            setChosenId(null);
            setPin('');
            setError(null);
          }}
        >
          Elegir a otra persona
        </Button>
      )}
    </form>
  );
}

function AuthError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-md border-2 border-error bg-background px-4 py-3 text-base">
      {message}
    </p>
  );
}

/**
 * Atajo para los módulos: `prompt` abre la ventana y `dialog` se pone una vez en la pantalla.
 *
 * ```tsx
 * const { prompt, dialog } = useAuthorizationPrompt();
 * move.mutate(vars, {
 *   onError: (error) => {
 *     const permission = authorizationRequired(error);
 *     if (permission)
 *       prompt({ permission, actionLabel: 'Trasladar la mesa 5' }, (authorization) =>
 *         move.mutateAsync({ ...vars, authorization }),
 *       );
 *   },
 * });
 * return <>{…}{dialog}</>;
 * ```
 */
export function useAuthorizationPrompt(): {
  prompt: (
    request: AuthorizationRequest,
    run: (authorization: Authorization) => Promise<unknown>,
  ) => void;
  dialog: ReactNode;
} {
  const [state, setState] = useState<{
    request: AuthorizationRequest;
    run: (authorization: Authorization) => Promise<unknown>;
  } | null>(null);
  const prompt = useCallback(
    (request: AuthorizationRequest, run: (authorization: Authorization) => Promise<unknown>) =>
      setState({ request, run }),
    [],
  );
  const dialog = (
    <AuthorizationDialog
      request={state?.request ?? null}
      onAuthorize={(authorization) => state?.run(authorization) ?? Promise.resolve()}
      onClose={() => setState(null)}
    />
  );
  return { prompt, dialog };
}
