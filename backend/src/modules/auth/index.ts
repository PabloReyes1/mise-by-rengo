// Módulo auth (Docs/08 §2.2, ADR-008). Dueño: Deniscito.
// Lo que otros módulos pueden usar: authorize (permisos con 🔑) y createPairingCode (comando de servidor).
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { authRoutes } from './auth.routes.js';
import { assertDeviceActive } from './auth.service.js';

export { authorize } from './authorize.js';
export { createPairingCode } from './auth.service.js';

const plugin: FastifyPluginCallback = (app, _options, done) => {
  // core/auth revisa en cada petición que el dispositivo no esté revocado (RF-035)
  app.decorate('deviceGuard', (deviceId: string) => assertDeviceActive(app.prisma, deviceId));
  void app.register(authRoutes);
  done();
};

// fastify-plugin: el decorador deviceGuard queda visible para todos los módulos
export const authModule = fp(plugin, { name: 'auth' });
