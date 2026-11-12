// Catálogo de componentes con contenido real de restaurante (solo en desarrollo: /_ui).
// Sirve para revisar contraste, estados y tamaños táctiles en celular, tablet y KDS.
import { Banknote, Check, Printer, Send, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { formatMoney } from '../core/format/index.js';
import {
  Badge,
  Button,
  Card,
  ConnectionIndicator,
  Modal,
  NumericKeypad,
  Select,
  Switch,
  TextInput,
} from '../core/ui/index.js';
import { THEMES } from '../styles/themes/index.js';

const GT = { locale: 'es-GT', currency: 'GTQ', timeZone: 'America/Guatemala' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function UiPreview() {
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [combo, setCombo] = useState(true);
  const theme = THEMES['botanical-graphite']!;
  const total = '203.50';

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Sistema de diseño · Botanical Graphite</h1>
        <p className="text-base text-secondary">
          Componentes base de <code>core/ui</code> con sus estados. Solo existe en desarrollo.
        </p>
      </header>

      <Section title="Tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              'primary',
              'secondary',
              'accent',
              'surface',
              'background',
              'success',
              'warning',
              'error',
            ] as const
          ).map((token) => (
            <li key={token} className="flex items-center gap-3">
              <span
                className="size-10 shrink-0 rounded-md border border-accent"
                style={{ backgroundColor: `var(--color-${token})` }}
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold">{token}</span>
                <span className="text-xs text-secondary tabular">{theme[token]}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={<Send />}>Enviar a cocina</Button>
          <Button variant="secondary" icon={<Printer />}>
            Imprimir pre-cuenta
          </Button>
          <Button variant="outline">Dividir cuenta</Button>
          <Button variant="danger" icon={<Trash2 />}>
            Cancelar ítem
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" icon={<Banknote />}>
            Cobrar {formatMoney(total, GT)}
          </Button>
          <Button loading>Enviando…</Button>
          <Button disabled>Sin turno abierto</Button>
        </div>
      </Section>

      <Section title="Conexión">
        <div className="flex flex-wrap gap-6">
          <ConnectionIndicator status="online" />
          <ConnectionIndicator status="unstable" />
          <ConnectionIndicator status="offline" pending={3} />
        </div>
      </Section>

      <Section title="Tarjetas">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-lg font-bold">Mesa 5</h3>
              <span className="text-sm font-semibold tabular">4 personas · 47 min</span>
            </div>
            <ul className="flex flex-col gap-1 text-base">
              <li className="flex justify-between gap-4">
                <span>2 × Pepián de pollo</span>
                <span className="tabular">{formatMoney('128.00', GT)}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>1 × Jocón</span>
                <span className="tabular">{formatMoney('58.00', GT)}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>1 × Horchata</span>
                <span className="tabular">{formatMoney('17.50', GT)}</span>
              </li>
            </ul>
            <div className="flex justify-between gap-4 border-t border-accent pt-3 text-lg font-bold">
              <span>Total</span>
              <span className="tabular">{formatMoney(total, GT)}</span>
            </div>
          </Card>
          <Card variant="outlined" className="flex flex-col gap-2">
            <h3 className="text-lg font-bold">Para llevar · Ana López</h3>
            <p className="text-base text-secondary">
              Pedido enviado a las 12:04. Recoge a las 12:30.
            </p>
            <span className="self-start rounded-sm bg-accent px-2 py-1 text-xs font-bold">
              ADICIONAL
            </span>
          </Card>
        </div>
      </Section>

      <Section title="Teclado numérico">
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="flex max-w-xs flex-col gap-3">
            <h3 className="text-base font-semibold">Monto recibido</h3>
            <NumericKeypad
              mode="amount"
              maxLength={9}
              value={amount}
              onChange={setAmount}
              label="Monto recibido"
              prefix="Q"
            />
          </div>
          <div className="flex max-w-xs flex-col gap-3">
            <h3 className="text-base font-semibold">PIN de autorización</h3>
            <NumericKeypad mode="pin" maxLength={4} value={pin} onChange={setPin} label="PIN" />
          </div>
        </div>
      </Section>

      <Section title="Formularios">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
          <TextInput label="Nombre" defaultValue="Pepián de pollo" />
          <TextInput label="Precio" defaultValue="64.5x" error="Escribe un monto como 58 o 58.50" />
          <Select
            label="Estado"
            options={[
              { value: 'A', label: 'Disponible' },
              { value: 'S', label: 'Agotado' },
            ]}
          />
          <TextInput label="Deshabilitado" disabled defaultValue="Sin permiso" />
        </div>
        <div className="max-w-2xl">
          <Switch
            label="Es un combo"
            hint="Producto con componentes a elegir"
            checked={combo}
            onChange={setCombo}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">Disponible</Badge>
          <Badge tone="warning">Agotado</Badge>
          <Badge tone="error">Cancelado</Badge>
          <Badge>Combo</Badge>
        </div>
      </Section>

      <Section title="Modal">
        <div>
          <Button variant="outline" onClick={() => setConfirming(true)}>
            Confirmar cobro
          </Button>
        </div>
        <Modal
          open={confirming}
          onClose={() => setConfirming(false)}
          title={`Cobrar ${formatMoney(total, GT)} en efectivo`}
          description="Mesa 5 · Cuenta 1 de 1. El cambio se calcula con el monto recibido."
          actions={
            <>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Volver
              </Button>
              <Button icon={<Check />} onClick={() => setConfirming(false)}>
                Cobrar
              </Button>
            </>
          }
        />
      </Section>
    </main>
  );
}
