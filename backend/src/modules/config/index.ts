// Módulo config (Docs/07 §4.1, Docs/08 §2.3). Dueño: Deniscito.
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { configRoutes } from './config.routes.js';
import { licenseGuard, licenseReader } from './license.js';

export { effectiveLicense } from './license.js';

export interface ConfigModuleOptions {
  /** Caché de la licencia; 0 en pruebas */
  licenseCacheMs?: number;
}

const plugin: FastifyPluginCallback<ConfigModuleOptions> = (app, options, done) => {
  const license = licenseReader(app, options.licenseCacheMs);
  // Licencia suspendida o vencida (RF-252, RF-256): aplica a todas las rutas de la API
  app.addHook('preHandler', licenseGuard(license));
  // Al cambiar la configuración se vuelve a leer la licencia y los módulos
  app.addHook('onResponse', (req, _reply, next) => {
    if (req.method !== 'GET' && req.url.startsWith('/api/config')) license.invalidate();
    next();
  });
  void app.register(configRoutes(license));
  done();
};

// fastify-plugin: el guardia de la licencia aplica a las rutas de todos los módulos
export const configModule = fp(plugin, { name: 'config' });
