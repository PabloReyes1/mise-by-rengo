// Orden para llevar (Docs/05 paso 2): sin mesa; nombre y teléfono opcionales.
import type { Occupancy } from '@mise/shared/contracts/floor';
import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button, Modal, TextInput } from '../../../core/ui/index.js';
import { useOpenTable } from '../api/floor-api.js';
import { actionError } from './errors.js';

export interface TakeawayDialogProps {
  open: boolean;
  onClose: () => void;
  onOpened: (occupancy: Occupancy) => void;
  onQueued: () => void;
}

export function TakeawayDialog({ open, onClose, onOpened, onQueued }: TakeawayDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Para llevar"
      description="El nombre ayuda a entregar el pedido. Los dos datos son opcionales."
    >
      {open && <TakeawayForm onClose={onClose} onOpened={onOpened} onQueued={onQueued} />}
    </Modal>
  );
}

function TakeawayForm({ onClose, onOpened, onQueued }: Omit<TakeawayDialogProps, 'open'>) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const create = useOpenTable();
  const error = actionError(create.error);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate(
      {
        orderTypeCode: 'PARA_LLEVAR',
        guests: 1,
        ...(name.trim() ? { customerName: name.trim() } : {}),
        ...(phone.trim() ? { customerPhone: phone.trim() } : {}),
      },
      {
        onSuccess: (outcome) =>
          outcome.status === 'applied' ? onOpened(outcome.data) : onQueued(),
      },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <TextInput
        label="Nombre del cliente"
        value={name}
        maxLength={80}
        autoComplete="off"
        onChange={(e) => setName(e.target.value)}
      />
      <TextInput
        label="Teléfono"
        type="tel"
        inputMode="tel"
        value={phone}
        maxLength={30}
        autoComplete="off"
        onChange={(e) => setPhone(e.target.value)}
      />
      {error && (
        <p role="alert" className="flex items-start gap-2 text-base">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-error" />
          <span>{error}</span>
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" loading={create.isPending}>
          Crear orden
        </Button>
      </div>
    </form>
  );
}
