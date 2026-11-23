// Cálculos de costeo sin base de datos (Docs/07 §4.6, RF-131 a RF-136). Dueño: Deniscito;
// reasignado a Pablito (doc 17 §3.1, H3 #22).
//   costo = Σ cantidad_convertida × (1 + merma%) × costo_unitario
//   precio_sugerido = redondeo(costo / food_cost_pct)
//   margen_real = (precio − costo) / precio
import type { CostTargetValues } from '@mise/shared/contracts/recipes';
import { Prisma } from '../../generated/prisma/client.js';

type Decimal = Prisma.Decimal;
type Num = Decimal | string | number;
const D = (v: Num) => new Prisma.Decimal(v);

export interface Conversion {
  fromUnitId: string;
  toUnitId: string;
  factor: Decimal;
}

/**
 * Factor para pasar `from` a `to` (1 from = factor × to). Las conversiones se recorren en los dos
 * sentidos y encadenadas (oz→g→kg). null si no hay camino (otra dimensión).
 */
export function unitFactor(conversions: Conversion[], from: string, to: string): Decimal | null {
  if (from === to) return D(1);
  const edges = new Map<string, { to: string; factor: Decimal }[]>();
  const add = (a: string, b: string, f: Decimal) =>
    edges.set(a, [...(edges.get(a) ?? []), { to: b, factor: f }]);
  for (const c of conversions) {
    add(c.fromUnitId, c.toUnitId, c.factor);
    add(c.toUnitId, c.fromUnitId, D(1).div(c.factor));
  }
  const seen = new Set([from]);
  let frontier: { unit: string; factor: Decimal }[] = [{ unit: from, factor: D(1) }];
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const { unit, factor } of frontier) {
      for (const e of edges.get(unit) ?? []) {
        if (seen.has(e.to)) continue;
        const f = factor.times(e.factor);
        if (e.to === to) return f;
        seen.add(e.to);
        next.push({ unit: e.to, factor: f });
      }
    }
    frontier = next;
  }
  return null;
}

/** Costo de una línea de receta: cantidad en la unidad base × (1 + merma) × costo unitario. */
export function lineCost(
  quantity: Num,
  factorToBase: Decimal,
  wastePct: Num,
  unitCost: Num,
): Decimal {
  return D(quantity)
    .times(factorToBase)
    .times(D(1).plus(D(wastePct).div(100)))
    .times(unitCost)
    .toDecimalPlaces(4);
}

/** Redondea el precio al paso (PA-045): UP hacia arriba (por defecto) o NEAREST al más cercano. */
export function roundPrice(value: Decimal, step: string, mode: CostTargetValues['roundingMode']) {
  const s = D(step);
  const units = value.div(s);
  const rounded =
    mode === 'UP' ? units.ceil() : units.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  return rounded.times(s).toDecimalPlaces(2);
}

const pct = (v: Decimal) => Number(v.times(100).toDecimalPlaces(2));

/** Precio sugerido, % de costo y margen real de un producto (RF-135, RF-136). */
export function costing(cost: Decimal | null, price: Decimal, target: CostTargetValues) {
  if (cost === null)
    return { suggestedPrice: null, foodCostPct: null, marginPct: null, belowTarget: false };
  const suggested = roundPrice(
    cost.div(D(target.targetFoodCostPct).div(100)),
    target.roundingStep,
    target.roundingMode,
  );
  if (price.lte(0))
    return { suggestedPrice: suggested, foodCostPct: null, marginPct: null, belowTarget: true };
  const foodCost = cost.div(price);
  return {
    suggestedPrice: suggested,
    foodCostPct: pct(foodCost),
    marginPct: pct(D(1).minus(foodCost)),
    // Bajo el objetivo: el costo se come más del % objetivo del precio
    belowTarget: foodCost.times(100).gt(target.targetFoodCostPct),
  };
}
