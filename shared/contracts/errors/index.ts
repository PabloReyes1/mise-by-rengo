// Formato único de errores de la API (doc 08 §1, "Formato de error").
import { z } from 'zod';

/** Código de error → estado HTTP, tal como está en la tabla del doc 08 §1. */
const HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  MODIFIER_RULES: 400,
  PAYMENT_INSUFFICIENT: 400,
  CHANGE_NOT_ALLOWED: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  PIN_INVALID: 401,
  LICENSE_SUSPENDED: 402,
  LICENSE_READ_ONLY: 402,
  FORBIDDEN: 403,
  AUTHORIZATION_REQUIRED: 403,
  MODULE_DISABLED: 403,
  BRANCH_FORBIDDEN: 403,
  DEVICE_REVOKED: 403,
  NOT_FOUND: 404,
  STALE_VERSION: 409,
  TABLE_OCCUPIED: 409,
  SHIFT_ALREADY_OPEN: 409,
  BILL_PAID: 409,
  ITEM_ALREADY_ASSIGNED: 409,
  PRODUCT_SOLD_OUT: 409,
  CONFLICT_REGISTERED: 409,
  REOPEN_NOT_ALLOWED: 409,
  SPLIT_NOT_ALLOWED: 409,
  ACCOUNT_LOCKED: 423,
  UPGRADE_REQUIRED: 426,
  RATE_LIMITED: 429,
  AI_QUOTA_EXCEEDED: 429,
  // Error inesperado del servidor; el mensaje nunca expone detalles internos
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof HTTP_STATUS;

export const ERROR_CODES = Object.keys(HTTP_STATUS) as [ErrorCode, ...ErrorCode[]];

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code];
}

/** `details` es un objeto, o una lista en VALIDATION_ERROR. */
const detailsSchema = z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]);
export type ErrorDetails = z.infer<typeof detailsSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: detailsSchema,
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export function apiError(
  code: ErrorCode,
  message: string,
  details: ErrorDetails = {},
): ErrorResponse {
  return { error: { code, message, details } };
}
