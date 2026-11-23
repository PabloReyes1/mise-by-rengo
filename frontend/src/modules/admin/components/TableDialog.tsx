// Crear o editar una mesa (RF-020): nombre, lugares, forma y zona. También dar de baja.
// El editor visual del mapa (posición y tamaño) es de Fase 2 (RF-021).
import type { DiningTable, TableShape, Zone } from '@mise/shared/contracts/floor';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { Button, Modal, Select, TextInput } from '../../../core/ui/index.js';
import { useCreateTable, useUpdateTable } from '../api/tables-api.js';

export const SHAPE_LABEL: Record<TableShape, string> = {
  SQUARE: 'Cuadrada',
  ROUND: 'Redonda',
  RECTANGLE: 'Rectangular',
};

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : e ? 'No se pudo guardar' : null;
}

export interface TableDialogProps {
  /** null = mesa nueva en `zoneId` */
  table: DiningTable | null;
  zoneId: string;
  zones: Zone[];
  onClose: () => void;
}

export function TableDialog({ table, zoneId, zones, onClose }: TableDialogProps) {
  const [name, setName] = useState(table?.name ?? '');
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 4));
  const [shape, setShape] = useState<TableShape>(table?.shape ?? 'SQUARE');
  const [zone, setZone] = useState(table?.zoneId ?? zoneId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const create = useCreateTable();
  const update = useUpdateTable();

  const seats = Number(capacity);
  const seatsValid = Number.isInteger(seats) && seats >= 1 && seats <= 99;
  const valid = name.trim().length > 0 && seatsValid;
  const inUse = table?.status === 'OCUPADA' || table?.status === 'UNIDA';
  const pending = create.isPending || update.isPending;
  const error = errorText(create.error ?? update.error);

  const save = () => {
    if (!valid) return;
    const fields = { name: name.trim(), capacity: seats, shape, zoneId: zone };
    if (table) {
      update.mutate(
        { id: table.id, body: { ...fields, version: table.version } },
        { onSuccess: onClose },
      );
    } else {
      create.mutate(fields, { onSuccess: onClose });
    }
  };

  const remove = () => {
    if (!table) return;
    update.mutate(
      { id: table.id, body: { active: false, version: table.version } },
      { onSuccess: onClose },
    );
  };

  const zoneOptions = zones
    .filter((z) => z.active || z.id === zone)
    .map((z) => ({ value: z.id, label: z.name }));

  return (
    <Modal
      open
      onClose={onClose}
      title={table ? `Mesa ${table.name}` : 'Nueva mesa'}
      description={
        table ? undefined : 'El nombre es como la llaman los meseros: "5", "T2", "Barra 1".'
      }
    >
      {confirmRemove && table ? (
        <div className="flex flex-col gap-4">
          <p className="text-base">
            La mesa {table.name} deja de aparecer en el mapa y no se puede abrir. Su historial se
            conserva. Para volver a usarla, crea una mesa nueva con el mismo nombre.
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              No, volver
            </Button>
            <Button variant="danger" loading={update.isPending} onClick={remove}>
              Dar de baja la mesa {table.name}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <TextInput
            label="Nombre"
            value={name}
            maxLength={20}
            required
            onChange={(e) => setName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <TextInput
              label="Lugares"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={capacity}
              error={capacity && !seatsValid ? 'De 1 a 99' : undefined}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <Select
              label="Forma"
              value={shape}
              options={Object.entries(SHAPE_LABEL).map(([value, label]) => ({ value, label }))}
              onChange={(e) => setShape(e.target.value as TableShape)}
            />
          </div>
          <Select
            label="Zona"
            value={zone}
            options={zoneOptions}
            onChange={(e) => setZone(e.target.value)}
          />
          {error && (
            <p
              role="alert"
              className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {table ? (
              <Button
                variant="outline"
                disabled={inUse}
                title={inUse ? 'Primero hay que liberar la mesa' : undefined}
                onClick={() => setConfirmRemove(true)}
              >
                Dar de baja
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!valid} loading={pending}>
                {table ? 'Guardar' : 'Crear mesa'}
              </Button>
            </div>
          </div>
          {table && inUse && (
            <p className="text-sm text-secondary">
              La mesa está {table.status === 'OCUPADA' ? 'ocupada' : 'unida a otra'}: se puede
              editar, pero no dar de baja ni bloquear hasta que se libere.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
