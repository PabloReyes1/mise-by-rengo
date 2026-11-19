import { describe, expect, it } from 'vitest';
import { idFromUuid, idTime, idToUuid, isId, newId } from './index.js';

describe('newId', () => {
  it('genera un ULID válido de 26 caracteres', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(isId(id)).toBe(true);
  });

  it('los IDs generados seguidos quedan ordenados por tiempo, aunque sean del mismo milisegundo', () => {
    const ids = Array.from({ length: 1000 }, () => newId());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('isId', () => {
  it('rechaza textos que no son ULID', () => {
    expect(isId('')).toBe(false);
    expect(isId('01ARZ3NDEKTSV4RRFFQ69G5FA')).toBe(false); // 25 caracteres
    expect(isId('01ARZ3NDEKTSV4RRFFQ69G5FAU')).toBe(false); // U no es Crockford
    expect(isId('01563e3a-b5d3-d676-4c61-efb99302bd5b')).toBe(false); // UUID
  });
});

describe('ULID ↔ uuid (ADR-006: en PostgreSQL se guarda como uuid)', () => {
  const ulid = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
  const uuid = '01563e3a-b5d3-d676-4c61-efb99302bd5b';

  it('convierte un ULID al uuid que se guarda en la base', () => {
    expect(idToUuid(ulid)).toBe(uuid);
  });

  it('convierte el uuid de la base de vuelta al mismo ULID', () => {
    expect(idFromUuid(uuid)).toBe(ulid);
  });

  it('ida y vuelta conserva cualquier ID nuevo', () => {
    const id = newId();
    expect(idFromUuid(idToUuid(id))).toBe(id);
  });

  it('falla con un ULID inválido en lugar de inventar un uuid', () => {
    expect(() => idToUuid('no-es-un-id')).toThrow();
  });
});

describe('idTime', () => {
  it('devuelve el momento en que se creó el ID', () => {
    const before = Date.now();
    const id = newId();
    const after = Date.now();
    const t = idTime(id).getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});
