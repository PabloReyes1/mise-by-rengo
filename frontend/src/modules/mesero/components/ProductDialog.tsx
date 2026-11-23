// Agregar un producto al pedido: modificadores por grupo, cantidad y nota (Docs/05 paso 3).
// Las reglas del grupo (obligatorio, mínimo, máximo) se cumplen aquí antes de agregar; el
// servidor las vuelve a revisar al enviar (MODIFIER_RULES).
import type { ModifierGroup, Product } from '@mise/shared/contracts/catalog';
import { newId } from '@mise/shared/domain/ids';
import { useState } from 'react';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney } from '../../../core/format/index.js';
import { Button, cx, Modal, TextInput } from '../../../core/ui/index.js';
import { draftLineTotal, MAX_QUANTITY, type DraftLine } from '../hooks/order-draft.js';
import { Stepper } from './Stepper.js';

export const NOTE_MAX = 140;

/** Mínimo real de un grupo: un grupo obligatorio pide al menos 1 */
export const groupMin = (g: ModifierGroup) => Math.max(g.minSelect, g.required ? 1 : 0);

export function groupHint(g: ModifierGroup): string {
  const min = groupMin(g);
  if (g.maxSelect === 1) return min === 1 ? 'Elige 1 (obligatorio)' : 'Elige 1 (opcional)';
  if (min > 0) return `Elige de ${min} a ${g.maxSelect}`;
  return `Hasta ${g.maxSelect} (opcional)`;
}

export interface ProductDialogProps {
  product: Product | null;
  groups: ModifierGroup[];
  onClose: () => void;
  onAdd: (line: DraftLine) => void;
}

export function ProductDialog({ product, groups, onClose, onAdd }: ProductDialogProps) {
  return (
    <Modal open={product !== null} onClose={onClose} title={product?.name ?? 'Producto'}>
      {product && <ProductForm key={product.id} product={product} groups={groups} onAdd={onAdd} />}
    </Modal>
  );
}

function ProductForm({
  product,
  groups,
  onAdd,
}: {
  product: Product;
  groups: ModifierGroup[];
  onAdd: (line: DraftLine) => void;
}) {
  const regional = useRegional();
  const [chosen, setChosen] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const toggle = (g: ModifierGroup, modifierId: string) => {
    setChosen((c) => {
      const current = c[g.id] ?? [];
      if (g.maxSelect === 1) return { ...c, [g.id]: current[0] === modifierId ? [] : [modifierId] };
      if (current.includes(modifierId)) {
        return { ...c, [g.id]: current.filter((id) => id !== modifierId) };
      }
      return current.length >= g.maxSelect ? c : { ...c, [g.id]: [...current, modifierId] };
    });
  };

  const missing = groups.filter((g) => (chosen[g.id] ?? []).length < groupMin(g));
  const modifiers = groups.flatMap((g) =>
    g.modifiers
      .filter((m) => (chosen[g.id] ?? []).includes(m.id))
      .map((m) => ({ modifierId: m.id, name: m.name, priceDelta: m.priceDelta })),
  );
  const line: DraftLine = {
    key: newId(),
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity,
    modifiers,
    note,
  };

  const add = () => {
    setTried(true);
    if (missing.length === 0) onAdd(line);
  };

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => {
        const selected = chosen[g.id] ?? [];
        const invalid = tried && selected.length < groupMin(g);
        return (
          <fieldset key={g.id} className="flex flex-col gap-2" aria-invalid={invalid || undefined}>
            <legend className="mb-2 flex w-full flex-wrap items-baseline justify-between gap-2">
              <span className="text-base font-bold">{g.name}</span>
              <span
                className={cx('text-sm', invalid ? 'font-semibold text-error' : 'text-secondary')}
              >
                {groupHint(g)}
              </span>
            </legend>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
              {g.modifiers.map((m) => {
                const on = selected.includes(m.id);
                const soldOut = m.status !== 'ACTIVE';
                const full = !on && g.maxSelect > 1 && selected.length >= g.maxSelect;
                return (
                  <label
                    key={m.id}
                    className={cx(
                      'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-base',
                      on ? 'border-2 border-primary bg-surface font-semibold' : 'border-accent',
                      (soldOut || full) && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <input
                      type={g.maxSelect === 1 ? 'radio' : 'checkbox'}
                      name={g.id}
                      checked={on}
                      disabled={soldOut || full}
                      onChange={() => toggle(g, m.id)}
                      onClick={() => {
                        // Un radio marcado no se desmarca solo: en un grupo opcional sí se puede quitar
                        if (g.maxSelect === 1 && on && groupMin(g) === 0) toggle(g, m.id);
                      }}
                      className="size-5 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">{m.name}</span>
                    {soldOut ? (
                      <span className="text-sm">Agotado</span>
                    ) : (
                      m.priceDelta !== '0.00' && (
                        <span className="text-sm tabular">
                          +{formatMoney(m.priceDelta, regional)}
                        </span>
                      )
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <Stepper
        label="Cantidad"
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={MAX_QUANTITY}
      />

      <TextInput
        label="Nota para cocina"
        value={note}
        maxLength={NOTE_MAX}
        autoComplete="off"
        placeholder="Ej. sin cebolla"
        onChange={(e) => setNote(e.target.value)}
      />

      {tried && missing.length > 0 && (
        <p role="alert" className="text-base">
          Falta elegir: {missing.map((g) => g.name).join(', ')}.
        </p>
      )}

      <Button size="lg" fullWidth onClick={add}>
        Agregar · {formatMoney(draftLineTotal(line), regional)}
      </Button>
    </div>
  );
}
