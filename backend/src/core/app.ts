// Arma la aplicación Fastify. Lo usan server.ts (producción) y las pruebas (con app.inject).
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import Fastify from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { PrismaClient } from '../generated/prisma/client.js';
import { authModule } from '../modules/auth/index.js';
import { catalogModule } from '../modules/catalog/index.js';
import { configModule } from '../modules/config/index.js';
import { systemModule } from '../modules/system/index.js';
import type { Env } from './env.js';
import { AppError, registerErrorHandlers } from './errors.js';
import { loggerOptions } from './logger.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    prisma: PrismaClient;
    rateLimits: RateLimits;
  }
}

/** La base debe responder en 2 s; si no, /api/health dice degraded (Docs/08 §2.1). */
const DB_TIMEOUT_MS = 2000;

/** Intentos por minuto e IP en las rutas públicas sensibles (SC-09). */
export interface RateLimits {
  pairPerMinute: number;
  loginPerMinute: number;
}
const DEFAULT_RATE_LIMITS: RateLimits = { pairPerMinute: 10, loginPerMinute: 30 };

/** Fotos de productos: hasta 10 MB antes de redimensionar (Docs/06 §3.1) */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function createInstance(env: Env) {
  return Fastify({
    logger: loggerOptions(env),
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();
}

export type App = ReturnType<typeof createInstance>;

export interface BuildAppOptions {
  env: Env;
  checkDb: () => Promise<unknown>;
  dbTimeoutMs?: number;
  /** Con la base se registran los módulos de negocio; sin ella, solo system (pruebas del core) */
  prisma?: PrismaClient;
  rateLimits?: Partial<RateLimits>;
  /** Caché de la licencia en ms (por defecto 30 s; 0 en pruebas) */
  licenseCacheMs?: number;
  /** Rutas adicionales (pruebas) */
  register?: (app: App) => void | Promise<void>;
}

export async function buildApp(options: BuildAppOptions): Promise<App> {
  const app = createInstance(options.env);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('env', options.env);
  app.decorate('rateLimits', { ...DEFAULT_RATE_LIMITS, ...options.rateLimits });
  app.decorateRequest('auth', null);
  app.decorateRequest('authorizedBy', null);
  registerErrorHandlers(app);

  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () =>
      new AppError('RATE_LIMITED', 'Demasiados intentos. Espera un minuto y vuelve a intentar.'),
  });
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });

  await app.register(systemModule, {
    checkDb: options.checkDb,
    dbTimeoutMs: options.dbTimeoutMs ?? DB_TIMEOUT_MS,
  });

  if (options.prisma) {
    app.decorate('prisma', options.prisma);
    await app.register(configModule, { licenseCacheMs: options.licenseCacheMs ?? 30_000 });
    await app.register(authModule);
    await app.register(catalogModule);
  }

  await options.register?.(app);
  return app;
}
