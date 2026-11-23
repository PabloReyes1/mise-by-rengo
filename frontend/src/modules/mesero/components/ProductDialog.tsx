// Agregar un producto al pedido: modificadores por grupo, cantidad y nota (Docs/05 paso 3).
// Las reglas del grupo (obligatorio, mínimo, máximo) se cumplen aquí antes de agregar; el
// servidor las vuelve a revisar al enviar (MODIFIER_RULES).
// Combos (SC-51, reasignado a Deniscito, doc 17 §3.1): se elige cada grupo del combo y los
// modificadores de cada componente elegido (ej. el tamaño de la horchata).
import type {
  MenuComboGroup,
  MenuResponse,
  ModifierGroup,
  Product,
} from '@mise/shared/contracts/catalog';
import { newId } from '@mise/shared/domain/ids';
import { useState } from 'react';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney } from '../../../core/format/index.js';
import { Button, cx, Modal, TextInput } from '../../../core/ui/index.js';
import {
  draftLineTotal,
  MAX_QUANTITY,
  type DraftComponent,
  type DraftLine,
} from '../hooks/order-draft.js';
import { Stepper } from './Stepper.js';

export const NOTE_MAX = 140;

/** Mínimo real de un grupo: un grupo obligatorio pide al menos 1 */
export const groupMin = (g: ModifierGroup) => Math.max(g.minSelect, g.required ? 1 : 0);

export function groupHint(g: Pick<ModifierGroup, 'maxSelect'> & { min: number }): string {
  if (g.maxSelect === 1) return g.min === 1 ? 'Elige 1 (obligatorio)' : 'Elige 1 (opcional)';
  if (g.min > 0) return `Elige de ${g.min} a ${g.maxSelect}`;
  return `Hasta ${g.maxSelect} (opcional)`;
}

export interface ProductDialogProps {
  product: Product | null;
  groups: ModifierGroup[];
  /** Para los combos: productos y grupos de sus componentes */
  menu?: MenuResponse | undefined;
  onClose: () => void;
  onAdd: (line: DraftLine) => void;
}

export function ProductDialog({ product, groups, menu, onClose, onAdd }: ProductDialogProps) {
  return (
    <Modal open={product !== null} onClose={onClose} title={product?.name ?? 'Producto'}>
      {product && (
        <ProductForm key={product.id} product={product} groups={groups} menu={menu} onAdd={onAdd} />
      )}
    </Modal>
  );
}

type Chosen = Record<string, string[]>;

/** Marca o desmarca una opción respetando el máximo del grupo. */
function toggleIn(chosen: Chosen, key: string, maxSelect: number, id: string): Chosen {
  const current = chosen[key] ?? [];
  if (maxSelect === 1) return { ...chosen, [key]: current[0] === id ? [] : [id] };
  if (current.includes(id)) return { ...chosen, [key]: current.filter((x) => x !== id) };
  return current.length >= maxSelect ? chosen : { ...chosen, [key]: [...current, id] };
}

interface Choice {
  id: string;
  name: string;
  priceDelta: string;
  soldOut: boolean;
}

/** Un grupo de opciones (modificadores o componentes del combo) con radio o casillas. */
function ChoiceGroup({
  name,
  title,
  hint,
  invalid,
  maxSelect,
  min,
  choices,
  selected,
  onToggle,
  small,
}: {
  name: string;
  title: string;
  hint: string;
  invalid: boolean;
  maxSelect: number;
  min: number;
  choices: Choice[];
  selected: string[];
  onToggle: (id: string) => void;
  small?: boolean;
}) {
  const regional = useRegional();
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={invalid || undefined}>
      <legend className="mb-2 flex w-full flex-wrap items-baseline justify-between gap-2">
        <span className={cx('font-bold', small ? 'text-sm' : 'text-base')}>{title}</span>
        <span className={cx('text-sm', invalid ? 'font-semibold text-error' : 'text-secondary')}>
          {hint}
        </span>
      </legend>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {choices.map((m) => {
          const on = selected.includes(m.id);
          const full = !on && maxSelect > 1 && selected.length >= maxSelect;
          return (
            <label
              key={m.id}
              className={cx(
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-base',
                on ? 'border-2 border-primary bg-surface font-semibold' : 'border-accent',
                (m.soldOut || full) && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type={maxSelect === 1 ? 'radio' : 'checkbox'}
                name={name}
                checked={on}
                disabled={m.soldOut || full}
                onChange={() => onToggle(m.id)}
                onClick={() => {
                  // Un radio marcado no se desmarca solo: en un grupo opcional sí se puede quitar
                  if (maxSelect === 1 && on && min === 0) onToggle(m.id);
                }}
                className="size-5 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">{m.name}</span>
              {m.soldOut ? (
                <span className="text-sm">Agotado</span>
              ) : (
                m.priceDelta !== '0.00' && (
                  <span className="text-sm tabular">+{formatMoney(m.priceDelta, regional)}</span>
                )
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const modifierChoices = (g: ModifierGroup): Choice[] =>
  g.modifiers
    .filter((m) => m.status !== 'INACTIVE')
    .map((m) => ({
      id: m.id,
      name: m.name,
      priceDelta: m.priceDelta,
      soldOut: m.status !== 'ACTIVE',
    }));

function ProductForm({
  product,
  groups,
  menu,
  onAdd,
}: {
  product: Product;
  groups: ModifierGroup[];
  menu?: MenuResponse | undefined;
  onAdd: (line: DraftLine) => void;
}) {
  const regional = useRegional();
  // Clave de "chosen": id del grupo de modificadores del producto; en combos, "c:<grupoCombo>"
  // para los componentes y "m:<grupoCombo>:<producto>:<grupoModificadores>" para sus modificadores
  const [chosen, setChosen] = useState<Chosen>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const productById = new Map((menu?.products ?? []).map((p) => [p.id, p]));
  const groupById = new Map((menu?.modifierGroups ?? []).map((g) => [g.id, g]));
  const comboGroups: MenuComboGroup[] = product.isCombo ? product.comboGroups : [];

  // Componentes elegidos con los grupos de modificadores de cada uno
  const picked = comboGroups.flatMap((cg) =>
    (chosen[`c:${cg.id}`] ?? []).flatMap((productId) => {
      const option = cg.options.find((o) => o.productId === productId);
      const p = productById.get(productId);
      if (!option || !p) return [];
      const optionGroups = p.modifierGroupIds.flatMap((gid) => groupById.get(gid) ?? []);
      return [{ cg, option, product: p, optionGroups }];
    }),
  );
  const componentKey = (cgId: string, productId: string, groupId: string) =>
    `m:${cgId}:${productId}:${groupId}`;

  const missing = [
    ...groups.filter((g) => (chosen[g.id] ?? []).length < groupMin(g)).map((g) => g.name),
    ...comboGroups
      .filter((cg) => (chosen[`c:${cg.id}`] ?? []).length < cg.minSelect)
      .map((cg) => cg.name),
    ...picked.flatMap(({ cg, product: p, optionGroups }) =>
      optionGroups
        .filter((g) => (chosen[componentKey(cg.id, p.id, g.id)] ?? []).length < groupMin(g))
        .map((g) => `${g.name} (${p.name})`),
    ),
  ];

  const pickModifiers = (list: ModifierGroup[], keyOf: (g: ModifierGroup) => string) =>
    list.flatMap((g) =>
      g.modifiers
        .filter((m) => (chosen[keyOf(g)] ?? []).includes(m.id))
        .map((m) => ({ modifierId: m.id, name: m.name, priceDelta: m.priceDelta })),
    );

  const components: DraftComponent[] = picked.map(({ cg, option, product: p, optionGroups }) => ({
    comboGroupId: cg.id,
    productId: p.id,
    name: p.name,
    priceDelta: option.priceDelta,
    modifiers: pickModifiers(optionGroups, (g) => componentKey(cg.id, p.id, g.id)),
  }));

  const line: DraftLine = {
    key: newId(),
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity,
    modifiers: pickModifiers(groups, (g) => g.id),
    ...(product.isCombo ? { components } : {}),
    note,
  };

  const add = () => {
    setTried(true);
    if (missing.length === 0) onAdd(line);
  };

  return (
    <div className="flex flex-col gap-6">
      {comboGroups.map((cg) => {
        const key = `c:${cg.id}`;
        const selected = chosen[key] ?? [];
        return (
          <div key={cg.id} className="flex flex-col gap-3">
            <ChoiceGroup
              name={key}
              title={cg.name}
              hint={groupHint({ maxSelect: cg.maxSelect, min: cg.minSelect })}
              invalid={tried && selected.length < cg.minSelect}
              maxSelect={cg.maxSelect}
              min={cg.minSelect}
              selected={selected}
              onToggle={(id) => setChosen((c) => toggleIn(c, key, cg.maxSelect, id))}
              choices={cg.options.flatMap((o) => {
                const p = productById.get(o.productId);
                return p && p.status !== 'INACTIVE'
                  ? [
                      {
                        id: p.id,
                        name: p.name,
                        priceDelta: o.priceDelta,
                        soldOut: p.status !== 'ACTIVE',
                      },
                    ]
                  : [];
              })}
            />
            {/* Modificadores de lo que se eligió en este grupo (ej. tamaño de la bebida) */}
            {picked
              .filter((x) => x.cg.id === cg.id)
              .flatMap(({ product: p, optionGroups }) =>
                optionGroups.map((g) => {
                  const mKey = componentKey(cg.id, p.id, g.id);
                  const sel = chosen[mKey] ?? [];
                  return (
                    <div key={mKey} className="border-l-2 border-accent pl-3">
                      <ChoiceGroup
                        small
                        name={mKey}
                        title={`${p.name}: ${g.name}`}
                        hint={groupHint({ maxSelect: g.maxSelect, min: groupMin(g) })}
                        invalid={tried && sel.length < groupMin(g)}
                        maxSelect={g.maxSelect}
                        min={groupMin(g)}
                        selected={sel}
                        onToggle={(id) => setChosen((c) => toggleIn(c, mKey, g.maxSelect, id))}
                        choices={modifierChoices(g)}
                      />
                    </div>
                  );
                }),
              )}
          </div>
        );
      })}

      {groups.map((g) => {
        const selected = chosen[g.id] ?? [];
        return (
          <ChoiceGroup
            key={g.id}
            name={g.id}
            title={g.name}
            hint={groupHint({ maxSelect: g.maxSelect, min: groupMin(g) })}
            invalid={tried && selected.length < groupMin(g)}
            maxSelect={g.maxSelect}
            min={groupMin(g)}
            selected={selected}
            onToggle={(id) => setChosen((c) => toggleIn(c, g.id, g.maxSelect, id))}
            choices={g.modifiers.map((m) => ({
              id: m.id,
              name: m.name,
              priceDelta: m.priceDelta,
              soldOut: m.status !== 'ACTIVE',
            }))}
          />
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
          Falta elegir: {missing.join(', ')}.
        </p>
      )}

      <Button size="lg" fullWidth onClick={add}>
        Agregar · {formatMoney(draftLineTotal(line), regional)}
      </Button>
    </div>
  );
}
