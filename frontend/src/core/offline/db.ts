// Base local del dispositivo en IndexedDB (Docs/09 §3.1). Dueño: Pablito.
// H1 solo usa `outbox`. Los demás almacenes (menú, mesas, ocupaciones, folios, ...) se agregan
// con su versión de la base cuando lleguen (H2–H4).
import { Dexie, type EntityTable } from 'dexie';
import type { OutboxOp, OutboxStore } from './outbox.js';

class MiseDb extends Dexie {
  outbox!: EntityTable<OutboxOp, 'seq'>;

  constructor() {
    super('mise');
    this.version(1).stores({
      // ++seq: autoincremental = orden del dispositivo; índices para buscar por estado y entidad
      outbox: '++seq, status, entityId, &idempotencyKey',
    });
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
