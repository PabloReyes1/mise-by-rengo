// Configuración › Menú (RF-010 a RF-016): categorías a la izquierda, productos a la derecha.
import type { Product } from '@mise/shared/contracts/catalog';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney } from '../../../core/format/index.js';
import { Badge, Button, cx, TextInput, type BadgeTone } from '../../../core/ui/index.js';
import { useMenu, useSaveCategory, useSetProductStatus } from '../api/admin-api.js';
import { ModifierGroupEditor } from '../components/ModifierGroupEditor.js';
import { ProductEditor } from '../components/ProductEditor.js';

const STATUS: Record<Product['status'], { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Disponible', tone: 'success' },
  SOLD_OUT: { label: 'Agotado', tone: 'warning' },
  INACTIVE: { label: 'Inactivo', tone: 'neutral' },
};

type View =
  | { kind: 'list' }
  | { kind: 'product'; product: Product | null }
  | { kind: 'group'; id: string | null };

export function MenuPage() {
  const menu = useMenu();
  const regional = useRegional();
  const [tab, setTab] = useState<'products' | 'modifiers'>('products');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [newCategory, setNewCategory] = useState('');
  const saveCategory = useSaveCategory();
  const setStatus = useSetProductStatus();

  if (menu.isPending) return <p className="text-base text-secondary">Cargando menú…</p>;
  if (menu.error || !menu.data) return <p role="alert">No se pudo cargar el menú.</p>;
  const data = menu.data;
  const current = data.categories.find((c) => c.id === categoryId) ?? data.categories[0] ?? null;
  const products = data.products.filter((p) => p.categoryId === current?.id);

  if (view.kind === 'product') {
    return (
      <ProductEditor
        menu={data}
        product={view.product}
        categoryId={current?.id ?? ''}
        onClose={() => setView({ kind: 'list' })}
      />
    );
  }
  if (view.kind === 'group') {
    return (
      <ModifierGroupEditor
        group={data.modifierGroups.find((g) => g.id === view.id) ?? null}
        onClose={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Menú</h1>
        <div
          role="tablist"
          aria-label="Sección del menú"
          className="flex rounded-md border border-secondary p-1"
        >
          {(['products', 'modifiers'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cx(
                'min-h-10 rounded-sm px-4 text-base font-semibold',
                tab === t ? 'bg-primary text-white' : 'text-secondary hover:bg-surface',
              )}
            >
              {t === 'products' ? 'Productos' : 'Modificadores'}
            </button>
          ))}
        </div>
      </header>

      {tab === 'products' ? (
        <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
          <aside className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-secondary">Categorías</h2>
            <ul className="flex gap-1 overflow-x-auto md:flex-col">
              {data.categories.map((c) => (
                <li key={c.id} className="shrink-0">
                  <button
                    type="button"
                    aria-current={c.id === current?.id || undefined}
                    onClick={() => setCategoryId(c.id)}
                    className={cx(
                      'flex min-h-12 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-base',
                      c.id === current?.id
                        ? 'bg-primary font-semibold text-white'
                        : 'hover:bg-surface',
                    )}
                  >
                    <span>{c.name}</span>
                    {!c.active && <Badge>Inactiva</Badge>}
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newCategory.trim())
                  saveCategory.mutate(
                    { name: newCategory.trim() },
                    { onSuccess: () => setNewCategory('') },
                  );
              }}
            >
              <TextInput
                label="Nueva categoría"
                value={newCategory}
                maxLength={60}
                onChange={(e) => setNewCategory(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                variant="outline"
                aria-label="Agregar categoría"
                icon={<Plus />}
                disabled={!newCategory.trim()}
                loading={saveCategory.isPending}
              >
                Agregar
              </Button>
            </form>
          </aside>

          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">{current?.name ?? 'Sin categorías'}</h2>
              <div className="flex gap-2">
                {current && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      saveCategory.mutate({
                        id: current.id,
                        name: current.name,
                        active: !current.active,
                      })
                    }
                  >
                    {current.active ? 'Desactivar categoría' : 'Activar categoría'}
                  </Button>
                )}
                <Button
                  icon={<Plus />}
                  disabled={!current}
                  onClick={() => setView({ kind: 'product', product: null })}
                >
                  Nuevo producto
                </Button>
              </div>
            </div>
            {setStatus.error && (
              <p role="alert" className="text-base">
                {setStatus.error instanceof ApiError
                  ? setStatus.error.message
                  : 'No se pudo cambiar el estado'}
              </p>
            )}
            {products.length === 0 ? (
              <p className="rounded-md bg-surface px-4 py-6 text-base text-secondary">
                Esta categoría no tiene productos. Usa “Nuevo producto” para agregar el primero.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-accent border-y border-accent">
                {products.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-semibold">
                        {p.name}
                        {p.isCombo && (
                          <span className="ml-2 align-middle">
                            <Badge>Combo</Badge>
                          </span>
                        )}
                      </span>
                      <span className="text-sm text-secondary tabular">{p.sku}</span>
                    </div>
                    <span className="w-24 text-right text-base font-semibold tabular">
                      {formatMoney(p.price, regional)}
                    </span>
                    <span className="w-24">
                      <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                    </span>
                    <div className="flex gap-2">
                      {p.status !== 'INACTIVE' && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setStatus.mutate({
                              id: p.id,
                              status: p.status === 'SOLD_OUT' ? 'ACTIVE' : 'SOLD_OUT',
                            })
                          }
                        >
                          {p.status === 'SOLD_OUT' ? 'Hay de nuevo' : 'Se agotó'}
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        icon={<Pencil />}
                        aria-label={`Editar ${p.name}`}
                        onClick={() => setView({ kind: 'product', product: p })}
                      >
                        Editar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button icon={<Plus />} onClick={() => setView({ kind: 'group', id: null })}>
              Nuevo grupo
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-accent border-y border-accent">
            {data.modifierGroups.map((g) => {
              const active = g.modifiers.filter((m) => m.status !== 'INACTIVE');
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-semibold">{g.name}</span>
                    <span className="truncate text-sm text-secondary">
                      {active.map((m) => m.name).join(', ') || 'Sin opciones'}
                    </span>
                  </div>
                  <span className="text-sm">
                    {g.required ? 'Obligatorio' : 'Opcional'} · elige{' '}
                    {g.minSelect === g.maxSelect ? g.maxSelect : `${g.minSelect} a ${g.maxSelect}`}
                  </span>
                  <Button
                    variant="secondary"
                    icon={<Pencil />}
                    aria-label={`Editar ${g.name}`}
                    onClick={() => setView({ kind: 'group', id: g.id })}
                  >
                    Editar
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
