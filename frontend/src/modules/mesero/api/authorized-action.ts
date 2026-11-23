// Acciones de mesas con 🔑 (Docs/03 §5 regla 3, SC-42). Dueño: Pablito.
// Se lanza la acción; si el servidor responde AUTHORIZATION_REQUIRED, se abre la ventana 🔑 de
// core/session (Deniscito) y la misma acción se repite por la outbox con { authorization }.
import type { Authorization } from '@mise/shared/contracts/auth';
import type { Occupancy } from '@mise/shared/contracts/floor';
import type { UseMutationResult } from '@tanstack/react-query';
import type { OperationOutcome } from '../../../core/offline/index.js';
import { authorizationRequired, useAuthorizationPrompt } from '../../../core/session/index.js';

type FloorMutation<V> = UseMutationResult<OperationOutcome<Occupancy>, Error, V>;
type Outcome = OperationOutcome<Occupancy>;

export function useAuthorizedAction() {
  const { prompt, dialog } = useAuthorizationPrompt();

  function run<V extends { authorization?: Authorization }>(
    mutation: FloorMutation<V>,
    vars: V,
    actionLabel: string,
    handlers: { onDone: (outcome: Outcome) => void; onError?: () => void },
  ) {
    mutation.mutate(vars, {
      onSuccess: handlers.onDone,
      onError: (error) => {
        handlers.onError?.();
        const permission = authorizationRequired(error);
        if (!permission) return; // otro error: la pantalla lo muestra con mutation.error
        // El error queda en la ventana 🔑, no en la pantalla
        mutation.reset();
        prompt({ permission, actionLabel }, async (authorization) => {
          try {
            handlers.onDone(await mutation.mutateAsync({ ...vars, authorization }));
          } catch (e) {
            mutation.reset();
            throw e; // la ventana muestra "PIN incorrecto" y deja reintentar
          }
        });
      },
    });
  }

  return { run, dialog };
}
