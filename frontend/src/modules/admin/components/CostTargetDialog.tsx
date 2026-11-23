// Objetivo de costo del restaurante, de una categoría o de un producto (RF-134, PA-045; H3 #22).
// Dueño: Deniscito; reasignado a Pablito. La categoría y el producto se pueden quitar: vuelven a
// usar el objetivo de arriba (producto > categoría > restaurante).
import {
  ROUNDING_STEPS,
  type CostTargetValues,
  type PutCostTargetRequest,
} from '@mise/shared/contracts/recipes';
import { useState } from 'react';
import { ApiError } from '../../../core/api/index.js';
import { Button, Modal, NumberInput, Select } from '../../../core/ui/index.js';
import { usePutCostTarget } from '../api/recipes-api.js';

export type TargetScope =
  | { scope: 'CLIENT' }
  | { scope: 'CATEGORY'; categoryId: string }
  | { scope: 'PRODUCT'; productId: string };

const MODE_LABEL: Record<CostTargetValues['roundingMode'], string> = {
  UP: 'hacia arriba',
  NEAREST: 'al más cercano',
};

/** "30 % · redondeo a Q 1.00 hacia arriba" */
export function describeTarget(t: CostTargetValues, symbol: string): string {
  return `${t.targetFoodCostPct} % · redondeo a ${symbol} ${t.roundingStep} ${MODE_LABEL[t.roundingMode]}`;
}

export function CostTargetDialog({
  target,
  title,
  current,
  inherited,
  inheritedFrom,
  symbol,
  onClose,
}: {
  target: TargetScope;
  title: string;
  /** El objetivo propio de este nivel; null si usa el de arriba */
  current: CostTargetValues | null;
  /** El que se usa si este nivel no tiene uno */
  inherited: CostTargetValues;
  inheritedFrom: string;
  symbol: string;
  onClose: () => void;
}) {
  const start = current ?? inherited;
  const [pct, setPct] = useState(Math.round(start.targetFoodCostPct));
  const [step, setStep] = useState<CostTargetValues['roundingStep']>(start.roundingStep);
  const [mode, setMode] = useState<CostTargetValues['roundingMode']>(start.roundingMode);
  const put = usePutCostTarget();
  const error =
    put.error instanceof ApiError ? put.error.message : put.error ? 'No se pudo guardar' : null;

  const send = (values: CostTargetValues | null) => {
    const body: PutCostTargetRequest =
      target.scope === 'CLIENT' ? { ...target, target: values! } : { ...target, target: values };
    put.mutate(body, { onSuccess: onClose });
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          send({ targetFoodCostPct: pct, roundingStep: step, roundingMode: mode });
        }}
      >
        {target.scope !== 'CLIENT' && (
          <p className="text-sm text-secondary">
            {current
              ? `Tiene su propio objetivo. Si lo quitas, usa el ${inheritedFrom}: ${describeTarget(inherited, symbol)}.`
              : `Ahora usa el ${inheritedFrom}: ${describeTarget(inherited, symbol)}.`}
          </p>
        )}
        <NumberInput
          label="Costo objetivo (% del precio)"
          hint="Ej. 30: el costo de la receta debe ser como máximo el 30 % del precio"
          value={pct}
          min={1}
          max={99}
          onChange={setPct}
          className="sm:max-w-64"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Redondear el precio sugerido a"
            value={step}
            options={ROUNDING_STEPS.map((s) => ({ value: s, label: `${symbol} ${s}` }))}
            onChange={(e) => setStep(e.target.value as CostTargetValues['roundingStep'])}
          />
          <Select
            label="Redondeo"
            value={mode}
            options={[
              { value: 'UP', label: 'Hacia arriba' },
              { value: 'NEAREST', label: 'Al más cercano' },
            ]}
            onChange={(e) => setMode(e.target.value as CostTargetValues['roundingMode'])}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-md border-2 border-error bg-background px-4 py-3 text-base"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          {target.scope !== 'CLIENT' && current && (
            <Button variant="outline" onClick={() => send(null)} disabled={put.isPending}>
              Quitar y usar el {inheritedFrom}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={put.isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
