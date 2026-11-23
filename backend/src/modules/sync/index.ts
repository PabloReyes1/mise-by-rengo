// Módulo sync (Docs/09 §4, Docs/08 §2.9). Dueño: Pablito.
// H1: Idempotency-Key en todas las acciones. H4: sync/push, sync/pull, folios y conflictos.
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { registerIdempotency } from './idempotency.js';

const plugin: FastifyPluginCallback = (app, _options, done) => {
  registerIdempotency(app);
  done();
};

// fastify-plugin: la idempotencia aplica a las rutas de todos los módulos
export const syncModule = fp(plugin, { name: 'sync' });
