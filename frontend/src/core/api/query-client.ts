// TanStack Query: caché de lecturas (menú, mesas, configuración).
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './client.js';

const MAX_RETRIES = 3;

/** Solo se reintenta lo que puede arreglarse solo: sin conexión o error del servidor. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return error instanceof ApiError && (error.isNetworkError || error.status >= 500);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        // Ahorro de datos móviles (S-14): no se recarga solo por volver a la pestaña
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}
