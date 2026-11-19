import { describe, expect, it } from 'vitest';
import { ERROR_CODES, apiError, errorResponseSchema, httpStatusFor } from './index.js';

describe('códigos de error (doc 08 §1)', () => {
  it('cada código tiene el estado HTTP de la tabla del doc 08', () => {
    expect(httpStatusFor('VALIDATION_ERROR')).toBe(400);
    expect(httpStatusFor('TOKEN_EXPIRED')).toBe(401);
    expect(httpStatusFor('LICENSE_READ_ONLY')).toBe(402);
    expect(httpStatusFor('AUTHORIZATION_REQUIRED')).toBe(403);
    expect(httpStatusFor('NOT_FOUND')).toBe(404);
    expect(httpStatusFor('TABLE_OCCUPIED')).toBe(409);
    expect(httpStatusFor('ACCOUNT_LOCKED')).toBe(423);
    expect(httpStatusFor('UPGRADE_REQUIRED')).toBe(426);
    expect(httpStatusFor('AI_QUOTA_EXCEEDED')).toBe(429);
    expect(httpStatusFor('INTERNAL_ERROR')).toBe(500);
  });

  it('incluye los 29 códigos de la tabla del doc 08, sin repetidos', () => {
    expect(ERROR_CODES).toHaveLength(29);
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });
});

describe('cuerpo de error', () => {
  it('apiError arma el cuerpo con el formato del doc 08', () => {
    expect(apiError('TABLE_OCCUPIED', 'La mesa 5 ya fue abierta por Luis')).toEqual({
      error: { code: 'TABLE_OCCUPIED', message: 'La mesa 5 ya fue abierta por Luis', details: {} },
    });
  });

  it('el esquema acepta details como objeto o como lista (VALIDATION_ERROR usa details[])', () => {
    const conLista = apiError('VALIDATION_ERROR', 'Datos inválidos', [{ path: 'total' }]);
    expect(errorResponseSchema.parse(conLista)).toEqual(conLista);
    const conObjeto = apiError('AUTHORIZATION_REQUIRED', 'Requiere autorización', {
      permission: 'bill.reopen',
    });
    expect(errorResponseSchema.parse(conObjeto)).toEqual(conObjeto);
  });

  it('el esquema rechaza un código que no existe', () => {
    const r = errorResponseSchema.safeParse({
      error: { code: 'NO_EXISTE', message: 'x', details: {} },
    });
    expect(r.success).toBe(false);
  });
});
