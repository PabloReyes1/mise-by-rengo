// Mensajes de error de las acciones de mesas para el mesero.
import { ApiError } from '../../../core/api/index.js';
import { OutboxRejectedError } from '../../../core/offline/index.js';

export function actionError(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof OutboxRejectedError || error instanceof ApiError) {
    // La 🔑 (PIN de un gerente en este mismo celular) la construye Deniscito en auth (SC-38)
    if (error.code === 'AUTHORIZATION_REQUIRED') {
      return 'Esta acción necesita la autorización de un gerente.';
    }
    return error.message;
  }
  return 'No se pudo completar la acción. Intenta de nuevo.';
}

export const QUEUED_MESSAGE =
  'Sin conexión: la acción quedó guardada en este celular y se enviará sola al volver la conexión.';
