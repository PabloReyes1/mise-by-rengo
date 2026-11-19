// IDs: en la API viajan como ULID y en PostgreSQL se guardan como uuid (ADR-006).
import { idFromUuid, idToUuid, newId } from '@mise/shared/domain/ids';

/** Nuevo ID listo para guardar en la base (uuid). */
export function newDbId(): string {
  return idToUuid(newId());
}

/** uuid de la base → ULID de la API. */
export function toApiId(uuid: string): string {
  return idFromUuid(uuid);
}

/** ULID de la API → uuid de la base. Lanza error si no es un ULID válido. */
export function toDbId(id: string): string {
  return idToUuid(id);
}
