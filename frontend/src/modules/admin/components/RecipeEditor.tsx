// Receta de un producto o de un modificador (RF-132; H3 #22). Dueño: Deniscito; reasignado a
// Pablito. Cada línea: insumo, cantidad, unidad (de la misma dimensión que la unidad base del
// insumo, SC-67) y merma %. El costo lo calcula el servidor al guardar; sin líneas se borra.
import type { Ingredient, Recipe, Unit } from '@mise/shared/contracts/recipes';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatCost, toQuantity } from '../../../core/format/index.js';
import { Button, Modal, NumberInput, Select, TextInput } from '../../../core/ui/index.js';
import {
  useIngredients,
  usePutRecipe,
  useRecipe,
  useUnits,
  type RecipeOwner,
} from '../api/recipes-api.js';

interface Line {
  key: number;
  ingredientId: string;
  quantity: string;
  unitId: string;
  wastePct: number;
}

let nextKey = 1;

export function RecipeDialog({
  owner,
  title,
  hint,
  children,
  onClose,
}: {
  owner: RecipeOwner;
  title: string;
  hint?: string;
  /** Debajo de la receta (ej. el objetivo del producto) */
  children?: ReactNode;
  onClose: () => void;
}) {
  const recipe = useRecipe(owner);
  const ingredients = useIngredients();
  const units = useUnits();

  return (
    <Modal open onClose={onClose} title={title} className="w-[min(48rem,calc(100vw-2rem))]!">
      {recipe.isPending || ingredients.isPending || units.isPending ? (
        <p className="text-base text-secondary">Cargando receta…</p>
      ) : !ingredients.data || !units.data || recipe.error ? (
        <p role="alert">No se pudo cargar la receta.</p>
      ) : (
        <RecipeForm
          owner={owner}
          recipe={recipe.data ?? null}
          ingredients={ingredients.data}
          units={units.data}
          hint={hint}
          onClose={onClose}
        >
          {children}
        </RecipeForm>
      )}
    </Modal>
  );
}

function RecipeForm({
  owner,
  recipe,
  ingredients,
  units,
  hint,
  children,
  onClose,
}: {
  owner: RecipeOwner;
  recipe: Recipe | null;
  ingredients: Ingredient[];
  units: Unit[];
  hint: string | undefined;
  children: ReactNode;
  onClose: () => void;
}) {
  const regional = useRegional();
  const put = usePutRecipe(owner);
  const [lines, setLines] = useState<Line[]>(() =>
    (recipe?.lines ?? []).map((l) => ({
      key: nextKey++,
      ingredientId: l.ingredientId,
      quantity: l.quantity,
      unitId: l.unitId,
      wastePct: Math.round(l.wastePct),
    })),
  );
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const ingredientById = new Map(ingredients.map((i) => [i.id, i]));
  const error =
    put.error instanceof ApiError ? put.error.message : put.error ? 'No se pudo guardar' : null;

  /** Unidades que sirven para el insumo: las de la dimensión de su unidad base. */
  const unitsFor = (ingredientId: string) => {
    const base = unitById.get(ingredientById.get(ingredientId)?.baseUnitId ?? '');
    return base ? units.filter((u) => u.dimension === base.dimension) : units;
  };

  const change = (key: number, patch: Partial<Line>) => {
    setDirty(true);
    setSaved(false);
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const add = () => {
    const used = new Set(lines.map((l) => l.ingredientId));
    const first = ingredients.find((i) => i.active && !used.has(i.id));
    if (!first) return;
    setDirty(true);
    setSaved(false);
    setLines((ls) => [
      ...ls,
      {
        key: nextKey++,
        ingredientId: first.id,
        quantity: '',
        unitId: first.baseUnitId,
        wastePct: 0,
      },
    ]);
  };

  const ids = lines.map((l) => l.ingredientId);
  const repeated = ids.some((id, i) => ids.indexOf(id) !== i);
  const valid = !repeated && lines.every((l) => toQuantity(l.quantity) !== null);
  const savedCost = (key: number) => {
    const l = lines.find((x) => x.key === key)!;
    return dirty ? null : recipe?.lines.find((r) => r.ingredientId === l.ingredientId)?.cost;
  };

  const save = () => {
    if (!valid) return;
    put.mutate(
      {
        lines: lines.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: toQuantity(l.quantity)!,
          unitId: l.unitId,
          wastePct: l.wastePct,
        })),
      },
      {
        onSuccess: () => {
          setDirty(false);
          setSaved(true);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {hint && <p className="text-sm text-secondary">{hint}</p>}
        {ingredients.length === 0 ? (
          <p className="rounded-md bg-surface px-4 py-3 text-base">
            Todavía no hay insumos: créalos en Configuración › Insumos.
          </p>
        ) : lines.length === 0 ? (
          <p className="rounded-md bg-surface px-4 py-3 text-base text-secondary">
            Sin receta. Agrega los insumos que lleva una porción.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {lines.map((l, i) => {
              const options = ingredients
                .filter((x) => x.active || x.id === l.ingredientId)
                .map((x) => ({ value: x.id, label: x.name }));
              const cost = savedCost(l.key);
              const quantityOk = l.quantity === '' || toQuantity(l.quantity) !== null;
              return (
                <li
                  key={l.key}
                  className="grid grid-cols-2 items-end gap-3 rounded-md border border-surface p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]"
                >
                  <Select
                    label={`Insumo ${i + 1}`}
                    value={l.ingredientId}
                    options={options}
                    className="col-span-2 sm:col-span-1"
                    error={ids.indexOf(l.ingredientId) !== i ? 'Ya está en la receta' : undefined}
                    onChange={(e) => {
                      const ing = ingredientById.get(e.target.value)!;
                      const fits = unitsFor(ing.id).some((u) => u.id === l.unitId);
                      change(l.key, {
                        ingredientId: ing.id,
                        unitId: fits ? l.unitId : ing.baseUnitId,
                      });
                    }}
                  />
                  <TextInput
                    label="Cantidad"
                    inputMode="decimal"
                    value={l.quantity}
                    error={quantityOk ? undefined : 'Ej. 120'}
                    onChange={(e) => change(l.key, { quantity: e.target.value })}
                  />
                  <Select
                    label="Unidad"
                    value={l.unitId}
                    options={unitsFor(l.ingredientId).map((u) => ({
                      value: u.id,
                      label: u.code,
                    }))}
                    onChange={(e) => change(l.key, { unitId: e.target.value })}
                  />
                  <NumberInput
                    label="Merma %"
                    value={l.wastePct}
                    min={0}
                    max={99}
                    onChange={(n) => change(l.key, { wastePct: n })}
                  />
                  <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                    {cost && (
                      <span className="text-sm text-secondary tabular">
                        {formatCost(cost, regional)}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      icon={<Trash2 />}
                      aria-label={`Quitar ${ingredientById.get(l.ingredientId)?.name ?? 'insumo'}`}
                      onClick={() => {
                        setDirty(true);
                        setSaved(false);
                        setLines((ls) => ls.filter((x) => x.key !== l.key));
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {ingredients.length > 0 && (
          <Button
            variant="outline"
            icon={<Plus />}
            onClick={add}
            disabled={!ingredients.some((x) => x.active && !ids.includes(x.id))}
            className="self-start"
          >
            Agregar insumo
          </Button>
        )}
        <p className="text-base">
          Costo de la receta:{' '}
          <strong className="tabular">
            {dirty ? 'se calcula al guardar' : formatCost(recipe?.cost ?? '0', regional)}
          </strong>
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
          >
            {error}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm">
            Receta guardada.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button type="submit" disabled={!valid || !dirty} loading={put.isPending}>
            Guardar receta
          </Button>
        </div>
      </form>
      {children}
    </div>
  );
}
