// Contador con botones grandes para una mano (RNF-060): comensales, cantidad de un producto.
// Usa NumberStepper de core/ui: − y + de 56 px y el número también se puede escribir.
import { NumberStepper } from '../../../core/ui/index.js';

export interface StepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}

export function Stepper(props: StepperProps) {
  return <NumberStepper {...props} />;
}
