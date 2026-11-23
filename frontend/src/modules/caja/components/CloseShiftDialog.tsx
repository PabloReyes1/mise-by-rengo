// Corte de caja (Docs/05 paso 13, H3 #20): se cuenta el efectivo (a ciegas si no tiene
// cash.view_expected), por denominación o el total, se cierra y se imprime el corte.
// Reasignado a Deniscito (doc 17 §3.1).
import type { CashRegister, ShiftReport } from '@mise/shared/contracts/cash';
import { fromCents, toCents } from '@mise/shared/domain/billing';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { usePublicConfig, useRegional } from '../../../core/config/index.js';
import { formatDateTime, formatMoney, toMoney } from '../../../core/format/index.js';
import { corteDocument, printWithDialog } from '../../../core/print/index.js';
import { Button, Modal, NumberInput, TextInput } from '../../../core/ui/index.js';
import { useCloseShift } from '../api/cash-api.js';

/** Billetes y monedas de quetzal (SC-59: se podrán configurar por caja, PA-025). */
const DENOMINATIONS = [
  '200.00',
  '100.00',
  '50.00',
  '20.00',
  '10.00',
  '5.00',
  '1.00',
  '0.50',
  '0.25',
  '0.10',
  '0.05',
];

export function printCorte(
  report: ShiftReport,
  restaurant: string,
  regional: ReturnType<typeof useRegional>,
  reprint = false,
) {
  const m = (v: string) => formatMoney(v, regional);
  void printWithDialog(
    corteDocument({
      restaurant,
      register: report.cashRegisterName,
      openedBy: report.openedByName,
      openedAt: formatDateTime(report.openedAt, regional),
      closedBy: report.closedByName ?? '',
      closedAt: report.closedAt ? formatDateTime(report.closedAt, regional) : '',
      salesByMethod: report.salesByMethod.map((s) => ({ ...s, amount: m(s.amount) })),
      totalCollected: m(report.totalCollected),
      tips: m(report.tipsTotal),
      openingFloat: m(report.openingFloat),
      cashSales: m(report.cashSales),
      deposits: { count: report.deposits.count, amount: m(report.deposits.amount) },
      withdrawals: { count: report.withdrawals.count, amount: m(report.withdrawals.amount) },
      reversals: { count: report.reversals.count, amount: m(report.reversals.amount) },
      expected: m(report.expectedCash ?? '0.00'),
      counted: m(report.countedCash ?? '0.00'),
      difference: report.difference?.startsWith('-')
        ? `-${m(report.difference.slice(1))}`
        : m(report.difference ?? '0.00'),
      comment: report.comment,
      counts: report.counts.map((c) => ({
        ...c,
        denomination: m(c.denomination),
        amount: m(fromCents(toCents(c.denomination) * c.quantity)),
      })),
      billsPaid: report.billsPaid,
      discounts: m(report.discountsTotal),
      netSales: m(report.netSales),
      reprint,
    }),
  );
}

export function CloseShiftDialog({
  register,
  start,
  onClose,
}: {
  register: CashRegister;
  /** Reporte al empezar el corte (expectedCash null si es a ciegas) */
  start: ShiftReport | null;
  onClose: () => void;
}) {
  return (
    <Modal open={start !== null} onClose={onClose} title={`Corte · ${register.name}`}>
      {start && <CloseForm start={start} onDone={onClose} />}
    </Modal>
  );
}

function CloseForm({ start, onDone }: { start: ShiftReport; onDone: () => void }) {
  const regional = useRegional();
  const config = usePublicConfig();
  const close = useCloseShift();
  const [byDenomination, setByDenomination] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState('');
  const [comment, setComment] = useState('');
  const countedFromBills = fromCents(
    DENOMINATIONS.reduce((t, d) => t + toCents(d) * (counts[d] ?? 0), 0),
  );
  const counted = byDenomination ? countedFromBills : toMoney(total);
  const error =
    close.error instanceof ApiError
      ? close.error.message
      : close.error
        ? 'No se pudo cerrar'
        : null;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!counted) return;
        close.mutate(
          {
            shiftId: start.shiftId,
            countedCash: counted,
            ...(byDenomination
              ? {
                  counts: DENOMINATIONS.filter((d) => (counts[d] ?? 0) > 0).map((d) => ({
                    denomination: d,
                    quantity: counts[d]!,
                  })),
                }
              : {}),
            ...(comment.trim() ? { comment: comment.trim() } : {}),
          },
          {
            onSuccess: (report) => {
              printCorte(report, config.data?.tradeName ?? '', regional);
              onDone();
            },
          },
        );
      }}
    >
      <p className="text-base">
        {start.expectedCash !== null
          ? `Efectivo esperado: ${formatMoney(start.expectedCash, regional)}`
          : 'Cuenta el efectivo del cajón. El esperado se ve al cerrar (corte a ciegas).'}
      </p>
      <div role="radiogroup" aria-label="Cómo contar" className="flex gap-2">
        {[
          [true, 'Por billete y moneda'],
          [false, 'Solo el total'],
        ].map(([v, label]) => (
          <Button
            key={String(v)}
            role="radio"
            aria-checked={byDenomination === v}
            variant={byDenomination === v ? 'primary' : 'outline'}
            onClick={() => setByDenomination(v as boolean)}
          >
            {label as string}
          </Button>
        ))}
      </div>
      {byDenomination ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {DENOMINATIONS.map((d) => (
            <NumberInput
              key={d}
              label={formatMoney(d, regional)}
              min={0}
              max={100000}
              value={counts[d] ?? 0}
              onChange={(n) => setCounts({ ...counts, [d]: n })}
            />
          ))}
        </div>
      ) : (
        <TextInput
          label="Efectivo contado"
          inputMode="decimal"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
        />
      )}
      <p className="text-lg font-bold">Contado: {formatMoney(counted ?? '0.00', regional)}</p>
      <TextInput
        label="Comentario"
        hint="Obligatorio si hay diferencia"
        value={comment}
        maxLength={500}
        onChange={(e) => setComment(e.target.value)}
      />
      {error && (
        <p
          role="alert"
          className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
        >
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={!counted} loading={close.isPending}>
        Cerrar turno e imprimir corte
      </Button>
    </form>
  );
}
