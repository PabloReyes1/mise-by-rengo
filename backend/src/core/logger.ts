// Logs con pino en JSON (Docs/13 §6, RNF-080).
// Etiqueta al inicio del mensaje para buscarla con grep: grep '\[SYNC\]' logs/*.log
import { stdTimeFunctions, type LoggerOptions } from 'pino';
import type { Env } from './env.js';

export const LOG_TAGS = [
  'AUTH',
  'SYNC',
  'PRINT',
  'KDS',
  'PAY',
  'CASH',
  'DB',
  'AI',
  'RT',
  'BOOT',
] as const;
export type LogTag = (typeof LOG_TAGS)[number];

/** `tagged('SYNC', 'operación aplicada')` → `'[SYNC] operación aplicada'` */
export function tagged(tag: LogTag, message: string): string {
  return `[${tag}] ${message}`;
}

/** Nunca se escriben contraseñas, PIN, tokens ni datos de tarjeta. */
const SECRET_KEYS = ['pin', 'password', 'token', 'accessToken', 'refreshToken', 'deviceToken'];
const REDACT_PATHS = [
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((key) => `*.${key}`),
  // Autorización 🔑: { authorization: { userId, pin } } en el cuerpo
  'body.authorization',
  '*.body.authorization',
  'req.headers.authorization',
  'req.headers.cookie',
];

export function loggerOptions(env: Env): LoggerOptions {
  return {
    level: env.LOG_LEVEL,
    base: { client: env.CLIENT_NAME },
    timestamp: stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: '[REDACTADO]' },
  };
}
