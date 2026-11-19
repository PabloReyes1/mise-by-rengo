// Errores de la API con el formato único de Docs/08 §1.
import {
  apiError,
  httpStatusFor,
  type ErrorCode,
  type ErrorDetails,
} from '@mise/shared/contracts/errors';
import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

/** Error de negocio: los módulos lanzan `new AppError('TABLE_OCCUPIED', 'La mesa 5 ...')`. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails;

  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  get statusCode(): number {
    return httpStatusFor(this.code);
  }
}

/** '/items/0/qty' → 'items.0.qty' */
function toPath(instancePath: string): string {
  return instancePath.replace(/^\//, '').replaceAll('/', '.');
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => {
    void reply.status(404).send(apiError('NOT_FOUND', 'Ruta no encontrada'));
  });

  app.setErrorHandler((error: FastifyError | AppError, req, reply) => {
    if (error instanceof AppError) {
      return reply
        .status(error.statusCode)
        .send(apiError(error.code, error.message, error.details));
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const details = error.validation.map((v) => ({
        path: toPath(v.instancePath),
        message: v.message,
      }));
      return reply.status(400).send(apiError('VALIDATION_ERROR', 'Datos inválidos', details));
    }

    // Errores de cliente que detecta Fastify (JSON mal formado, cuerpo demasiado grande, ...)
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.status(400).send(apiError('VALIDATION_ERROR', error.message));
    }

    // Inesperado: el detalle va solo al log, nunca a la respuesta
    req.log.error({ err: error }, 'error inesperado en la petición');
    return reply.status(500).send(apiError('INTERNAL_ERROR', 'Ocurrió un error inesperado'));
  });
}
