// Contraseñas, PIN y tokens (Docs/07: argon2id). Nunca se guardan ni se registran en claro.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/** Contraseña o PIN → hash argon2id. */
export function hashSecret(secret: string): Promise<string> {
  return hash(secret);
}

export async function verifySecret(hashed: string | null, secret: string): Promise<boolean> {
  if (!hashed) return false;
  try {
    return await verify(hashed, secret);
  } catch {
    return false;
  }
}

/**
 * Tokens largos y aleatorios (refresh, dispositivo, código de emparejamiento): sha256 basta
 * porque no se pueden adivinar, y permite buscarlos por su hash.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Contraseña temporal legible (sin caracteres que se confunden: 0/O, 1/l/I). */
export function temporaryPassword(length = 14): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join('');
}

/** Código numérico de n dígitos (emparejamiento). */
export function numericCode(digits = 6): string {
  return String(randomInt(10 ** digits)).padStart(digits, '0');
}
