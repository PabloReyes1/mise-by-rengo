// Cancelar un ítem ya enviado a cocina (Docs/05 §6, RF-053): el motivo es obligatorio y queda en
// la bitácora. Si el mesero no tiene order.cancel_sent, la acción pide 🔑 al confirmar.
// Reasignado a Deniscito (doc 17 §3.1).
import type { OrderItem } from '@mise/shared/contracts/orders';
import { useState } from 'react';
import { Button, cx, Modal, TextInput } from '../../../core/ui/index.js';
import { useCancelReasons } from '../api/order-api.js';

export interface CancelItemDialogProps {
  item: OrderItem | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: (input: { reasonId: string; note: string }) => void;
}

export function CancelItemDialog({ item, loading, onClose, onConfirm }: CancelItemDialogProps) {
  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={item ? `Cancelar ${item.quantity} × ${item.productName}` : 'Cancelar'}
      description="Cocina recibe la cancelación. Elige el motivo."
    >
      {item && (
        <CancelForm key={item.id} loading={loading} onClose={onClose} onConfirm={onConfirm} />
      )}
    </Modal>
  );
}

function CancelForm({ loading, onClose, onConfirm }: Omit<CancelItemDialogProps, 'item'>) {
  const reasons = useCancelReasons();
  const [reasonId, setReasonId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (reasonId) onConfirm({ reasonId, note: note.trim() });
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-bold">Motivo</legend>
        {reasons.isPending && <p className="text-base text-secondary">Cargando motivos…</p>}
        {reasons.isError && (
          <p role="alert" className="text-base">
            No se pudieron cargar los motivos. Revisa la conexión.
          </p>
        )}
        {reasons.data?.map((r) => (
          <label
            key={r.id}
            className={cx(
              'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-base',
              reasonId === r.id
                ? 'border-2 border-primary bg-surface font-semibold'
                : 'border-accent',
            )}
          >
            <input
              type="radio"
              name="reason"
              checked={reasonId === r.id}
              onChange={() => setReasonId(r.id)}
              className="size-5 shrink-0 accent-primary"
            />
            {r.name}
          </label>
        ))}
      </fieldset>
      <TextInput
        label="Nota (opcional)"
        value={note}
        maxLength={140}
        autoComplete="off"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          No cancelar
        </Button>
        <Button type="submit" variant="danger" disabled={!reasonId} loading={loading}>
          Cancelar ítem
        </Button>
      </div>
    </form>
  );
}
