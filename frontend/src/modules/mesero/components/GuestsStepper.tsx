// Número de comensales (1–99, Docs/05 paso 2).
import { Stepper } from './Stepper.js';

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 99;

export function GuestsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Stepper
      label="Comensales"
      value={value}
      onChange={onChange}
      min={MIN_GUESTS}
      max={MAX_GUESTS}
    />
  );
}
