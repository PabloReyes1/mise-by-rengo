// Identificadores ULID generados en el dispositivo o en el servidor (ADR-006, RF-222).
// En la API viajan como ULID (26 caracteres); en PostgreSQL se guardan como uuid.
import { decodeTime, isValid, monotonicFactory, ulidToUUID, uuidToULID } from 'ulid';

/** ULID en texto (26 caracteres, base32 de Crockford). */
export type Id = string;

// Monotónico: dos IDs del mismo milisegundo siguen ordenados (orden de la outbox, doc 09).
const nextUlid = monotonicFactory();

export function newId(): Id {
  return nextUlid();
}

export function isId(value: string): boolean {
  return value.length === 26 && isValid(value);
}

/** ULID → uuid para guardar en PostgreSQL. Lanza error si el ID no es válido. */
export function idToUuid(id: Id): string {
  if (!isId(id)) throw new Error(`ID inválido: ${id}`);
  return ulidToUUID(id).toLowerCase();
}

/** uuid leído de PostgreSQL → ULID para la API. */
export function idFromUuid(uuid: string): Id {
  return uuidToULID(uuid);
}

/** Momento en que se creó el ID (los primeros 48 bits del ULID). */
export function idTime(id: Id): Date {
  return new Date(decodeTime(id));
}
