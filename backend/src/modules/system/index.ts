// Módulo system: salud del proceso y hora del servidor (Docs/08 §2.1). Público.
import {
  healthResponseSchema,
  timeResponseSchema,
  type HealthResponse,
} from '@mise/shared/contracts/system';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

export interface SystemOptions {
  /** Consulta mínima a la base (SELECT 1) */
  checkDb: () => Promise<unknown>;
  /** Tiempo máximo de espera de la base antes de responder degraded */
  dbTimeoutMs: number;
}

async function dbResponds(checkDb: () => Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([checkDb().then(() => true), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const systemModule: FastifyPluginCallbackZod<SystemOptions> = (app, options, done) => {
  app.get(
    '/api/health',
    { schema: { response: { 200: healthResponseSchema } } },
    async (): Promise<HealthResponse> => ({
      status: (await dbResponds(options.checkDb, options.dbTimeoutMs)) ? 'ok' : 'degraded',
      uptime: Math.round(process.uptime()),
    }),
  );

  app.get('/api/time', { schema: { response: { 200: timeResponseSchema } } }, () => ({
    now: new Date().toISOString(),
  }));
  done();
};
