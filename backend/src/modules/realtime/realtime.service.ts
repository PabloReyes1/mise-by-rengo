// Publicar eventos y reenviar los perdidos (Docs/08 §3, ADR-004). Dueño: Deniscito.
// Cada evento se guarda en realtime_events (seq creciente) y se emite a sus salas. Al reconectar,
// el dispositivo manda su último seq y recibe lo que se perdió, solo de sus salas (SC-53).
import {
  REALTIME_EVENTS,
  REPLAY_LIMIT,
  type RealtimeEnvelope,
  type RealtimeRoom,
} from '@mise/shared/contracts/realtime';
import { toApiId, toDbId } from '../../core/ids.js';
import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';

/** Retención de los eventos para reenviar (Docs/07 realtime_events): 24 h */
export const RETENTION_MS = 24 * 60 * 60 * 1000;

/** Nombre real de la sala en Socket.IO: las salas de sucursal llevan el id de la sucursal. */
export function socketRoom(branchId: string, room: RealtimeRoom): string {
  if (room === 'branch') return `branch:${branchId}`;
  if (room === 'kds' || room === 'cash') return `branch:${branchId}:${room}`;
  return room; // user:<id> y device:<id> ya son únicos
}

export interface PublishInput {
  /** Sucursal en formato de la API (ULID) */
  branchId: string;
  event: string;
  rooms: RealtimeRoom[];
  data: unknown;
}

export interface Emitter {
  emit(rooms: string[], envelope: RealtimeEnvelope): void;
}

export async function storeEvent(
  prisma: PrismaClient,
  input: PublishInput,
): Promise<RealtimeEnvelope> {
  const row = await prisma.realtimeEvent.create({
    data: {
      branchId: toDbId(input.branchId),
      event: input.event,
      rooms: input.rooms,
      payload: (input.data ?? null) as Prisma.InputJsonValue,
    },
  });
  return {
    seq: Number(row.seq),
    event: row.event,
    at: row.at.toISOString(),
    branchId: input.branchId,
    data: input.data,
  };
}

/** Guarda el evento y lo emite. Un fallo aquí nunca rompe la acción que lo originó. */
export async function publish(
  prisma: PrismaClient,
  emitter: Emitter | null,
  input: PublishInput,
): Promise<RealtimeEnvelope | null> {
  try {
    const envelope = await storeEvent(prisma, input);
    emitter?.emit(
      input.rooms.map((r) => socketRoom(input.branchId, r)),
      envelope,
    );
    return envelope;
  } catch {
    return null;
  }
}

/** ¿El dispositivo con estas salas debía recibir un evento emitido a `rooms`? */
function reaches(rooms: string[], member: Set<string>): boolean {
  return rooms.some((r) => member.has(r));
}

/**
 * Eventos posteriores a `lastSeq` para un dispositivo (Docs/08 §3.3). Si faltan eventos porque ya
 * se borraron, o son más de REPLAY_LIMIT, devuelve `resync`: el cliente recarga todo.
 */
export async function missedEvents(
  prisma: PrismaClient,
  input: { branchId: string; lastSeq: number; memberRooms: RealtimeRoom[] },
): Promise<{ resync: true } | { resync: false; events: RealtimeEnvelope[] }> {
  const branchId = toDbId(input.branchId);
  const rows = await prisma.realtimeEvent.findMany({
    where: { branchId, seq: { gt: BigInt(input.lastSeq) } },
    orderBy: { seq: 'asc' },
    take: REPLAY_LIMIT + 1,
  });
  if (rows.length > REPLAY_LIMIT) return { resync: true };
  // seq siempre crece: si el más viejo que queda es posterior a lastSeq + 1, se borraron eventos
  // que este dispositivo no vio (retención de 24 h) y hay que recargar todo
  if (input.lastSeq > 0) {
    const { _min } = await prisma.realtimeEvent.aggregate({ _min: { seq: true } });
    if (_min.seq === null || BigInt(input.lastSeq) + 1n < _min.seq) return { resync: true };
  }
  const member = new Set<string>(input.memberRooms);
  return {
    resync: false,
    events: rows
      .filter((r) => reaches(r.rooms, member))
      .map((r) => ({
        seq: Number(r.seq),
        event: r.event,
        at: r.at.toISOString(),
        branchId: toApiId(r.branchId),
        data: r.payload,
      })),
  };
}

/** Borra los eventos de más de 24 h. */
export async function purgeOldEvents(prisma: PrismaClient, now = new Date()): Promise<number> {
  const { count } = await prisma.realtimeEvent.deleteMany({
    where: { at: { lt: new Date(now.getTime() - RETENTION_MS) } },
  });
  return count;
}

export { REALTIME_EVENTS };
