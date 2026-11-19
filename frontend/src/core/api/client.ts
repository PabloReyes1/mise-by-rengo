// Cliente HTTP de la API (Docs/08 §1). URL relativa /api: el dominio decide el cliente.
// Las acciones operativas no llaman aquí directo: pasan por la outbox de core/offline (Docs/09 §4.2).
import {
  errorResponseSchema,
  type ErrorCode,
  type ErrorDetails,
} from '@mise/shared/contracts/errors';

/** NETWORK_ERROR no viene de la API: es la falta de conexión, que la outbox reintenta. */
export type ApiErrorCode = ErrorCode | 'NETWORK_ERROR';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: ErrorDetails;

  constructor(status: number, code: ApiErrorCode, message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }
}

interface ApiConfig {
  /** Cabeceras de sesión: Authorization, X-Device-Id, X-Device-Token, X-Branch-Id (core/session) */
  getHeaders: () => Record<string, string>;
  /** Refresca el token vencido; true = se puede repetir la petición (core/session, S-04) */
  onTokenExpired?: () => Promise<boolean>;
}

let config: ApiConfig = { getHeaders: () => ({}) };

export function configureApi(next: ApiConfig): void {
  config = next;
}

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** No intentar refrescar el token (la propia petición de refresco) */
  skipRefresh?: boolean;
  /** Cuerpo multipart (subir fotos): se envía tal cual, sin JSON */
  formData?: FormData;
}

async function readError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = errorResponseSchema.safeParse(body);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError(response.status, code, message, details);
  }
  return new ApiError(
    response.status,
    'INTERNAL_ERROR',
    'El servidor no respondió como se esperaba',
  );
}

export async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
  const headers = new Headers({ ...config.getHeaders(), ...request.headers });
  const init: RequestInit = { method: request.method ?? 'GET', headers };
  if (request.signal) init.signal = request.signal;
  if (request.formData) {
    init.body = request.formData;
  } else if (request.body !== undefined) {
    headers.set('content-type', 'application/json');
    init.body = JSON.stringify(request.body);
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Sin conexión con el servidor');
  }

  if (!response.ok) {
    const error = await readError(response);
    // Token de 15 min vencido: se refresca y se repite una sola vez (S-04)
    if (error.code === 'TOKEN_EXPIRED' && !request.skipRefresh && config.onTokenExpired) {
      if (await config.onTokenExpired())
        return apiFetch<T>(path, { ...request, skipRefresh: true });
    }
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
