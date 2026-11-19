// Editor de un producto (RF-011, RF-013 a RF-016): datos, modificadores, foto y combo.
import type { ComboGroup, MenuResponse, Product } from '@mise/shared/contracts/catalog';
import { ImageUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { Button, Card, Select, Switch, TextInput } from '../../../core/ui/index.js';
import {
  toMoney,
  useSaveComboGroups,
  useSaveProduct,
  useUploadProductImage,
  type ProductDraft,
} from '../api/admin-api.js';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Disponible' },
  { value: 'SOLD_OUT', label: 'Agotado' },
  { value: 'INACTIVE', label: 'Inactivo (no aparece al tomar pedidos)' },
];

function errorText(e: unknown) {
  return e instanceof ApiError ? e.message : e ? 'No se pudo guardar' : null;
}

export function ProductEditor({
  menu,
  product,
  categoryId,
  onClose,
}: {
  menu: MenuResponse;
  product: Product | null;
  categoryId: string;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ProductDraft>(
    product
      ? {
          categoryId: product.categoryId,
          name: product.name,
          shortDescription: product.shortDescription,
          sku: product.sku,
          price: product.price,
          isCombo: product.isCombo,
          status: product.status,
          modifierGroupIds: product.modifierGroupIds,
        }
      : {
          categoryId,
          name: '',
          shortDescription: null,
          sku: '',
          price: '',
          isCombo: false,
          status: 'ACTIVE',
          modifierGroupIds: [],
        },
  );
  const [price, setPrice] = useState(product?.price ?? '');
  const save = useSaveProduct();
  const image = useUploadProductImage();
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) =>
    setDraft({ ...draft, [k]: v });
  const money = toMoney(price);
  const valid = draft.name.trim() && draft.sku.trim() && money;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">
          {product ? `Editar ${product.name}` : 'Nuevo producto'}
        </h2>
        <Button variant="outline" onClick={onClose}>
          Volver a la lista
        </Button>
      </header>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          save.mutate(
            {
              id: product?.id,
              draft: { ...draft, name: draft.name.trim(), sku: draft.sku.trim(), price: money },
            },
            { onSuccess: onClose },
          );
        }}
      >
        <TextInput
          label="Nombre"
          value={draft.name}
          maxLength={80}
          onChange={(e) => set('name', e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput
            label="Precio (impuestos incluidos)"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={price && !money ? 'Escribe un monto como 58 o 58.50' : undefined}
          />
          <TextInput
            label="Código interno (SKU)"
            value={draft.sku}
            maxLength={30}
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(e) => set('sku', e.target.value.toUpperCase())}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Categoría"
            value={draft.categoryId}
            options={menu.categories.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(e) => set('categoryId', e.target.value)}
          />
          <Select
            label="Estado"
            value={draft.status}
            options={STATUS_OPTIONS}
            onChange={(e) => set('status', e.target.value as Product['status'])}
          />
        </div>
        <TextInput
          label="Descripción corta"
          hint="Opcional"
          value={draft.shortDescription ?? ''}
          maxLength={200}
          onChange={(e) => set('shortDescription', e.target.value || null)}
        />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">Modificadores</legend>
          {menu.modifierGroups.length === 0 && (
            <p className="text-sm text-secondary">No hay grupos de modificadores.</p>
          )}
          {menu.modifierGroups.map((g) => (
            <label
              key={g.id}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-surface"
            >
              <input
                type="checkbox"
                className="size-5"
                checked={draft.modifierGroupIds.includes(g.id)}
                onChange={(e) =>
                  set(
                    'modifierGroupIds',
                    e.target.checked
                      ? [...draft.modifierGroupIds, g.id]
                      : draft.modifierGroupIds.filter((id) => id !== g.id),
                  )
                }
              />
              <span className="text-base">{g.name}</span>
              <span className="text-sm text-secondary">
                {g.required ? 'Obligatorio' : 'Opcional'} ·{' '}
                {g.modifiers.filter((m) => m.status !== 'INACTIVE').length} opciones
              </span>
            </label>
          ))}
        </fieldset>

        <Switch
          label="Es un combo"
          hint="Producto con componentes a elegir, ej. plato + bebida"
          checked={draft.isCombo}
          onChange={(v) => set('isCombo', v)}
        />

        {errorText(save.error) && (
          <p role="alert" className="rounded-md border-2 border-error px-4 py-3 text-base">
            {errorText(save.error)}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={!valid} loading={save.isPending}>
            {product ? 'Guardar producto' : 'Crear producto'}
          </Button>
        </div>
      </form>

      {product && (
        <section className="flex flex-col gap-3 border-t border-accent pt-6">
          <h3 className="text-base font-bold">Foto</h3>
          <div className="flex items-center gap-4">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                width={96}
                height={96}
                className="size-24 rounded-md border border-accent object-cover"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-md border border-dashed border-secondary text-sm text-secondary">
                Sin foto
              </span>
            )}
            <label className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-md border border-secondary px-4 text-base font-semibold text-secondary hover:bg-surface">
              <ImageUp aria-hidden className="size-5" />
              {image.isPending ? 'Subiendo…' : product.imageUrl ? 'Cambiar foto' : 'Subir foto'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) image.mutate({ id: product.id, file });
                }}
              />
            </label>
          </div>
          {errorText(image.error) && (
            <p role="alert" className="text-sm">
              {errorText(image.error)}
            </p>
          )}
        </section>
      )}

      {product?.isCombo && <ComboEditor menu={menu} product={product} />}
    </div>
  );
}

function ComboEditor({ menu, product }: { menu: MenuResponse; product: Product }) {
  const [groups, setGroups] = useState<ComboGroup[]>(product.comboGroups);
  const save = useSaveComboGroups();
  const choices = menu.products.filter((p) => !p.isCombo && p.status !== 'INACTIVE');
  const update = (i: number, g: ComboGroup) => setGroups(groups.map((x, j) => (j === i ? g : x)));

  return (
    <section className="flex flex-col gap-4 border-t border-accent pt-6">
      <header className="flex flex-col gap-1">
        <h3 className="text-base font-bold">Componentes del combo</h3>
        <p className="text-sm text-secondary">
          Cada grupo es una elección del cliente, ej. "Bebida: horchata o limonada".
        </p>
      </header>
      {groups.map((g, i) => (
        <Card key={i} variant="outlined" className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-end">
            <TextInput
              label="Grupo"
              value={g.name}
              onChange={(e) => update(i, { ...g, name: e.target.value })}
            />
            <TextInput
              label="Mínimo"
              type="number"
              min={0}
              value={g.minSelect}
              onChange={(e) => update(i, { ...g, minSelect: Number(e.target.value) })}
            />
            <TextInput
              label="Máximo"
              type="number"
              min={1}
              value={g.maxSelect}
              onChange={(e) => update(i, { ...g, maxSelect: Number(e.target.value) })}
            />
            <Button
              variant="outline"
              icon={<Trash2 />}
              aria-label={`Quitar grupo ${g.name}`}
              onClick={() => setGroups(groups.filter((_, j) => j !== i))}
            >
              Quitar
            </Button>
          </div>
          <ul className="flex flex-col gap-2">
            {g.options.map((o, k) => (
              <li key={k} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                <Select
                  label="Opción"
                  value={o.productId}
                  options={choices.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={(e) =>
                    update(i, {
                      ...g,
                      options: g.options.map((x, m) =>
                        m === k ? { ...x, productId: e.target.value } : x,
                      ),
                    })
                  }
                />
                <TextInput
                  label="Recargo"
                  inputMode="decimal"
                  value={o.priceDelta}
                  onChange={(e) =>
                    update(i, {
                      ...g,
                      options: g.options.map((x, m) =>
                        m === k ? { ...x, priceDelta: e.target.value } : x,
                      ),
                    })
                  }
                />
                <label className="flex min-h-12 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`default-${i}`}
                    className="size-5"
                    checked={o.isDefault}
                    onChange={() =>
                      update(i, {
                        ...g,
                        options: g.options.map((x, m) => ({ ...x, isDefault: m === k })),
                      })
                    }
                  />
                  Por defecto
                </label>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            icon={<Plus />}
            disabled={choices.length === 0}
            onClick={() =>
              update(i, {
                ...g,
                options: [
                  ...g.options,
                  {
                    productId: choices[0]!.id,
                    priceDelta: '0.00',
                    isDefault: g.options.length === 0,
                  },
                ],
              })
            }
          >
            Agregar opción
          </Button>
        </Card>
      ))}
      <div className="flex flex-wrap justify-between gap-3">
        <Button
          variant="outline"
          icon={<Plus />}
          onClick={() =>
            setGroups([...groups, { name: '', minSelect: 1, maxSelect: 1, options: [] }])
          }
        >
          Agregar grupo
        </Button>
        <Button
          variant="secondary"
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              id: product.id,
              groups: groups.map((g) => ({
                ...g,
                options: g.options.map((o) => ({
                  ...o,
                  priceDelta: toMoney(o.priceDelta) ?? '0.00',
                })),
              })),
            })
          }
        >
          Guardar componentes
        </Button>
      </div>
      {save.isSuccess && <p className="text-sm">Componentes guardados.</p>}
      {errorText(save.error) && (
        <p role="alert" className="text-sm">
          {errorText(save.error)}
        </p>
      )}
    </section>
  );
}
