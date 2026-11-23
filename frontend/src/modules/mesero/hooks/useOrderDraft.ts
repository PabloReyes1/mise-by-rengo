// Borrador del pedido guardado en el dispositivo (IndexedDB) por ocupación: si se cierra la app o
// se recarga la página, el pedido a medio tomar sigue ahí (RF-066, Docs/09 §3.1). Dueño: Pablito.
import { useCallback, useEffect, useRef, useState } from 'react';
import { draftStore } from '../../../core/offline/index.js';
import { EMPTY_DRAFT, type OrderDraft } from './order-draft.js';

const keyOf = (occupancyId: string) => `order:${occupancyId}`;

export function useOrderDraft(occupancyId: string) {
  const [draft, setDraft] = useState<OrderDraft>(EMPTY_DRAFT);
  const [loaded, setLoaded] = useState(false);
  const touched = useRef(false);

  useEffect(() => {
    let alive = true;
    void draftStore.get<OrderDraft>(keyOf(occupancyId)).then((saved) => {
      // Si el mesero ya agregó algo mientras cargaba, gana lo que agregó
      if (alive && saved && !touched.current) setDraft(saved);
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [occupancyId]);

  const update = useCallback(
    (change: (d: OrderDraft) => OrderDraft) => {
      touched.current = true;
      setDraft((current) => {
        const next = change(current);
        void (next.lines.length
          ? draftStore.set(keyOf(occupancyId), next)
          : draftStore.remove(keyOf(occupancyId)));
        return next;
      });
    },
    [occupancyId],
  );

  /** Después de enviar: el borrador ya es un pedido */
  const clear = useCallback(() => {
    touched.current = true;
    setDraft(EMPTY_DRAFT);
    void draftStore.remove(keyOf(occupancyId));
  }, [occupancyId]);

  return { draft, loaded, update, clear };
}
