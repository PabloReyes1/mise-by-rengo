// Cobrar una cuenta (Docs/05 paso 11, H3 #19). Reasignado a Deniscito (doc 17 §3.1).
// Propina sugerida y editable (S-10), pagos mixtos y cambio (solo efectivo; el cajero
// escribe lo recibido, sin botones de billetes: RENGO 2026-11-23),
// referencia en tarjeta/transferencia, NIT o CF. Lo cobrado tiene que sumar exactamente el total.
import type { Bill, PaymentMethod } from '@mise/shared/contracts/billing';
import { sumMoney, toCents, fromCents } from '@mise/shared/domain/billing';
import { newId } from '@mise/shared/domain/ids';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import { usePublicConfig, useRegional } from '../../../core/config/index.js';
import { formatMoney, toMoney } from '../../../core/format/index.js';
import { Button, cx, Modal, TextInput } from '../../../core/ui/index.js';
import { usePaymentMethods } from '../api/bill-api.js';

export interface PaymentRow {
  id: string;
  methodId: string;
  amount: string;
  tendered: string;
  reference: string;
}

export interface PaymentResult {
  tipAmount: string;
  payments: {
    id: string;
    methodId: string;
    amount: string;
    tendered?: string;
    reference?: string;
  }[];
  customerNit: string;
  customerTaxName: string;
}

export function PaymentDialog({
  bill,
  isTakeaway,
  loading,
  error,
  onClose,
  onPay,
}: {
  bill: Bill | null;
  isTakeaway: boolean;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onPay: (result: PaymentResult) => void;
}) {
  return (
    <Modal open={bill !== null} onClose={onClose} title={bill ? `Cobrar ${bill.name}` : 'Cobrar'}>
      {bill && (
        <PaymentForm
          key={bill.id}
          bill={bill}
          isTakeaway={isTakeaway}
          loading={loading}
          error={error}
          onPay={onPay}
        />
      )}
    </Modal>
  );
}

function PaymentForm({
  bill,
  isTakeaway,
  loading,
  error,
  onPay,
}: {
  bill: Bill;
  isTakeaway: boolean;
  loading: boolean;
  error: string | null;
  onPay: (result: PaymentResult) => void;
}) {
  const regional = useRegional();
  const config = usePublicConfig();
  const methods = usePaymentMethods();
  const tips = config.data?.tips;
  const tipApplies = Boolean(tips?.enabled && (!isTakeaway || tips.appliesTakeaway));
  const suggested =
    tipApplies && tips?.suggestedPct
      ? fromCents(Math.round((toCents(bill.total) * Number(tips.suggestedPct)) / 100))
      : '0.00';
  const [tip, setTip] = useState(suggested);
  const tipValue = tipApplies ? (toMoney(tip) ?? '0.00') : '0.00';
  const due = sumMoney([bill.total, tipValue]);
  const cash = methods.data?.find((m) => m.kind === 'CASH');
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const list: PaymentRow[] =
    rows.length || !methods.data?.length
      ? rows
      : [
          {
            id: newId(),
            methodId: (cash ?? methods.data[0]!).id,
            amount: due,
            tendered: '',
            reference: '',
          },
        ];
  const [nit, setNit] = useState('CF');
  const [taxName, setTaxName] = useState('');

  const methodOf = (id: string): PaymentMethod | undefined =>
    methods.data?.find((m) => m.id === id);
  const update = (i: number, patch: Partial<PaymentRow>) =>
    setRows(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const applied = sumMoney(list.map((r) => toMoney(r.amount) ?? '0.00'));
  const remaining = toCents(due) - toCents(applied);
  const changeOf = (r: PaymentRow) => {
    const t = toMoney(r.tendered);
    const a = toMoney(r.amount);
    return t && a && toCents(t) >= toCents(a) ? fromCents(toCents(t) - toCents(a)) : null;
  };
  /** Tarjeta, transferencia…: no dan cambio, así que no pueden pasar de lo que falta (PR-011). */
  const overpaidBy = (i: number): string | null => {
    const r = list[i]!;
    const m = methodOf(r.methodId);
    const a = toMoney(r.amount);
    if (!m || m.givesChange || !a) return null;
    const others = list.reduce(
      (s, o, j) => (j === i ? s : s + toCents(toMoney(o.amount) ?? '0.00')),
      0,
    );
    const max = Math.max(0, toCents(due) - others);
    return toCents(a) > max
      ? `${m.name} no da cambio: máximo ${formatMoney(fromCents(max), regional)}`
      : null;
  };
  const problems = list.flatMap((r, i) => {
    const m = methodOf(r.methodId);
    if (!toMoney(r.amount) || toCents(toMoney(r.amount)!) <= 0) return ['Revisa los montos'];
    const over = overpaidBy(i);
    if (over) return [over];
    if (m?.requiresReference && !r.reference.trim()) return [`${m.name} pide referencia`];
    if (m?.givesChange && r.tendered && !changeOf(r)) return ['El efectivo recibido no alcanza'];
    return [];
  });
  const ready = remaining === 0 && problems.length === 0 && list.length > 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        onPay({
          tipAmount: tipValue,
          customerNit: nit.trim() || 'CF',
          customerTaxName: taxName.trim(),
          payments: list.map((r) => {
            const m = methodOf(r.methodId);
            return {
              id: r.id,
              methodId: r.methodId,
              amount: toMoney(r.amount)!,
              ...(m?.givesChange && toMoney(r.tendered) ? { tendered: toMoney(r.tendered)! } : {}),
              ...(r.reference.trim() ? { reference: r.reference.trim() } : {}),
            };
          }),
        });
      }}
    >
      <div className="flex flex-col gap-1 rounded-md bg-surface p-3 text-base">
        <div className="flex justify-between">
          <span>Consumo</span>
          <span className="tabular">{formatMoney(bill.total, regional)}</span>
        </div>
        {tipApplies && (
          <TextInput
            label={`Propina${tips?.suggestedPct ? ` (sugerida ${tips.suggestedPct}%)` : ''}`}
            hint="La propina es voluntaria: se puede cambiar o quitar"
            inputMode="decimal"
            value={tip}
            disabled={!tips?.editable}
            onChange={(e) => setTip(e.target.value)}
          />
        )}
        <div className="flex justify-between text-xl font-bold">
          <span>Total a pagar</span>
          <span className="tabular">{formatMoney(due, regional)}</span>
        </div>
      </div>

      {list.map((r, i) => {
        const m = methodOf(r.methodId);
        const change = changeOf(r);
        return (
          <fieldset key={r.id} className="flex flex-col gap-3 rounded-md border border-accent p-3">
            <legend className="px-1 text-sm font-semibold">Pago {i + 1}</legend>
            <div role="radiogroup" aria-label="Método de pago" className="flex flex-wrap gap-2">
              {methods.data?.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={opt.id === r.methodId}
                  onClick={() => update(i, { methodId: opt.id, tendered: '', reference: '' })}
                  className={cx(
                    'min-h-12 rounded-md border px-4 text-base font-semibold',
                    opt.id === r.methodId
                      ? 'border-2 border-primary bg-surface'
                      : 'border-secondary text-secondary',
                  )}
                >
                  {opt.name}
                </button>
              ))}
            </div>
            <TextInput
              label="Monto"
              inputMode="decimal"
              value={r.amount}
              error={overpaidBy(i) ?? undefined}
              onChange={(e) => update(i, { amount: e.target.value })}
            />
            {m?.givesChange && (
              <>
                <TextInput
                  label="Efectivo recibido"
                  inputMode="decimal"
                  value={r.tendered}
                  onChange={(e) => update(i, { tendered: e.target.value })}
                />
                {change && (
                  <p className="text-lg font-bold">
                    Cambio: <span className="tabular">{formatMoney(change, regional)}</span>
                  </p>
                )}
              </>
            )}
            {m?.requiresReference && (
              <TextInput
                label="Referencia"
                value={r.reference}
                maxLength={60}
                autoComplete="off"
                onChange={(e) => update(i, { reference: e.target.value })}
              />
            )}
            {list.length > 1 && (
              <Button
                variant="outline"
                icon={<Trash2 />}
                onClick={() => setRows(list.filter((_, j) => j !== i))}
              >
                Quitar este pago
              </Button>
            )}
          </fieldset>
        );
      })}

      <Button
        variant="outline"
        icon={<Plus />}
        disabled={remaining <= 0}
        onClick={() =>
          setRows([
            ...list,
            {
              id: newId(),
              methodId: methods.data?.find((m) => m.kind !== 'CASH')?.id ?? list[0]!.methodId,
              amount: fromCents(Math.max(0, remaining)),
              tendered: '',
              reference: '',
            },
          ])
        }
      >
        Agregar otro pago (pago mixto)
      </Button>

      <p
        className={cx('text-base font-semibold', remaining === 0 ? 'text-success' : '')}
        aria-live="polite"
      >
        {remaining === 0
          ? 'Lo cobrado cubre el total.'
          : remaining > 0
            ? `Falta ${formatMoney(fromCents(remaining), regional)}`
            : `Sobra ${formatMoney(fromCents(-remaining), regional)}: revisa los montos`}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput
          label="NIT"
          hint='"CF" si es consumidor final'
          value={nit}
          maxLength={20}
          onChange={(e) => setNit(e.target.value)}
        />
        <TextInput
          label="Nombre (opcional)"
          value={taxName}
          maxLength={120}
          onChange={(e) => setTaxName(e.target.value)}
        />
      </div>

      {(problems[0] ?? error) && (
        <p role="alert" className="border-l-4 border-error pl-3 text-base font-semibold">
          {problems[0] ?? error}
        </p>
      )}
      <Button type="submit" size="lg" icon={<Wallet />} disabled={!ready} loading={loading}>
        Cobrar {formatMoney(due, regional)}
      </Button>
    </form>
  );
}
