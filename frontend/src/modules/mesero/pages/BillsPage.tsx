// Cuentas de la mesa (Docs/05 paso 10, RF-102 a RF-104, #17 del plan): ver qué lleva cada cuenta,
// crear cuentas, mover ítems marcados, separar unidades de una línea, renombrar e imprimir la
// pre-cuenta. Reasignado a Deniscito (doc 17 §3.1).
import type { Bill } from '@mise/shared/contracts/billing';
import type { OrderItem } from '@mise/shared/contracts/orders';
import { ArrowLeft, ArrowRightLeft, Plus, Printer, Scissors, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { usePublicConfig, useRegional } from '../../../core/config/index.js';
import { formatDateTime, formatMoney } from '../../../core/format/index.js';
import { precuentaDocument, printWithDialog, reciboDocument } from '../../../core/print/index.js';
import {
  Badge,
  Button,
  Card,
  Modal,
  NumberStepper,
  Select,
  TextInput,
  type BadgeTone,
} from '../../../core/ui/index.js';
import { useAuthorizedAction } from '../api/authorized-action.js';
import {
  useCreateBill,
  useMoveItems,
  usePayBill,
  usePrecheck,
  useRenameBill,
  useSplitItem,
} from '../api/bill-api.js';
import { useFloor, useOccupancy } from '../api/floor-api.js';
import { useOccupancyBills, useOccupancyOrders } from '../api/order-api.js';
import { actionError, QUEUED_MESSAGE } from '../components/errors.js';
import { occupancyTitle } from '../components/occupancy-title.js';
import { PaymentDialog, type PaymentResult } from '../components/PaymentDialog.js';

const BILL_STATUS: Record<Bill['status'], { label: string; tone: BadgeTone }> = {
  ABIERTA: { label: 'Abierta', tone: 'neutral' },
  PRECUENTA: { label: 'Pre-cuenta impresa', tone: 'warning' },
  PAGADA: { label: 'Pagada', tone: 'success' },
  ELIMINADA: { label: 'Eliminada', tone: 'neutral' },
};

const itemDetail = (i: OrderItem) =>
  [
    ...i.modifiers.map((m) => m.name),
    ...i.components.map(
      (c) =>
        `${c.name}${c.modifiers.length ? ` (${c.modifiers.map((m) => m.name).join(', ')})` : ''}`,
    ),
  ].join(', ');

export function BillsPage() {
  const { id = '' } = useParams();
  const occupancy = useOccupancy(id);
  const floor = useFloor();
  const bills = useOccupancyBills(id);
  const orders = useOccupancyOrders(id);
  const regional = useRegional();
  const config = usePublicConfig();
  const authorized = useAuthorizedAction();
  const create = useCreateBill(id);
  const rename = useRenameBill(id);
  const move = useMoveItems(id);
  const split = useSplitItem(id);
  const precheck = usePrecheck(id);
  const pay = usePayBill(id);
  const navigate = useNavigate();
  const [paying, setPaying] = useState<Bill | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState<string>('');
  const [splitting, setSplitting] = useState<OrderItem | null>(null);
  const [renaming, setRenaming] = useState<Bill | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const back = (
    <Link
      to={`/mesero/ocupacion/${id}`}
      className="flex min-h-12 items-center gap-2 self-start font-semibold"
    >
      <ArrowLeft aria-hidden className="size-5" /> Volver a la mesa
    </Link>
  );
  if (occupancy.isPending || bills.isPending || orders.isPending)
    return <p className="text-base text-secondary">Cargando cuentas…</p>;
  if (!occupancy.data || !bills.data || !orders.data)
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        {back}
        <p role="alert">No se pudieron cargar las cuentas.</p>
      </div>
    );

  const occ = occupancy.data;
  const title = occupancyTitle(occ, floor.data?.zones.flatMap((z) => z.tables) ?? []);
  const list = bills.data;
  const items = orders.data.flatMap((o) => o.items).filter((i) => i.status !== 'CANCELADO');
  const itemsOf = (b: Bill) => items.filter((i) => i.billId === b.id);
  const open = list.filter((b) => b.status === 'ABIERTA' || b.status === 'PRECUENTA');
  const error = actionError(
    create.error ?? rename.error ?? move.error ?? split.error ?? precheck.error,
  );
  const after = (outcome: { status: 'applied' | 'queued' }) => {
    setNotice(outcome.status === 'queued' ? QUEUED_MESSAGE : null);
  };
  const toggle = (itemId: string) =>
    setSelected((s) => (s.includes(itemId) ? s.filter((x) => x !== itemId) : [...s, itemId]));

  const doMove = async () => {
    if (!target || selected.length === 0) return;
    const targetBill = list.find((b) => b.id === target);
    if (!targetBill) return;
    // El servidor pide la versión de cada ítem que se mueve (SC-50). Con conexión se vuelven a
    // leer los pedidos para no mandar versiones viejas
    const freshOrders = navigator.onLine ? ((await orders.refetch()).data ?? []) : [];
    const freshItems = freshOrders.length ? freshOrders.flatMap((o) => o.items) : items;
    const versions = Object.fromEntries(
      freshItems.filter((i) => selected.includes(i.id)).map((i) => [i.id, i.version]),
    );
    authorized.run(
      move,
      { itemIds: selected, target: targetBill, versions },
      `Mover a ${targetBill.name}`,
      {
        onDone: (o) => {
          setSelected([]);
          after(o);
        },
      },
    );
  };

  // Cobro (H3 #19): con la versión fresca de la cuenta; al aplicarse se imprime el recibo
  const collect = async (bill: Bill, result: PaymentResult) => {
    const fresh = navigator.onLine ? ((await bills.refetch()).data ?? list) : list;
    const current = fresh.find((b) => b.id === bill.id) ?? bill;
    authorized.run(
      pay,
      { bill: current, body: { ...result, version: current.version } },
      `Cobrar ${bill.name}`,
      {
        onDone: (o) => {
          setPaying(null);
          if (o.status === 'applied') {
            const r = o.data;
            const cashPay = r.payments.find((p) => p.tendered);
            void printWithDialog(
              reciboDocument({
                restaurant: config.data?.tradeName ?? '',
                folio: r.bill.folio ?? '',
                paidAt: formatDateTime(r.paidAt, regional),
                where: `${title} · ${r.bill.name}`,
                cashier: r.receivedByName,
                waiter: occ.waiterName,
                customer: r.bill.customerTaxName
                  ? `${r.bill.customerNit ?? 'CF'} · ${r.bill.customerTaxName}`
                  : (r.bill.customerNit ?? 'CF'),
                items: r.items.map((i) => ({
                  quantity: i.quantity,
                  name: i.productName,
                  amount: formatMoney(i.lineTotal, regional),
                })),
                subtotal: formatMoney(r.bill.subtotal, regional),
                discount:
                  r.bill.discountTotal !== '0.00'
                    ? formatMoney(r.bill.discountTotal, regional)
                    : null,
                tip: r.bill.tipAmount !== '0.00' ? formatMoney(r.bill.tipAmount, regional) : null,
                total: formatMoney(r.totalPaid, regional),
                payments: r.payments.map((p) => ({
                  label: p.reference ? `${p.methodName} (Ref. ${p.reference})` : p.methodName,
                  amount: formatMoney(p.amount, regional),
                })),
                cash: cashPay?.tendered
                  ? {
                      tendered: formatMoney(cashPay.tendered, regional),
                      change: formatMoney(r.change, regional),
                    }
                  : null,
                reprint: false,
                legend: 'Este documento no es una factura.',
              }),
            );
            if (r.occupancyClosed) void navigate('/mesero', { state: { closed: title } });
          }
          after(o);
        },
      },
    );
  };

  const printPrecheck = (bill: Bill) => {
    const position = `${list.indexOf(bill) + 1} de ${list.length}`;
    const print = (data: {
      items: OrderItem[];
      subtotal: string;
      discount: string;
      total: string;
      tip: { pct: string; amount: string; totalWithTip: string } | null;
      reprint: boolean;
      offline?: boolean;
    }) =>
      void printWithDialog(
        precuentaDocument({
          restaurant: config.data?.tradeName ?? '',
          where: title,
          billName: bill.name,
          billPosition: position,
          waiterName: occ.waiterName,
          guests: occ.tableId ? occ.guests : null,
          printedAt: formatDateTime(new Date().toISOString(), regional),
          items: data.items.map((i) => ({
            quantity: i.quantity,
            name: i.productName,
            detail: itemDetail(i),
            amount: formatMoney(i.lineTotal, regional),
          })),
          subtotal: formatMoney(data.subtotal, regional),
          discount: data.discount !== '0.00' ? formatMoney(data.discount, regional) : null,
          total: formatMoney(data.total, regional),
          tip: data.tip,
          reprint: data.reprint,
          offline: data.offline ?? false,
        }),
      );
    authorized.run(precheck, { bill }, `Pre-cuenta de ${bill.name}`, {
      onDone: (o) => {
        if (o.status === 'applied') {
          const r = o.data;
          print({
            items: r.items,
            subtotal: r.bill.subtotal,
            discount: r.bill.discountTotal,
            total: r.bill.total,
            tip: r.tipPct
              ? {
                  pct: r.tipPct,
                  amount: formatMoney(r.tipAmount, regional),
                  totalWithTip: formatMoney(r.totalWithTip, regional),
                }
              : null,
            reprint: r.reprint,
          });
        } else {
          // Sin conexión: se imprime con lo que hay en el celular (Docs/09 §8), sin propina
          print({
            items: itemsOf(bill),
            subtotal: bill.subtotal,
            discount: bill.discountTotal,
            total: bill.total,
            tip: null,
            reprint: bill.status === 'PRECUENTA',
            offline: true,
          });
        }
        after(o);
      },
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 pb-32">
      {back}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Cuentas · {title}</h2>
        <Button
          variant="secondary"
          icon={<Plus />}
          loading={create.isPending}
          onClick={() =>
            authorized.run(create, { name: `Cuenta ${list.length + 1}` }, 'Crear una cuenta', {
              onDone: after,
            })
          }
        >
          Nueva cuenta
        </Button>
      </header>
      {notice && (
        <p role="status" className="rounded-md bg-surface p-3 text-base">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
        >
          {error}
        </p>
      )}

      {list.map((b) => {
        const st = BILL_STATUS[b.status];
        const mine = itemsOf(b);
        const editable = b.status === 'ABIERTA' || b.status === 'PRECUENTA';
        return (
          <Card key={b.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={!editable}
                onClick={() => setRenaming(b)}
                className="text-left text-lg font-bold underline-offset-4 hover:underline"
                aria-label={`Renombrar ${b.name}`}
              >
                {b.name}
              </button>
              <Badge tone={st.tone}>{st.label}</Badge>
            </div>
            {mine.length === 0 ? (
              <p className="text-base text-secondary">Sin ítems.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-accent">
                {mine.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 py-2">
                    {editable && (
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 accent-primary"
                        checked={selected.includes(i.id)}
                        onChange={() => toggle(i.id)}
                        aria-label={`Marcar ${i.quantity} × ${i.productName}`}
                      />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-base">
                        <span className="font-semibold tabular">{i.quantity} ×</span>{' '}
                        {i.productName}
                      </span>
                      {itemDetail(i) && (
                        <span className="text-sm text-secondary">{itemDetail(i)}</span>
                      )}
                    </div>
                    <span className="shrink-0 text-base tabular">
                      {formatMoney(i.lineTotal, regional)}
                    </span>
                    {editable && i.quantity > 1 && (
                      <button
                        type="button"
                        onClick={() => setSplitting(i)}
                        aria-label={`Separar unidades de ${i.productName}`}
                        className="flex size-11 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-surface"
                      >
                        <Scissors aria-hidden className="size-5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-accent pt-3">
              <span className="text-lg font-bold tabular">
                Total {formatMoney(b.total, regional)}
              </span>
              {editable && mine.length > 0 && (
                <Button
                  variant="outline"
                  icon={<Printer />}
                  loading={precheck.isPending && precheck.variables?.bill.id === b.id}
                  onClick={() => printPrecheck(b)}
                >
                  {b.status === 'PRECUENTA' ? 'Reimprimir pre-cuenta' : 'Pre-cuenta'}
                </Button>
              )}
              {editable && mine.length > 0 && (
                <Button icon={<Wallet />} onClick={() => setPaying(b)}>
                  Cobrar
                </Button>
              )}
            </div>
          </Card>
        );
      })}

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-accent bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-xl flex-wrap items-end gap-3">
            <Select
              label={`Mover ${selected.length} ${selected.length === 1 ? 'ítem' : 'ítems'} a`}
              value={target}
              options={[
                { value: '', label: 'Elige la cuenta' },
                ...open.map((b) => ({ value: b.id, label: b.name })),
              ]}
              onChange={(e) => setTarget(e.target.value)}
              className="min-w-40 flex-1"
            />
            <Button
              icon={<ArrowRightLeft />}
              disabled={!target}
              loading={move.isPending}
              onClick={() => void doMove()}
            >
              Mover
            </Button>
          </div>
        </div>
      )}

      <SplitDialog
        item={splitting}
        bills={open}
        loading={split.isPending}
        onClose={() => setSplitting(null)}
        onConfirm={(quantity, targetBillId) => {
          const item = splitting!;
          authorized.run(
            split,
            {
              itemId: item.id,
              name: item.productName,
              quantity,
              version: item.version,
              targetBillId,
            },
            `Separar ${quantity} de ${item.productName}`,
            {
              onDone: (o) => {
                setSplitting(null);
                after(o);
              },
            },
          );
        }}
      />
      <PaymentDialog
        bill={paying}
        isTakeaway={!occ.tableId}
        loading={pay.isPending}
        error={actionError(pay.error)}
        onClose={() => setPaying(null)}
        onPay={(result) => void collect(paying!, result)}
      />
      <RenameDialog
        bill={renaming}
        loading={rename.isPending}
        onClose={() => setRenaming(null)}
        onSave={(name) => {
          const bill = renaming!;
          authorized.run(rename, { bill, name }, `Renombrar ${bill.name}`, {
            onDone: (o) => {
              setRenaming(null);
              after(o);
            },
          });
        }}
      />
      {authorized.dialog}
    </div>
  );
}

function SplitDialog({
  item,
  bills,
  loading,
  onClose,
  onConfirm,
}: {
  item: OrderItem | null;
  bills: Bill[];
  loading: boolean;
  onClose: () => void;
  onConfirm: (quantity: number, targetBillId: string | undefined) => void;
}) {
  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={item ? `Separar ${item.productName}` : 'Separar'}
      description="Pasa algunas unidades a otra línea, por ejemplo para cobrarlas en otra cuenta."
    >
      {item && (
        <SplitForm
          key={item.id}
          item={item}
          bills={bills}
          loading={loading}
          onConfirm={onConfirm}
        />
      )}
    </Modal>
  );
}

function SplitForm({
  item,
  bills,
  loading,
  onConfirm,
}: {
  item: OrderItem;
  bills: Bill[];
  loading: boolean;
  onConfirm: (quantity: number, targetBillId: string | undefined) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [target, setTarget] = useState('');
  return (
    <div className="flex flex-col gap-4">
      <NumberStepper
        label="Unidades a separar"
        value={quantity}
        onChange={setQuantity}
        min={1}
        max={item.quantity - 1}
      />
      <Select
        label="Llevarlas a"
        value={target}
        options={[
          { value: '', label: 'La misma cuenta' },
          ...bills.filter((b) => b.id !== item.billId).map((b) => ({ value: b.id, label: b.name })),
        ]}
        onChange={(e) => setTarget(e.target.value)}
      />
      <Button
        icon={<Scissors />}
        loading={loading}
        onClick={() => onConfirm(quantity, target || undefined)}
      >
        Separar {quantity} de {item.quantity}
      </Button>
    </div>
  );
}

function RenameDialog({
  bill,
  loading,
  onClose,
  onSave,
}: {
  bill: Bill | null;
  loading: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  return (
    <Modal open={bill !== null} onClose={onClose} title="Renombrar cuenta">
      {bill && <RenameForm key={bill.id} bill={bill} loading={loading} onSave={onSave} />}
    </Modal>
  );
}

function RenameForm({
  bill,
  loading,
  onSave,
}: {
  bill: Bill;
  loading: boolean;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(bill.name);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSave(name.trim());
      }}
    >
      <TextInput
        label="Nombre"
        hint='Ej. "Ana" o "Cuenta 2"'
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" disabled={!name.trim()} loading={loading}>
        Guardar
      </Button>
    </form>
  );
}
