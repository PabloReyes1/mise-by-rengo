// Idempotency-Key (Docs/08 §1, Docs/09 §4.2 regla 5). Dueño: Pablito.
// La outbox del dispositivo reintenta cuando no sabe si la acción llegó. Si la misma clave vuelve,
// se responde lo mismo que la primera vez sin repetir la acción.
//
// H1: la respuesta se guarda justo después de la acción, no en su misma transacción (SC-35).
// Las acciones de H1 también son idempotentes por el id del cliente, así que un corte justo en
// medio no duplica nada. En H4, sync/push registra la operación en la misma transacción.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { toDbId } from '../../core/ids.js';
import { Prisma } from '../../generated/prisma/client.js';

const HEADER = 'idempotency-key';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** ULID o "<ULID>-op" (Docs/09 §4.1); máximo 64 caracteres */
const KEY_FORMAT = /^[0-9A-Za-z_-]{16,64}$/;

/**
 * Respuestas que se guardan: éxito y errores de negocio, que darían lo mismo al repetir.
 * No se guardan sesión, licencia, versión, límite de intentos ni errores del servidor: al
 * repetir pueden salir distinto.
 */
function outcome(statusCode: number): 'APLICADA' | 'RECHAZADA' | null {
  if (statusCode >= 200 && statusCode < 300) return 'APLICADA';
  if ([400, 403, 404, 409, 423].includes(statusCode)) return 'RECHAZADA';
  return null;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Clave de idempotencia de la petición, si hay que guardar su respuesta */
    idempotencyKey: string | null;
  }
}

function keyOf(req: FastifyRequest): string | null {
  if (!MUTATING.has(req.method)) return null;
  const value = req.headers[HEADER];
  const key = Array.isArray(value) ? value[0] : value;
  if (!key) return null;
  if (!KEY_FORMAT.test(key)) throw new AppError('VALIDATION_ERROR', 'Idempotency-Key inválida');
  return key;
}

function opType(req: FastifyRequest): string {
  return `${req.method} ${req.routeOptions.url ?? req.url}`;
}

function entityOf(req: FastifyRequest): string | null {
  const params = req.params as { id?: unknown } | undefined;
  const body = req.body as { id?: unknown } | undefined;
  const id = params?.id ?? body?.id;
  return typeof id === 'string' ? id : null;
}

export function registerIdempotency(app: FastifyInstance): void {
  app.decorateRequest('idempotencyKey', null);

  // Corre antes que los preHandler de cada ruta: si la clave ya se usó, responde lo guardado
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    // Solo para peticiones con sesión (emparejar y entrar no la usan)
    if (!req.headers.authorization) return;
    const key = keyOf(req);
    if (!key) return;
    await authenticate.call(app, req, reply);
    const deviceId = toDbId(req.auth!.deviceId);

    const previous = await app.prisma.syncOperation.findUnique({ where: { idempotencyKey: key } });
    if (!previous) {
      req.idempotencyKey = key;
      return;
    }
    if (previous.deviceId !== deviceId || previous.opType !== opType(req)) {
      throw new AppError('VALIDATION_ERROR', 'Esa Idempotency-Key ya se usó para otra acción');
    }
    const saved = previous.result as { statusCode: number; body: unknown };
    return reply
      .header('idempotent-replay', 'true')
      .header('content-type', 'application/json; charset=utf-8')
      .status(saved.statusCode)
      .send(JSON.stringify(saved.body));
  });

  // Guarda la respuesta de la primera vez
  app.addHook('onSend', async (req, reply, payload) => {
    const key = req.idempotencyKey;
    const status = outcome(reply.statusCode);
    if (!key || !req.auth || !status) return payload;
    let body: unknown = null;
    if (typeof payload === 'string' && payload !== '') {
      try {
        body = JSON.parse(payload);
      } catch {
        return payload; // solo se guardan respuestas JSON
      }
    }
    try {
      await app.prisma.syncOperation.create({
        data: {
          idempotencyKey: key,
          deviceId: toDbId(req.auth.deviceId),
          opType: opType(req),
          entityId: entityOf(req),
          status,
          result: { statusCode: reply.statusCode, body } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // Otra petición con la misma clave llegó primero: la suya es la que queda
      const duplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!duplicate) req.log.error({ err: error }, 'no se pudo guardar la Idempotency-Key');
    }
    return payload;
  });
}
