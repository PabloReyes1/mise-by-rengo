// Configuración › Insumos (permiso config.recipes; H3 #22). Dueño: Deniscito; reasignado a Pablito
// (Docs/17 §3.1). Cada insumo se costea por su unidad base (RF-130). Cambiar el costo deja historial
// y muestra los productos cuyo costo cambió, con su alerta si quedaron bajo el objetivo (RF-138).
import type {
  CostedProduct,
  Ingredient,
  SetIngredientCostResponse,
  Unit,
} from '@mise/shared/contracts/recipes';
import { newId } from '@mise/shared/domain/ids';
import { History, Pencil, Plus, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatCost, formatDateTime, toQuantity } from '../../../core/format/index.js';
import { Badge, Button, Modal, Select, Switch, TextInput } from '../../../core/ui/index.js';
import {
  useCreateIngredient,
  useIngredientCosts,
  useIngredients,
  useSetIngredientCost,
  useUnits,
  useUpdateIngredient,
} from '../api/recipes-api.js';

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : e ? 'No se pudo guardar' : null;
}

const unitLabel = (u: Unit | undefined) => (u ? u.name.toLowerCase() : '');

export function IngredientsPage() {
  const ingredients = useIngredients();
  const units = useUnits();
  const regional = useRegional();
  // id del insumo que se edita ('new' = nuevo) y del que se le cambia el costo
  const [editing, setEditing] = useState<string | null>(null);
  const [costing, setCosting] = useState<string | null>(null);

  if (ingredients.isPending || units.isPending)
    return <p className="text-base text-secondary">Cargando insumos…</p>;
  if (ingredients.error || units.error || !ingredients.data || !units.data)
    return <p role="alert">No se pudieron cargar los insumos.</p>;

  const unitById = new Map(units.data.map((u) => [u.id, u]));
  const current = ingredients.data.find((i) => i.id === editing) ?? null;
  const costed = ingredients.data.find((i) => i.id === costing) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">Insumos</h1>
          <p className="text-base text-secondary">
            Lo que se usa en las recetas, con su costo por unidad. Al cambiar un costo se recalculan
            las recetas que lo usan.
          </p>
        </div>
        <Button icon={<Plus />} onClick={() => setEditing('new')}>
          Nuevo insumo
        </Button>
      </header>

      {ingredients.data.length === 0 ? (
        <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
          Todavía no hay insumos. Crea el primero, ej. &quot;Tomate&quot; por kilogramo.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface rounded-md border border-surface bg-background">
          {ingredients.data.map((i) => {
            const unit = unitById.get(i.baseUnitId);
            return (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={i.active ? 'text-base font-semibold' : 'text-base text-secondary'}
                    >
                      {i.name}
                    </span>
                    {i.category && <Badge tone="neutral">{i.category}</Badge>}
                    {!i.active && <Badge tone="neutral">Inactivo</Badge>}
                  </div>
                  <span className="text-sm text-secondary">
                    {formatCost(i.unitCost, regional)} por {unitLabel(unit)}
                    {' · '}
                    {i.recipeCount === 0
                      ? 'Sin recetas'
                      : i.recipeCount === 1
                        ? 'En 1 receta'
                        : `En ${i.recipeCount} recetas`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    icon={<History />}
                    aria-label={`Cambiar el costo de ${i.name}`}
                    onClick={() => setCosting(i.id)}
                  >
                    Costo
                  </Button>
                  <Button
                    variant="outline"
                    icon={<Pencil />}
                    aria-label={`Editar ${i.name}`}
                    onClick={() => setEditing(i.id)}
                  >
                    Editar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (editing === 'new' || current) && (
        <IngredientDialog
          key={editing}
          ingredient={current}
          units={units.data}
          onClose={() => setEditing(null)}
        />
      )}
      {costed && (
        <CostDialog
          key={costed.id}
          ingredient={costed}
          unit={unitById.get(costed.baseUnitId)}
          onClose={() => setCosting(null)}
        />
      )}
    </div>
  );
}

function IngredientDialog({
  ingredient,
  units,
  onClose,
}: {
  ingredient: Ingredient | null;
  units: Unit[];
  onClose: () => void;
}) {
  const [name, setName] = useState(ingredient?.name ?? '');
  const [category, setCategory] = useState(ingredient?.category ?? '');
  const [baseUnitId, setBaseUnitId] = useState(
    ingredient?.baseUnitId ?? units.find((u) => u.code === 'kg')?.id ?? units[0]!.id,
  );
  const [cost, setCost] = useState('');
  const [active, setActive] = useState(ingredient?.active ?? true);
  const [id] = useState(() => ingredient?.id ?? newId());
  const create = useCreateIngredient();
  const update = useUpdateIngredient();

  const unitCost = cost.trim() === '0' ? '0' : toQuantity(cost);
  const costError =
    !ingredient && cost !== '' && !unitCost ? 'Escribe un costo, ej. 8.50' : undefined;
  const valid = name.trim().length > 0 && (ingredient !== null || unitCost !== null);
  const error = errorText(create.error ?? update.error);
  const inRecipes = (ingredient?.recipeCount ?? 0) > 0;
  const unit = units.find((u) => u.id === baseUnitId);

  const save = () => {
    if (!valid) return;
    const fields = { name: name.trim(), category: category.trim() || null, baseUnitId };
    if (ingredient)
      update.mutate({ id: ingredient.id, body: { ...fields, active } }, { onSuccess: onClose });
    else create.mutate({ id, ...fields, unitCost: unitCost! }, { onSuccess: onClose });
  };

  return (
    <Modal open onClose={onClose} title={ingredient ? ingredient.name : 'Nuevo insumo'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <TextInput
          label="Nombre"
          hint='Ej. "Tomate", "Queso fresco", "Café molido"'
          value={name}
          maxLength={80}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          label="Categoría (opcional)"
          hint='Para ordenarlos. Ej. "Verduras", "Lácteos"'
          value={category}
          maxLength={40}
          onChange={(e) => setCategory(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Se compra y costea por"
            value={baseUnitId}
            disabled={inRecipes}
            hint={inRecipes ? 'Ya está en recetas: la unidad no se cambia' : undefined}
            options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.code})` }))}
            onChange={(e) => setBaseUnitId(e.target.value)}
          />
          {!ingredient && (
            <TextInput
              label={`Costo por ${unitLabel(unit)}`}
              inputMode="decimal"
              value={cost}
              error={costError}
              required
              onChange={(e) => setCost(e.target.value)}
            />
          )}
        </div>
        {ingredient && (
          <Switch
            label="Activo"
            hint="Inactivo ya no se ofrece para recetas nuevas; las que lo usan lo siguen costeando"
            checked={active}
            onChange={setActive}
          />
        )}
        {error && (
          <p
            role="alert"
            className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!valid} loading={create.isPending || update.isPending}>
            {ingredient ? 'Guardar' : 'Crear insumo'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CostDialog({
  ingredient,
  unit,
  onClose,
}: {
  ingredient: Ingredient;
  unit: Unit | undefined;
  onClose: () => void;
}) {
  const regional = useRegional();
  const history = useIngredientCosts(ingredient.id);
  const setCost = useSetIngredientCost();
  const [cost, setCostText] = useState('');
  const [result, setResult] = useState<SetIngredientCostResponse | null>(null);
  const unitCost = cost.trim() === '0' ? '0' : toQuantity(cost);
  const error = errorText(setCost.error);

  return (
    <Modal open onClose={onClose} title={`Costo de ${ingredient.name}`}>
      <div className="flex flex-col gap-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!unitCost) return;
            setCost.mutate(
              { id: ingredient.id, unitCost },
              {
                onSuccess: (r) => {
                  setResult(r);
                  setCostText('');
                },
              },
            );
          }}
        >
          <p className="text-base">
            Ahora: <strong>{formatCost(ingredient.unitCost, regional)}</strong> por{' '}
            {unitLabel(unit)}
          </p>
          <TextInput
            label={`Nuevo costo por ${unitLabel(unit)}`}
            inputMode="decimal"
            value={cost}
            error={cost !== '' && !unitCost ? 'Escribe un costo, ej. 8.50' : undefined}
            onChange={(e) => setCostText(e.target.value)}
          />
          {error && (
            <p
              role="alert"
              className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button type="submit" disabled={!unitCost} loading={setCost.isPending}>
              Guardar costo
            </Button>
          </div>
        </form>

        {result && <Affected products={result.affected} />}

        <section className="flex flex-col gap-2">
          <h3 className="text-base font-bold">Historial</h3>
          {history.data && history.data.length > 0 ? (
            <ul className="flex flex-col divide-y divide-surface text-sm">
              {history.data.map((h) => (
                <li key={h.validFrom} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-semibold">{formatCost(h.unitCost, regional)}</span>
                  <span className="text-secondary">
                    {formatDateTime(h.validFrom, regional)} · {h.setByName}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-secondary">
              {history.isPending ? 'Cargando…' : 'Sin cambios'}
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

/** Productos cuyo costo cambió (RF-138), con alerta si quedaron bajo el objetivo. */
function Affected({ products }: { products: CostedProduct[] }) {
  const regional = useRegional();
  return (
    <section role="status" className="flex flex-col gap-2 rounded-md bg-surface px-4 py-3">
      <h3 className="text-base font-bold">
        {products.length === 0
          ? 'Costo guardado. Ningún producto cambió de costo.'
          : `Costo guardado. Productos afectados: ${products.length}`}
      </h3>
      {products.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {products.map((p) => (
            <li key={p.productId} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{p.name}</span>
              <span>
                costo {formatCost(p.cost ?? '0', regional)}
                {p.foodCostPct !== null && ` (${p.foodCostPct} % del precio)`}
              </span>
              {p.belowTarget && (
                <Badge tone="error">
                  <TriangleAlert aria-hidden className="mr-1 size-3" />
                  Bajo el objetivo
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
