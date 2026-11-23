// Configuración › Costeo (permiso config.recipes; H3 #22). Dueño: Deniscito; reasignado a Pablito
// (Docs/17 §3.1). Por producto: costo de la receta, precio sugerido, margen real y alerta si el
// costo pasa el objetivo (RF-134 a RF-136). También las recetas de los modificadores.
import type { CostedProduct, CostTargetValues } from '@mise/shared/contracts/recipes';
import { DEFAULT_COST_TARGET } from '@mise/shared/contracts/recipes';
import { ChefHat, Target, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { usePublicConfig, useRegional } from '../../../core/config/index.js';
import { formatCost, formatMoney } from '../../../core/format/index.js';
import { Badge, Button, cx, Switch } from '../../../core/ui/index.js';
import { useMenu } from '../api/admin-api.js';
import { useCostTargets, useCosting, useModifierCosts } from '../api/recipes-api.js';
import {
  CostTargetDialog,
  describeTarget,
  type TargetScope,
} from '../components/CostTargetDialog.js';
import { RecipeDialog } from '../components/RecipeEditor.js';

type Tab = 'products' | 'modifiers';

const SCOPE_LABEL: Record<CostedProduct['targetScope'], string> = {
  PRODUCT: 'propio',
  CATEGORY: 'de la categoría',
  CLIENT: 'del restaurante',
  DEFAULT: 'del restaurante',
};

interface TargetEdit {
  target: TargetScope;
  title: string;
  current: CostTargetValues | null;
  inherited: CostTargetValues;
  inheritedFrom: string;
}

export function CostingPage() {
  const costing = useCosting();
  const targets = useCostTargets();
  const { data: config } = usePublicConfig();
  const symbol = config?.currencySymbol ?? 'Q';
  const [tab, setTab] = useState<Tab>('products');
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [recipeOf, setRecipeOf] = useState<CostedProduct | null>(null);
  const [targetEdit, setTargetEdit] = useState<TargetEdit | null>(null);

  if (costing.isPending || targets.isPending)
    return <p className="text-base text-secondary">Cargando costeo…</p>;
  if (costing.error || targets.error || !costing.data || !targets.data)
    return <p role="alert">No se pudo cargar el costeo.</p>;

  const client = targets.data.client ?? { ...DEFAULT_COST_TARGET };
  const categoryTarget = (id: string) =>
    targets.data.categories.find((c) => c.categoryId === id) ?? null;
  const productTarget = (id: string) =>
    targets.data.products.find((p) => p.productId === id) ?? null;

  const below = costing.data.filter((p) => p.belowTarget).length;
  const withoutRecipe = costing.data.filter((p) => !p.hasRecipe).length;
  const shown = onlyBelow ? costing.data.filter((p) => p.belowTarget) : costing.data;
  const categories = [...new Map(shown.map((p) => [p.categoryId, p.categoryName]))];

  // El producto que se está viendo, ya con los datos más nuevos
  const open = recipeOf && costing.data.find((p) => p.productId === recipeOf.productId);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Costeo</h1>
        <p className="text-base text-secondary">
          El costo de cada receta, el precio sugerido y el margen con el precio que tiene. El precio
          final siempre lo pones tú en Menú.
        </p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-secondary">Objetivo del restaurante</span>
          <span className="text-base font-semibold">
            Costo de hasta el {describeTarget(client, symbol)}
          </span>
          {!targets.data.client && (
            <span className="text-sm text-secondary">Valor inicial: cámbialo a tu medida</span>
          )}
        </div>
        <Button
          variant="outline"
          icon={<Target />}
          onClick={() =>
            setTargetEdit({
              target: { scope: 'CLIENT' },
              title: 'Objetivo del restaurante',
              current: client,
              inherited: client,
              inheritedFrom: 'del restaurante',
            })
          }
        >
          Cambiar
        </Button>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Qué costear" className="flex gap-1 rounded-md bg-surface p-1">
          {(
            [
              ['products', 'Productos'],
              ['modifiers', 'Modificadores'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={cx(
                'min-h-12 rounded-md px-4 text-base font-semibold',
                tab === value ? 'bg-primary text-white' : 'text-primary hover:bg-background',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'products' && (
          <Switch
            label={`Solo bajo el objetivo (${below})`}
            checked={onlyBelow}
            onChange={setOnlyBelow}
          />
        )}
      </div>

      {tab === 'products' ? (
        <>
          {withoutRecipe > 0 && !onlyBelow && (
            <p className="text-sm text-secondary">
              {withoutRecipe === 1
                ? '1 producto no tiene receta: no tiene costo ni alerta.'
                : `${withoutRecipe} productos no tienen receta: no tienen costo ni alerta.`}
            </p>
          )}
          {shown.length === 0 ? (
            <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
              {onlyBelow
                ? 'Ningún producto está bajo el objetivo.'
                : 'No hay productos en el menú.'}
            </p>
          ) : (
            categories.map(([categoryId, categoryName]) => {
              const own = categoryTarget(categoryId);
              return (
                <section key={categoryId} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-bold">{categoryName}</h2>
                    <Button
                      variant="outline"
                      icon={<Target />}
                      aria-label={`Objetivo de ${categoryName}`}
                      onClick={() =>
                        setTargetEdit({
                          target: { scope: 'CATEGORY', categoryId },
                          title: `Objetivo de ${categoryName}`,
                          current: own,
                          inherited: client,
                          inheritedFrom: 'del restaurante',
                        })
                      }
                    >
                      {own ? `Objetivo ${own.targetFoodCostPct} %` : 'Objetivo'}
                    </Button>
                  </div>
                  <ul className="flex flex-col divide-y divide-surface rounded-md border border-surface bg-background">
                    {shown
                      .filter((p) => p.categoryId === categoryId)
                      .map((p) => (
                        <ProductRow key={p.productId} product={p} onOpen={() => setRecipeOf(p)} />
                      ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      ) : (
        <ModifiersList />
      )}

      {open && (
        <RecipeDialog
          key={open.productId}
          owner={{ kind: 'products', id: open.productId }}
          title={`Receta: ${open.name}`}
          hint={
            open.isCombo
              ? 'Lo que lleva el combo además de sus componentes (ej. empaque). El costo de los componentes se suma solo, con su propia receta.'
              : 'Lo que lleva una porción.'
          }
          onClose={() => setRecipeOf(null)}
        >
          <ProductTarget
            product={open}
            own={productTarget(open.productId)}
            inherited={categoryTarget(open.categoryId) ?? client}
            inheritedFrom={categoryTarget(open.categoryId) ? 'de la categoría' : 'del restaurante'}
            symbol={symbol}
          />
        </RecipeDialog>
      )}
      {targetEdit && (
        <CostTargetDialog {...targetEdit} symbol={symbol} onClose={() => setTargetEdit(null)} />
      )}
    </div>
  );
}

function ProductRow({ product: p, onOpen }: { product: CostedProduct; onOpen: () => void }) {
  const regional = useRegional();
  const priceGap =
    p.suggestedPrice !== null && Number(p.suggestedPrice) > Number(p.price)
      ? p.suggestedPrice
      : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold">{p.name}</span>
          {p.isCombo && <Badge tone="neutral">Combo</Badge>}
          {!p.hasRecipe && <Badge tone="neutral">Sin receta</Badge>}
          {p.belowTarget && (
            <Badge tone="error">
              <TriangleAlert aria-hidden className="mr-1 size-3" />
              Bajo el objetivo
            </Badge>
          )}
        </div>
        <span className="text-sm text-secondary tabular">
          Precio {formatMoney(p.price, regional)}
          {p.cost !== null && (
            <>
              {' · '}Costo {formatCost(p.cost, regional)}
              {p.foodCostPct !== null &&
                ` (${p.foodCostPct} %, objetivo ${p.target.targetFoodCostPct} % ${SCOPE_LABEL[p.targetScope]})`}
              {p.marginPct !== null && ` · Margen ${p.marginPct} %`}
            </>
          )}
        </span>
        {p.suggestedPrice !== null && (
          <span className={cx('text-sm tabular', priceGap ? 'font-semibold' : 'text-secondary')}>
            Precio sugerido {formatMoney(p.suggestedPrice, regional)}
            {priceGap && ' (más que el precio actual)'}
          </span>
        )}
      </div>
      <Button
        variant="outline"
        icon={<ChefHat />}
        aria-label={`Receta de ${p.name}`}
        onClick={onOpen}
      >
        Receta
      </Button>
    </li>
  );
}

function ProductTarget({
  product,
  own,
  inherited,
  inheritedFrom,
  symbol,
}: {
  product: CostedProduct;
  own: CostTargetValues | null;
  inherited: CostTargetValues;
  inheritedFrom: string;
  symbol: string;
}) {
  const [editing, setEditing] = useState(false);
  const regional = useRegional();
  return (
    <section className="flex flex-col gap-2 border-t border-surface pt-4">
      <h3 className="text-base font-bold">Objetivo y precio</h3>
      <p className="text-sm">
        Objetivo {SCOPE_LABEL[product.targetScope]}: {describeTarget(product.target, symbol)}
      </p>
      {product.suggestedPrice !== null && (
        <p className="text-sm">
          Precio sugerido <strong>{formatMoney(product.suggestedPrice, regional)}</strong> · precio
          actual {formatMoney(product.price, regional)}
        </p>
      )}
      <Button
        variant="outline"
        icon={<Target />}
        className="self-start"
        onClick={() => setEditing(true)}
      >
        {own ? 'Cambiar su objetivo' : 'Ponerle su propio objetivo'}
      </Button>
      {editing && (
        <CostTargetDialog
          target={{ scope: 'PRODUCT', productId: product.productId }}
          title={`Objetivo de ${product.name}`}
          current={own}
          inherited={inherited}
          inheritedFrom={inheritedFrom}
          symbol={symbol}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}

function ModifiersList() {
  const menu = useMenu();
  const costs = useModifierCosts();
  const regional = useRegional();
  const [open, setOpen] = useState<{ id: string; name: string } | null>(null);

  if (menu.isPending || costs.isPending)
    return <p className="text-base text-secondary">Cargando modificadores…</p>;
  if (!menu.data || !costs.data)
    return <p role="alert">No se pudieron cargar los modificadores.</p>;

  const cost = new Map(costs.data.map((c) => [c.modifierId, c.cost]));
  const groups = menu.data.modifierGroups.filter((g) => g.modifiers.length > 0);

  return (
    <>
      <p className="text-sm text-secondary">
        La receta de un modificador (ej. &quot;Extra queso&quot;) se suma al costo del producto
        cuando se vende con él.
      </p>
      {groups.length === 0 ? (
        <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
          No hay modificadores en el menú.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.id} className="flex flex-col gap-2">
            <h2 className="text-lg font-bold">{g.name}</h2>
            <ul className="flex flex-col divide-y divide-surface rounded-md border border-surface bg-background">
              {g.modifiers.map((m) => {
                const c = cost.get(m.id);
                return (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold">{m.name}</span>
                        {!c && <Badge tone="neutral">Sin receta</Badge>}
                      </div>
                      <span className="text-sm text-secondary tabular">
                        {Number(m.priceDelta) > 0
                          ? `Cobra ${formatMoney(m.priceDelta, regional)} más`
                          : 'Sin cobro extra'}
                        {c && ` · Costo ${formatCost(c, regional)}`}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      icon={<ChefHat />}
                      aria-label={`Receta de ${m.name}`}
                      onClick={() => setOpen({ id: m.id, name: m.name })}
                    >
                      Receta
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {open && (
        <RecipeDialog
          key={open.id}
          owner={{ kind: 'modifiers', id: open.id }}
          title={`Receta: ${open.name}`}
          hint="Lo que agrega el modificador a una porción."
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
