// Módulo realtime: Socket.IO en el mismo proceso Fastify (ADR-004, Docs/08 §3). Dueño: Deniscito.
// Otros módulos publican con `app.realtime.publish({ branchId, event, rooms, data })` DESPUÉS de
// guardar su cambio; las acciones siguen yendo por REST.
import {
  REALTIME_CHANNEL,
  REALTIME_EVENTS,
  REALTIME_PATH,
  realtimeAuthSchema,
  type RealtimeEnvelope,
  type RealtimeRoom,
} from '@mise/shared/contracts/realtime';
import type { FastifyPluginCallback } from 'fastify';
import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { verifyAccessToken } from '../../core/auth.js';
import { AppError } from '../../core/errors.js';
import { toApiId, toDbId } from '../../core/ids.js';
import {
  missedEvents,
  publish,
  purgeOldEvents,
  socketRoom,
  type Emitter,
  type PublishInput,
} from './realtime.service.js';

export { REALTIME_EVENTS };
export type { PublishInput };

declare module 'fastify' {
  interface FastifyInstance {
    realtime: {
      /** Guarda y emite un evento; nunca lanza error (el cambio ya se guardó) */
      publish: (input: PublishInput) => Promise<void>;
    };
  }
}

/** Lo que el servidor emite: todo por el canal "event" con el mismo sobre */
interface ServerEvents {
  event: (envelope: RealtimeEnvelope) => void;
}

interface SocketData {
  branchId: string;
  rooms: RealtimeRoom[];
}

const PURGE_EVERY_MS = 60 * 60 * 1000;

const plugin: FastifyPluginCallback = (app, _options, done) => {
  const io = new Server<Record<string, never>, ServerEvents, Record<string, never>, SocketData>(
    app.server,
    { path: REALTIME_PATH, serveClient: false },
  );
  const emitter: Emitter = {
    emit: (rooms, envelope) => io.to(rooms).emit(REALTIME_CHANNEL, envelope),
  };

  app.decorate('realtime', {
    publish: async (input: PublishInput) => {
      await publish(app.prisma, emitter, input);
    },
  });

  // Handshake: token de acceso del usuario + dispositivo (Docs/08 §3)
  io.use((socket, next) => {
    void (async () => {
      const auth = realtimeAuthSchema.safeParse(socket.handshake.auth);
      if (!auth.success) throw new AppError('UNAUTHENTICATED', 'Falta la sesión');
      const claims = await verifyAccessToken(auth.data.token, app.env.JWT_SECRET);
      if (claims.deviceId !== auth.data.deviceId)
        throw new AppError('UNAUTHENTICATED', 'Sesión no válida para este dispositivo');
      if (app.deviceGuard) await app.deviceGuard(claims.deviceId);
      const device = await app.prisma.device.findUnique({
        where: { id: toDbId(claims.deviceId) },
        select: { branchId: true, type: true },
      });
      if (!device) throw new AppError('UNAUTHENTICATED', 'Dispositivo no registrado');
      const rooms: RealtimeRoom[] = [
        'branch',
        `user:${claims.userId}`,
        `device:${claims.deviceId}`,
      ];
      if (device.type === 'KDS') rooms.push('kds');
      if (device.type === 'CASH') rooms.push('cash');
      socket.data = { branchId: toApiId(device.branchId), rooms };
    })().then(
      () => next(),
      (error: unknown) =>
        next(new Error(error instanceof AppError ? error.code : 'UNAUTHENTICATED')),
    );
  });

  io.on('connection', (socket) => {
    const { branchId, rooms } = socket.data;
    void socket.join(rooms.map((r) => socketRoom(branchId, r)));
    const lastSeq = realtimeAuthSchema.safeParse(socket.handshake.auth).data?.lastSeq;
    if (lastSeq === undefined) return;
    // Reenvía lo que se perdió mientras estuvo desconectado (Docs/08 §3.3)
    void missedEvents(app.prisma, { branchId, lastSeq, memberRooms: rooms }).then((result) => {
      if (result.resync) {
        socket.emit(REALTIME_CHANNEL, {
          seq: lastSeq,
          event: REALTIME_EVENTS.resyncRequired,
          at: new Date().toISOString(),
          branchId,
          data: null,
        });
        return;
      }
      for (const envelope of result.events) socket.emit(REALTIME_CHANNEL, envelope);
    });
  });

  const purge = setInterval(() => void purgeOldEvents(app.prisma).catch(() => {}), PURGE_EVERY_MS);
  purge.unref();
  app.addHook('onClose', async () => {
    clearInterval(purge);
    await io.close();
  });
  done();
};

// fastify-plugin: app.realtime queda visible para todos los módulos
export const realtimeModule = fp(plugin, { name: 'realtime', dependencies: ['auth'] });
