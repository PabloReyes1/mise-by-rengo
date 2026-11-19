// Editor de un grupo de modificadores (RF-013, RF-014). Quitar uno de la lista lo desactiva (historial).
import type { ModifierGroup } from '@mise/shared/contracts/catalog';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { Button, Switch, TextInput } from '../../../core/ui/index.js';
import { toMoney, useSaveModifierGroup, type ModifierGroupDraft } from '../api/admin-api.js';

export function ModifierGroupEditor({
  group,
  onClose,
}: {
  group: ModifierGroup | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ModifierGroupDraft>(
    group
      ? {
          name: group.name,
          required: group.required,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          modifiers: group.modifiers
            .filter((m) => m.status !== 'INACTIVE')
            .map((m) => ({ id: m.id, name: m.name, priceDelta: m.priceDelta, status: m.status })),
        }
      : { name: '', required: false, minSelect: 0, maxSelect: 1, modifiers: [] },
  );
  const save = useSaveModifierGroup();
  const rangeError =
    draft.minSelect > draft.maxSelect ? 'El mínimo no puede ser mayor que el máximo' : undefined;
  const pricesOk = draft.modifiers.every((m) => m.name.trim() && toMoney(m.priceDelta));
  const valid = draft.name.trim() && !rangeError && pricesOk;
  const setMod = (i: number, patch: Partial<ModifierGroupDraft['modifiers'][number]>) =>
    setDraft({
      ...draft,
      modifiers: draft.modifiers.map((m, j) => (j === i ? { ...m, ...patch } : m)),
    });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        save.mutate(
          {
            id: group?.id,
            draft: {
              ...draft,
              modifiers: draft.modifiers.map((m) => ({
                ...m,
                name: m.name.trim(),
                priceDelta: toMoney(m.priceDelta)!,
              })),
            },
          },
          { onSuccess: onClose },
        );
      }}
    >
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">
          {group ? `Editar ${group.name}` : 'Nuevo grupo de modificadores'}
        </h2>
        <Button variant="outline" onClick={onClose}>
          Volver a la lista
        </Button>
      </header>
      <TextInput
        label="Nombre del grupo"
        hint='Ej. "Término de la carne" o "Extras"'
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
      />
      <Switch
        label="Obligatorio"
        hint="El mesero no puede enviar el producto sin elegir"
        checked={draft.required}
        onChange={(required) =>
          setDraft({
            ...draft,
            required,
            minSelect: required ? Math.max(1, draft.minSelect) : draft.minSelect,
          })
        }
      />
      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <TextInput
          label="Mínimo"
          type="number"
          min={0}
          value={draft.minSelect}
          error={rangeError}
          onChange={(e) => setDraft({ ...draft, minSelect: Number(e.target.value) })}
        />
        <TextInput
          label="Máximo"
          type="number"
          min={1}
          value={draft.maxSelect}
          onChange={(e) => setDraft({ ...draft, maxSelect: Number(e.target.value) })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Opciones</legend>
        {draft.modifiers.map((m, i) => (
          <div
            key={m.id ?? `nuevo-${i}`}
            className="grid grid-cols-[1fr_7rem_auto] items-end gap-2"
          >
            <TextInput
              label="Opción"
              value={m.name}
              onChange={(e) => setMod(i, { name: e.target.value })}
            />
            <TextInput
              label="Recargo"
              inputMode="decimal"
              value={m.priceDelta}
              error={toMoney(m.priceDelta) ? undefined : 'Monto inválido'}
              onChange={(e) => setMod(i, { priceDelta: e.target.value })}
            />
            <Button
              variant="outline"
              aria-label={`Quitar ${m.name || 'opción'}`}
              icon={<Trash2 />}
              onClick={() =>
                setDraft({ ...draft, modifiers: draft.modifiers.filter((_, j) => j !== i) })
              }
            >
              Quitar
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          icon={<Plus />}
          className="self-start"
          onClick={() =>
            setDraft({
              ...draft,
              modifiers: [...draft.modifiers, { name: '', priceDelta: '0.00', status: 'ACTIVE' }],
            })
          }
        >
          Agregar opción
        </Button>
      </fieldset>

      {save.error && (
        <p role="alert" className="rounded-md border-2 border-error px-4 py-3 text-base">
          {save.error instanceof ApiError ? save.error.message : 'No se pudo guardar'}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={!valid} loading={save.isPending}>
          {group ? 'Guardar grupo' : 'Crear grupo'}
        </Button>
      </div>
    </form>
  );
}
