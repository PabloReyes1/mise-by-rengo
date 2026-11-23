// Caja (Docs/05 paso 1, H3 #18): abrir turno (solo con conexión, PA-042), resumen del turno y
// retiros/depósitos con motivo (🔑 si hace falta). El cobro (#19) y el corte (#20) se agregan aquí.
// Reasignado a Deniscito (doc 17 §3.1).
import type { CashMovement, CashRegister, ShiftDetail } from '@mise/shared/contracts/cash';
import { newId } from '@mise/shared/domain/ids';
import type { ShiftReport } from '@mise/shared/contracts/cash';
import { ArrowDownToLine, ArrowUpFromLine, Calculator, LockOpen, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../../core/api/index.js';
import { usePublicConfig, useRegional } from '../../../core/config/index.js';
import { formatDateTime, formatMoney, formatTime, toMoney } from '../../../core/format/index.js';
import { movimientoDocument, printWithDialog } from '../../../core/print/index.js';
import { authorizationRequired, useAuthorizationPrompt } from '../../../core/session/index.js';
import { Badge, Button, Card, Modal, Select, TextInput } from '../../../core/ui/index.js';
import { CloseShiftDialog } from '../components/CloseShiftDialog.js';
import { TodayBills } from '../components/TodayBills.js';
import { useBrowserOnline } from '../hooks/use-online.js';
import {
  useAddMovement,
  useCashReasons,
  useCashRegisters,
  useFloorNames,
  useOpenOccupancies,
  useOpenShift,
  useShift,
  useStartClose,
  type MovementInput,
} from '../api/cash-api.js';

/** Comprobante de retiro o depósito (Docs/11 §4.5): al registrarlo y al reimprimir. */
function usePrintMovement(registerName: string) {
  const regional = useRegional();
  const config = usePublicConfig();
  return (m: CashMovement, reprint: boolean) => {
    if (m.type !== 'RETIRO' && m.type !== 'DEPOSITO') return;
    void printWithDialog(
      movimientoDocument({
        restaurant: config.data?.tradeName ?? '',
        register: registerName,
        type: m.type,
        amount: formatMoney(m.amount, regional),
        at: formatDateTime(m.at, regional),
        reason: m.reasonName,
        note: m.note,
        user: m.userName,
        authorizedBy: m.authorizedByName,
        reprint,
      }),
    );
  };
}

const errorText = (e: unknown) =>
  e instanceof ApiError ? e.message : e ? 'No se pudo completar' : null;

export function CajaPage() {
  const registers = useCashRegisters();
  const [chosen, setChosen] = useState<string | null>(null);
  if (registers.isPending) return <p className="text-base text-secondary">Cargando cajas…</p>;
  if (!registers.data?.length)
    return <p role="alert">Esta sucursal no tiene cajas. Créalas en Configuración.</p>;
  const register = registers.data.find((r) => r.id === chosen) ?? registers.data[0]!;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold">Caja</h2>
        {registers.data.length > 1 && (
          <Select
            label="Caja"
            value={register.id}
            options={registers.data.map((r) => ({
              value: r.id,
              label: r.name + (r.isMain ? ' (principal)' : ''),
            }))}
            onChange={(e) => setChosen(e.target.value)}
          />
        )}
      </header>
      {register.openShift ? <ShiftView register={register} /> : <OpenShift register={register} />}
      <OpenTables cashRegisterId={register.id} />
      <TodayBills cashRegisterId={register.id} />
    </div>
  );
}

function OpenShift({ register }: { register: CashRegister }) {
  const regional = useRegional();
  const online = useBrowserOnline();
  const open = useOpenShift();
  const fixed = register.openingFloatMode === 'FIJO';
  const [amount, setAmount] = useState(register.suggestedFloat ?? '');
  const value = fixed ? register.openingFloatAmount : toMoney(amount);
  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-lg font-bold">Abrir turno · {register.name}</h3>
      {fixed ? (
        <p className="text-base">
          Fondo inicial fijo:{' '}
          <span className="font-bold tabular">
            {formatMoney(register.openingFloatAmount, regional)}
          </span>
        </p>
      ) : (
        <TextInput
          label="Fondo inicial (efectivo en el cajón)"
          hint={register.suggestedFloat ? 'Sugerido: lo que quedó en el último corte' : undefined}
          inputMode="decimal"
          value={amount}
          error={amount && !value ? 'Escribe un monto, ej. 500 o 500.50' : undefined}
          onChange={(e) => setAmount(e.target.value)}
        />
      )}
      {errorText(open.error) && (
        <p
          role="alert"
          className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
        >
          {errorText(open.error)}
        </p>
      )}
      <Button
        size="lg"
        icon={<LockOpen />}
        disabled={!online || !value}
        loading={open.isPending}
        onClick={() => value && open.mutate({ cashRegisterId: register.id, openingFloat: value })}
      >
        {online ? 'Abrir turno' : 'Requiere conexión'}
      </Button>
    </Card>
  );
}

function ShiftView({ register }: { register: CashRegister }) {
  const regional = useRegional();
  const summary = register.openShift!;
  const shift = useShift(summary.id);
  const [moving, setMoving] = useState<'RETIRO' | 'DEPOSITO' | null>(null);
  const startClose = useStartClose();
  const [closing, setClosing] = useState<ShiftReport | null>(null);
  const printMovement = usePrintMovement(register.name);
  const data = shift.data ?? { ...summary, movements: [] };
  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className={strong ? 'font-bold tabular' : 'tabular'}>{value}</span>
    </div>
  );
  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">{register.name}</h3>
          <Badge tone="success">Turno abierto</Badge>
        </div>
        <p className="text-sm text-secondary">
          Abrió {data.openedByName} · {formatDateTime(data.openedAt, regional)}
        </p>
        <div className="flex flex-col gap-1 text-base">
          {row('Fondo inicial', formatMoney(data.openingFloat, regional))}
          {row('Cobros en efectivo', formatMoney(data.cashSalesTotal, regional))}
          {row('Depósitos', formatMoney(data.depositsTotal, regional))}
          {row('Retiros', `-${formatMoney(data.withdrawalsTotal, regional)}`)}
          {data.expectedCash !== null
            ? row('Efectivo esperado', formatMoney(data.expectedCash, regional), true)
            : row('Efectivo esperado', 'Se ve al contar (corte a ciegas)')}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" icon={<ArrowUpFromLine />} onClick={() => setMoving('RETIRO')}>
            Retiro
          </Button>
          <Button
            variant="outline"
            icon={<ArrowDownToLine />}
            onClick={() => setMoving('DEPOSITO')}
          >
            Depósito
          </Button>
          <Button
            variant="secondary"
            icon={<Calculator />}
            loading={startClose.isPending}
            onClick={() => startClose.mutate(summary.id, { onSuccess: setClosing })}
          >
            Hacer corte
          </Button>
        </div>
      </Card>

      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">Movimientos</h3>
        {data.movements.length === 0 ? (
          <p className="text-base text-secondary">Sin retiros ni depósitos.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-accent border-y border-accent">
            {data.movements.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex flex-col">
                  <span className="font-semibold">
                    {m.type === 'RETIRO'
                      ? 'Retiro'
                      : m.type === 'DEPOSITO'
                        ? 'Depósito'
                        : 'Reverso por reapertura'}
                    {m.reasonName ? ` · ${m.reasonName}` : ''}
                  </span>
                  <span className="text-sm text-secondary">
                    {formatTime(m.at, regional)} · {m.userName}
                    {m.note ? ` · ${m.note}` : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular">
                    {m.type === 'DEPOSITO' ? '' : '-'}
                    {formatMoney(m.amount, regional)}
                  </span>
                  {m.type !== 'REVERSO_REAPERTURA' && (
                    <Button
                      variant="outline"
                      icon={<Printer />}
                      aria-label={`Reimprimir comprobante de ${m.type === 'RETIRO' ? 'retiro' : 'depósito'}`}
                      onClick={() => printMovement(m, true)}
                    >
                      Reimprimir
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <MovementDialog
        shiftId={summary.id}
        type={moving}
        onClose={() => setMoving(null)}
        onSaved={(m) => printMovement(m, false)}
      />
      <CloseShiftDialog register={register} start={closing} onClose={() => setClosing(null)} />
    </>
  );
}

function MovementDialog({
  shiftId,
  type,
  onClose,
  onSaved,
}: {
  shiftId: string;
  type: 'RETIRO' | 'DEPOSITO' | null;
  onClose: () => void;
  onSaved: (movement: CashMovement) => void;
}) {
  return (
    <Modal
      open={type !== null}
      onClose={onClose}
      title={type === 'RETIRO' ? 'Retiro de efectivo' : 'Depósito de efectivo'}
    >
      {type && (
        <MovementForm
          key={type}
          shiftId={shiftId}
          type={type}
          onDone={(shift, id) => {
            const saved = shift.movements.find((m) => m.id === id);
            if (saved) onSaved(saved);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}

function MovementForm({
  shiftId,
  type,
  onDone,
}: {
  shiftId: string;
  type: 'RETIRO' | 'DEPOSITO';
  onDone: (shift: ShiftDetail, movementId: string) => void;
}) {
  const reasons = useCashReasons(type === 'RETIRO' ? 'CASH_WITHDRAWAL' : 'CASH_DEPOSIT');
  const add = useAddMovement();
  const { prompt, dialog } = useAuthorizationPrompt();
  const [amount, setAmount] = useState('');
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const value = toMoney(amount);
  const valid = value && Number(value) > 0 && reasonId;

  const submit = () => {
    if (!valid) return;
    // El mismo id también si se repite con 🔑: el servidor no lo duplica
    const input: MovementInput & { id: string } = {
      id: newId(),
      shiftId,
      type,
      amount: value,
      reasonId,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    add.mutate(input, {
      onSuccess: (shift) => onDone(shift, input.id),
      onError: (error) => {
        const permission = authorizationRequired(error);
        if (!permission) return;
        add.reset();
        prompt(
          {
            permission,
            actionLabel: type === 'RETIRO' ? 'Retiro de efectivo' : 'Depósito de efectivo',
          },
          async (authorization) => {
            onDone(await add.mutateAsync({ ...input, authorization }), input.id);
          },
        );
      },
    });
  };

  return (
    <>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <TextInput
          label="Monto"
          inputMode="decimal"
          value={amount}
          error={amount && !value ? 'Escribe un monto, ej. 150 o 150.50' : undefined}
          onChange={(e) => setAmount(e.target.value)}
        />
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
        {errorText(add.error) && (
          <p role="alert" className="text-base">
            {errorText(add.error)}
          </p>
        )}
        <Button type="submit" disabled={!valid} loading={add.isPending}>
          {type === 'RETIRO' ? 'Registrar retiro' : 'Registrar depósito'}
        </Button>
      </form>
      {/* Fuera del <form>: dentro, su botón mandaría el formulario de afuera */}
      {dialog}
    </>
  );
}

/**
 * Cuentas por cobrar (H3 #19): la caja cobra cualquier mesa abierta (table.view_all) en la misma
 * pantalla de cuentas del mesero (cobro, descuentos, pre-cuenta). Lleva la caja para que el cobro
 * sin efectivo se anote en ella (SC-59).
 */
export function OpenTables({ cashRegisterId }: { cashRegisterId: string }) {
  const regional = useRegional();
  const open = useOpenOccupancies();
  const floor = useFloorNames();
  const list = open.data ?? [];
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-lg font-bold">Por cobrar</h3>
      {open.isPending && <p className="text-base text-secondary">Cargando…</p>}
      {!open.isPending && list.length === 0 && (
        <p className="text-base text-secondary">No hay mesas abiertas.</p>
      )}
      <ul className="flex flex-col divide-y divide-accent border-y border-accent">
        {list.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
            <span className="flex flex-col">
              <span className="font-semibold">
                {o.tableId
                  ? `Mesa ${[floor.get(o.tableId) ?? '', ...o.mergedTables.map((t) => t.name)].filter(Boolean).join(' + ')}`
                  : `Para llevar${o.customerName ? `: ${o.customerName}` : ''}`}
              </span>
              <span className="text-sm text-secondary">
                {o.waiterName} · desde {formatTime(o.openedAt, regional)}
              </span>
            </span>
            <Link
              to={`/mesero/ocupacion/${o.id}/cuentas`}
              state={{ cashRegisterId }}
              className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-4 font-semibold text-white no-underline"
            >
              Cobrar
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
