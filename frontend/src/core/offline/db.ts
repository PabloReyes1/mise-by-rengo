// Base local del dispositivo en IndexedDB (Docs/09 §3.1). Dueño: Pablito.
// Almacenes: `outbox` (H1) y `drafts` (H2: borradores de pedido, RF-066). Los demás (menú, mesas,
// ocupaciones, folios, ...) se agregan con su versión de la base cuando lleguen (H4).
import { Dexie, type EntityTable } from 'dexie';
import type { OutboxOp, OutboxStore } from './outbox.js';

/** Borrador guardado en el dispositivo; `key` lo elige el módulo (ej. 'order:<ocupación>'). */
export interface DraftRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

class MiseDb extends Dexie {
  outbox!: EntityTable<OutboxOp, 'seq'>;
  drafts!: EntityTable<DraftRecord, 'key'>;

  constructor() {
    super('mise');
    this.version(1).stores({
      // ++seq: autoincremental = orden del dispositivo; índices para buscar por estado y entidad
      outbox: '++seq, status, entityId, &idempotencyKey',
    });
    // v2 (H2): borradores de pedido; BORRADOR nunca viaja al servidor (Docs/05 §5.4)
    this.version(2).stores({ drafts: 'key' });
  }
}

let db: MiseDb | null = null;

function getDb(): MiseDb {
  db ??= new MiseDb();
  return db;
}

/** Pide al navegador no borrar los datos locales (Docs/09 §3.1). */
export function requestPersistentStorage(): void {
  void navigator.storage?.persist?.().catch(() => undefined);
}

export function dexieStore(): OutboxStore {
  return {
    async add(op) {
      return getDb().outbox.add(op);
    },
    list: () => getDb().outbox.orderBy('seq').toArray(),
    async update(seq, patch) {
      await getDb().outbox.update(seq, patch);
    },
    async remove(seq) {
      await getDb().outbox.delete(seq);
    },
  };
}

/** Borradores: lo que el mesero arma antes de enviar. Si falla IndexedDB, se sigue en memoria. */
export const draftStore = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return (await getDb().drafts.get(key))?.value as T | undefined;
    } catch {
      return undefined;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await getDb().drafts.put({ key, value, updatedAt: Date.now() });
    } catch {
      // Sin IndexedDB (modo privado): el borrador vive solo mientras la pantalla esté abierta
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await getDb().drafts.delete(key);
    } catch {
      // igual que arriba
    }
  },
};
