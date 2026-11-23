// Cuentas de hoy en la caja (Docs/05 paso 14, H3 #20): reabrir una cuenta pagada en efectivo
// (motivo y 🔑 si hace falta) y cobrar de nuevo las reabiertas. Reasignado a Deniscito.
import type { PaidBillSummary } from '@mise/shared/contracts/billing';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../core/api/index.js';
import { useRegional } from '../../../core/config/index.js';
import { formatMoney, formatTime } from '../../../core/format/index.js';
import { authorizationRequired, useAuthorizationPrompt } from '../../../core/session/index.js';
import { Button, Modal, Select, TextInput } from '../../../core/ui/index.js';
import { useReopenBill, useReopenReasons, useTodayBills } from '../api/cash-api.js';

export function TodayBills({ cashRegisterId }: { cashRegisterId: string }) {
  const regional = useRegional();
  const today = useTodayBills();
  const [reopening, setReopening] = useState<PaidBillSummary | null>(null);
  const { paid = [], reopened = [] } = today.data ?? {};
  return (
    <>
      {reopened.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-bold">Cuentas reabiertas</h3>
          <ul className="flex flex-col divide-y divide-accent border-y border-accent">
            {reopened.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <span>
                  {b.where} · {b.name} · {formatMoney(b.total, regional)}
                </span>
                <Link
                  to={`/mesero/ocupacion/${b.occupancyId}/cuentas`}
                  className="inline-flex min-h-12 items-center rounded-md bg-primary px-4 font-semibold text-white no-underline"
                >
                  Corregir y cobrar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Pagadas hoy</h3>
        {paid.length === 0 && (
          <p className="text-base text-secondary">Todavía no hay cobros hoy.</p>
        )}
        <ul className="flex flex-col divide-y divide-accent border-y border-accent">
          {paid.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="flex flex-col">
                <span className="font-semibold">
                  #{b.folio} · {b.where} · {b.name}
                </span>
                <span className="text-sm text-secondary">
                  {b.paidAt ? formatTime(b.paidAt, regional) : ''} ·{' '}
                  {formatMoney(b.total, regional)}
                  {b.cashOnly ? '' : ' · no se reabre (no fue en efectivo)'}
                </span>
              </span>
              {b.cashOnly && (
                <Button variant="outline" icon={<RotateCcw />} onClick={() => setReopening(b)}>
                  Reabrir
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <Modal open={reopening !== null} onClose={() => setReopening(null)} title="Reabrir cuenta">
        {reopening && (
          <ReopenForm
            bill={reopening}
            cashRegisterId={cashRegisterId}
            onDone={() => setReopening(null)}
          />
        )}
      </Modal>
    </>
  );
}

function ReopenForm({
  bill,
  cashRegisterId,
  onDone,
}: {
  bill: PaidBillSummary;
  cashRegisterId: string;
  onDone: () => void;
}) {
  const reasons = useReopenReasons();
  const reopen = useReopenBill();
  const { prompt, dialog } = useAuthorizationPrompt();
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const input = {
    billId: bill.id,
    reasonId,
    cashRegisterId,
    version: bill.version,
    ...(note.trim() ? { note: note.trim() } : {}),
  };
  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!reasonId) return;
          reopen.mutate(input, {
            onSuccess: onDone,
            onError: (error) => {
              const permission = authorizationRequired(error);
              if (!permission) return;
              reopen.reset();
              prompt(
                { permission, actionLabel: `Reabrir ${bill.where} · ${bill.name}` },
                async (authorization) => {
                  await reopen.mutateAsync({ ...input, authorization });
                  onDone();
                },
              );
            },
          });
        }}
      >
        <p className="text-base">
          Los pagos en efectivo se revierten y sale un reverso del turno abierto de esta caja.
          Después se corrige la cuenta y se cobra de nuevo con recibo nuevo.
        </p>
        <Select
          label="Motivo"
          value={reasonId}
          options={[
            { value: '', label: 'Elige el motivo' },
            ...(reasons.data ?? []).map((r) => ({ value: r.id, label: r.name })),
          ]}
          onChange={(e) => setReasonId(e.target.value)}
        />
        <TextInput
          label="Nota (opcional)"
          value={note}
          maxLength={140}
          onChange={(e) => setNote(e.target.value)}
        />
        {reopen.error && (
          <p role="alert" className="text-base">
            {reopen.error instanceof ApiError ? reopen.error.message : 'No se pudo reabrir'}
          </p>
        )}
        <Button type="submit" variant="danger" disabled={!reasonId} loading={reopen.isPending}>
          Reabrir cuenta
        </Button>
      </form>
      {dialog}
    </>
  );
}
