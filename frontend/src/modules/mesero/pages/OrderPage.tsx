// Tomar el pedido (Docs/05 pasos 3 y 4, RF-040 a RF-046): menú por categoría, borrador guardado
// en el celular y envío a cocina por la outbox. Mobile first a 360 px (RNF-060).
import type { Product } from '@mise/shared/contracts/catalog';
import { newId } from '@mise/shared/domain/ids';
import { ArrowLeft, CircleAlert, Minus, Plus, Send, ShoppingBasket } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney } from '../../../core/format/index.js';
import { Button, cx, Modal, Select } from '../../../core/ui/index.js';
import { useAuthorizedAction } from '../api/authorized-action.js';
import { useFloor, useOccupancy } from '../api/floor-api.js';
import { useMenu, useOccupancyBills, useOccupancyOrders, useSendOrder } from '../api/order-api.js';
import { comandaTable, printDraftComanda, printOrderComanda } from '../components/comanda.js';
import { actionError } from '../components/errors.js';
import { occupancyTitle } from '../components/occupancy-title.js';
import { ProductDialog } from '../components/ProductDialog.js';
import {
  addLine,
  draftCount,
  draftLineTotal,
  draftTotal,
  MAX_QUANTITY,
  setQuantity,
  toSendOrder,
  type DraftLine,
} from '../hooks/order-draft.js';
import { useOrderDraft } from '../hooks/useOrderDraft.js';

export function OrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const regional = useRegional();
  const occupancy = useOccupancy(id);
  const floor = useFloor();
  const menu = useMenu();
  const bills = useOccupancyBills(id);
  const orders = useOccupancyOrders(id);
  const { draft, update, clear } = useOrderDraft(id);
  const send = useSendOrder(id);
  const authorized = useAuthorizedAction();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [picking, setPicking] = useState<Product | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [billId, setBillId] = useState('');
  const [added, setAdded] = useState('');

  const tables = floor.data?.zones.flatMap((z) => z.tables) ?? [];
  const title = occupancy.data ? occupancyTitle(occupancy.data, tables) : '';
  const products = (menu.data?.products ?? []).filter((p) => p.status !== 'INACTIVE');
  const categories = (menu.data?.categories ?? []).filter(
    (c) => c.active && products.some((p) => p.categoryId === c.id),
  );
  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const groupsOf = (p: Product) =>
    p.modifierGroupIds.flatMap((gid) => menu.data?.modifierGroups.find((g) => g.id === gid) ?? []);
  const openBills = (bills.data ?? []).filter((b) => b.status !== 'PAGADA');
  const targetBill = openBills.find((b) => b.id === billId) ?? openBills[0];
  const count = draftCount(draft);
  const error = actionError(send.error);

  const add = (line: DraftLine) => {
    update((d) => addLine(d, line));
    setPicking(null);
    setAdded(`Agregado: ${line.quantity} × ${line.name}`);
  };

  const choose = (p: Product) => {
    if (p.status !== 'ACTIVE') return;
    // Sin modificadores se agrega directo; con modificadores se eligen primero
    if (groupsOf(p).length === 0 && !p.isCombo) {
      add({
        key: newId(),
        productId: p.id,
        name: p.name,
        unitPrice: p.price,
        quantity: 1,
        modifiers: [],
        note: '',
      });
    } else {
      setPicking(p);
    }
  };

  const submit = () => {
    if (!targetBill || draft.lines.length === 0) return;
    const body = toSendOrder(draft, {
      id: newId(),
      occupancyId: id,
      billId: targetBill.id,
      now: new Date(),
    });
    authorized.run(send, { body, label: `Pedido de ${title}` }, `Enviar el pedido de ${title}`, {
      onDone: (outcome) => {
        // Comanda (#14): se abre el diálogo de imprimir; sin conexión, desde el borrador enviado
        if (occupancy.data) {
          const ctx = {
            occupancy: occupancy.data,
            table: comandaTable(occupancy.data, floor.data?.zones ?? []),
            regional,
          };
          if (outcome.status === 'applied') printOrderComanda(outcome.data, ctx);
          else printDraftComanda(draft, (orders.data?.length ?? 0) + 1, ctx);
        }
        clear();
        setReviewing(false);
        void navigate(`/mesero/ocupacion/${id}`, { state: { sent: outcome.status } });
      },
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-28">
      <Link
        to={`/mesero/ocupacion/${id}`}
        className="flex min-h-12 items-center gap-2 self-start font-semibold"
      >
        <ArrowLeft aria-hidden className="size-5" /> {title || 'Mesa'}
      </Link>
      <h2 className="text-xl font-bold">Tomar pedido</h2>

      {menu.isPending && <p className="text-base text-secondary">Cargando menú…</p>}
      {menu.isError && (
        <p role="alert" className="text-base">
          No se pudo cargar el menú. Revisa la conexión.
        </p>
      )}

      {categories.length > 1 && (
        <nav aria-label="Categorías" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {categories.map((c) => {
              const active = c.id === category?.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-current={active || undefined}
                    onClick={() => setCategoryId(c.id)}
                    className={cx(
                      'min-h-12 whitespace-nowrap rounded-full border px-4 text-base font-semibold',
                      active
                        ? 'border-primary bg-primary text-white'
                        : 'border-secondary bg-background text-secondary hover:bg-surface',
                    )}
                  >
                    {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {category && (
        <section aria-label={category.name}>
          <ul className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2">
            {products
              .filter((p) => p.categoryId === category.id)
              .map((p) => {
                const soldOut = p.status === 'SOLD_OUT';
                const unavailable = soldOut;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={unavailable}
                      onClick={() => choose(p)}
                      className={cx(
                        'flex min-h-16 w-full items-center justify-between gap-3 rounded-md border border-accent bg-background px-4 py-3 text-left',
                        'transition-transform duration-150 ease-out active:scale-[0.98]',
                        unavailable
                          ? 'cursor-not-allowed bg-surface'
                          : 'hover:border-secondary hover:bg-surface',
                      )}
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-base font-semibold">{p.name}</span>
                        {soldOut && <span className="text-sm font-semibold">Agotado</span>}
                        {!soldOut && p.isCombo && (
                          <span className="text-sm text-secondary">Combo</span>
                        )}
                        {!unavailable && !p.isCombo && groupsOf(p).length > 0 && (
                          <span className="text-sm text-secondary">Con opciones</span>
                        )}
                      </span>
                      <span className="shrink-0 text-base font-semibold tabular">
                        {formatMoney(p.price, regional)}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {/* Barra fija abajo: lo que lleva el pedido */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-accent bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          <p aria-live="polite" className="min-h-5 text-sm text-secondary">
            {added}
          </p>
          <Button
            size="lg"
            fullWidth
            icon={<ShoppingBasket />}
            disabled={count === 0}
            onClick={() => setReviewing(true)}
          >
            {count === 0
              ? 'El pedido está vacío'
              : `Ver pedido · ${count} · ${formatMoney(draftTotal(draft), regional)}`}
          </Button>
        </div>
      </div>

      <ProductDialog
        product={picking}
        groups={picking ? groupsOf(picking) : []}
        menu={menu.data}
        onClose={() => setPicking(null)}
        onAdd={add}
      />

      <Modal
        open={reviewing}
        onClose={() => setReviewing(false)}
        title={`Pedido de ${title}`}
        description="Revisa antes de enviar a cocina. Lo que quites aquí no queda registrado."
      >
        <div className="flex flex-col gap-5">
          <ul className="flex flex-col divide-y divide-surface">
            {draft.lines.map((l) => (
              <li key={l.key} className="flex flex-col gap-2 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-base font-semibold">{l.name}</span>
                    {l.modifiers.length > 0 && (
                      <span className="text-sm text-secondary">
                        {l.modifiers.map((m) => m.name).join(', ')}
                      </span>
                    )}
                    {(l.components ?? []).map((c) => (
                      <span key={`${c.comboGroupId}-${c.productId}`} className="text-sm">
                        – {c.name}
                        {c.modifiers.length > 0 &&
                          ` (${c.modifiers.map((m) => m.name).join(', ')})`}
                      </span>
                    ))}
                    {l.note && <span className="text-sm">Nota: {l.note}</span>}
                  </div>
                  <span className="shrink-0 text-base font-semibold tabular">
                    {formatMoney(draftLineTotal(l), regional)}
                  </span>
                </div>
                <div
                  className="flex items-center gap-3"
                  role="group"
                  aria-label={`Cantidad de ${l.name}`}
                >
                  <button
                    type="button"
                    aria-label={l.quantity === 1 ? `Quitar ${l.name}` : `Uno menos de ${l.name}`}
                    onClick={() => update((d) => setQuantity(d, l.key, l.quantity - 1))}
                    className="flex size-12 items-center justify-center rounded-md border border-secondary text-secondary hover:bg-surface"
                  >
                    <Minus aria-hidden className="size-5" />
                  </button>
                  <output className="min-w-8 text-center text-lg font-bold tabular">
                    {l.quantity}
                  </output>
                  <button
                    type="button"
                    aria-label={`Uno más de ${l.name}`}
                    disabled={l.quantity >= MAX_QUANTITY}
                    onClick={() => update((d) => setQuantity(d, l.key, l.quantity + 1))}
                    className="flex size-12 items-center justify-center rounded-md border border-secondary text-secondary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Plus aria-hidden className="size-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <p className="flex items-baseline justify-between text-lg font-bold">
            <span>Total</span>
            <span className="tabular">{formatMoney(draftTotal(draft), regional)}</span>
          </p>

          {openBills.length > 1 && (
            <Select
              label="Cuenta"
              value={targetBill?.id ?? ''}
              onChange={(e) => setBillId(e.target.value)}
              options={openBills.map((b) => ({ value: b.id, label: b.name }))}
            />
          )}

          {error && (
            <p role="alert" className="flex items-start gap-2 text-base">
              <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-error" />
              <span>{error}</span>
            </p>
          )}

          <Button
            size="lg"
            fullWidth
            icon={<Send />}
            loading={send.isPending}
            disabled={draft.lines.length === 0 || !targetBill}
            onClick={submit}
          >
            Enviar a cocina
          </Button>
        </div>
        {authorized.dialog}
      </Modal>
    </div>
  );
}
