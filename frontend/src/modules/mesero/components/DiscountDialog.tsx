// Descuento en una cuenta o en un ítem (Docs/03 §5 regla 2, Docs/05 §4, H3 #19). Motivo
// obligatorio; por encima del tope del rol la acción pide 🔑. Reasignado a Deniscito.
import type { AppliedDiscount, Bill } from '@mise/shared/contracts/billing';
import type { OrderItem } from '@mise/shared/contracts/orders';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney, toMoney } from '../../../core/format/index.js';
import { Button, Modal, Select, TextInput } from '../../../core/ui/index.js';
import { useDiscountReasons } from '../api/bill-api.js';

export interface DiscountInput {
  target: 'BILL' | 'ITEM';
  itemId?: string;
  kind: 'PCT' | 'AMOUNT';
  value: string;
  reasonId: string;
}

export function DiscountDialog({
  bill,
  items,
  discounts,
  loading,
  error,
  onClose,
  onApply,
  onRemove,
}: {
  bill: Bill | null;
  items: OrderItem[];
  discounts: AppliedDiscount[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onApply: (input: DiscountInput) => void;
  onRemove: (discount: AppliedDiscount) => void;
}) {
  return (
    <Modal
      open={bill !== null}
      onClose={onClose}
      title={bill ? `Descuento · ${bill.name}` : 'Descuento'}
    >
      {bill && (
        <DiscountForm
          key={bill.id}
          items={items}
          discounts={discounts}
          loading={loading}
          error={error}
          onApply={onApply}
          onRemove={onRemove}
        />
      )}
    </Modal>
  );
}

function DiscountForm({
  items,
  discounts,
  loading,
  error,
  onApply,
  onRemove,
}: {
  items: OrderItem[];
  discounts: AppliedDiscount[];
  loading: boolean;
  error: string | null;
  onApply: (input: DiscountInput) => void;
  onRemove: (discount: AppliedDiscount) => void;
}) {
  const regional = useRegional();
  const reasons = useDiscountReasons();
  const [target, setTarget] = useState('BILL');
  const [kind, setKind] = useState<'PCT' | 'AMOUNT'>('PCT');
  const [value, setValue] = useState('');
  const [reasonId, setReasonId] = useState('');
  const amount = toMoney(value);
  const valid =
    amount && Number(amount) > 0 && reasonId && (kind === 'AMOUNT' || Number(amount) <= 100);
  const label = (d: AppliedDiscount) => {
    const item = items.find((i) => i.id === d.itemId);
    const what = item ? `${item.productName}` : 'Toda la cuenta';
    const how = d.kind === 'PCT' ? `${Number(d.value)}%` : formatMoney(d.value, regional);
    return `${what}: ${how} (${d.reasonName}) = -${formatMoney(d.amount, regional)}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {discounts.length > 0 && (
        <ul className="flex flex-col divide-y divide-accent border-y border-accent">
          {discounts.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-base">
              <span>{label(d)}</span>
              <button
                type="button"
                onClick={() => onRemove(d)}
                aria-label={`Quitar descuento: ${label(d)}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-secondary hover:bg-surface"
              >
                <Trash2 aria-hidden className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onApply({
            target: target === 'BILL' ? 'BILL' : 'ITEM',
            ...(target !== 'BILL' ? { itemId: target } : {}),
            kind,
            value: amount,
            reasonId,
          });
        }}
      >
        <Select
          label="Sobre"
          value={target}
          options={[
            { value: 'BILL', label: 'Toda la cuenta' },
            ...items.map((i) => ({
              value: i.id,
              label: `${i.quantity} × ${i.productName} (${formatMoney(i.lineTotal, regional)})`,
            })),
          ]}
          onChange={(e) => setTarget(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Tipo"
            value={kind}
            options={[
              { value: 'PCT', label: 'Porcentaje (%)' },
              { value: 'AMOUNT', label: 'Monto fijo' },
            ]}
            onChange={(e) => setKind(e.target.value as 'PCT' | 'AMOUNT')}
          />
          <TextInput
            label={kind === 'PCT' ? 'Porcentaje' : 'Monto'}
            inputMode="decimal"
            value={value}
            error={value && !amount ? 'Escribe un número, ej. 10' : undefined}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Select
          label="Motivo"
          value={reasonId}
          options={[
            { value: '', label: 'Elige el motivo' },
            ...(reasons.data ?? []).map((r) => ({ value: r.id, label: r.name })),
          ]}
          onChange={(e) => setReasonId(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-base">
            {error}
          </p>
        )}
        <Button type="submit" disabled={!valid} loading={loading}>
          Aplicar descuento
        </Button>
      </form>
    </div>
  );
}
