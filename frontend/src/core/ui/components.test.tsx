import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button, ConnectionIndicator, NumericKeypad } from './index.js';

function AmountKeypad() {
  const [value, setValue] = useState('');
  return (
    <NumericKeypad
      mode="amount"
      maxLength={9}
      value={value}
      onChange={setValue}
      label="Monto recibido"
      prefix="Q"
    />
  );
}

describe('Button', () => {
  it('ejecuta la acción al tocarlo', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Enviar a cocina</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Enviar a cocina' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('deshabilitado no ejecuta la acción y lo anuncia (no solo con color)', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Sin turno abierto
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Sin turno abierto' });
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('cargando no permite tocarlo dos veces y lo anuncia', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Enviando
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Enviando' });
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('el botón destructivo usa texto grande en negrita (blanco sobre error, PA-049 a)', () => {
    render(<Button variant="danger">Cancelar ítem</Button>);
    expect(screen.getByRole('button').className).toMatch(/text-lg!.*font-bold!/);
  });
});

describe('NumericKeypad', () => {
  it('arma el monto tocando las teclas', async () => {
    render(<AmountKeypad />);
    for (const key of ['2', '0', '3', 'Punto decimal', '5']) {
      await userEvent.click(screen.getByRole('button', { name: key }));
    }
    expect(screen.getByRole('status', { name: 'Monto recibido' })).toHaveTextContent('203.5');
  });

  it('borrar quita el último dígito', async () => {
    render(<AmountKeypad />);
    await userEvent.click(screen.getByRole('button', { name: '7' }));
    await userEvent.click(screen.getByRole('button', { name: '5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(screen.getByRole('status', { name: 'Monto recibido' })).toHaveTextContent('7');
  });

  it('acepta el teclado físico cuando tiene el foco (caja con teclado)', async () => {
    render(<AmountKeypad />);
    screen.getByRole('group', { name: 'Monto recibido' }).focus();
    await userEvent.keyboard('150,25');
    expect(screen.getByRole('status', { name: 'Monto recibido' })).toHaveTextContent('150.25');
  });

  it('el PIN no muestra los dígitos', async () => {
    function Pin() {
      const [value, setValue] = useState('');
      return (
        <NumericKeypad mode="pin" maxLength={4} value={value} onChange={setValue} label="PIN" />
      );
    }
    render(<Pin />);
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: '8' }));
    expect(screen.getByRole('group', { name: 'PIN' })).not.toHaveTextContent('48');
    expect(screen.getByLabelText('PIN: 2 de 4 dígitos')).toBeInTheDocument();
  });
});

describe('ConnectionIndicator', () => {
  it.each([
    ['online', 'En línea'],
    ['unstable', 'Inestable'],
    ['offline', 'Sin conexión'],
  ] as const)('el estado %s se dice con texto, no solo con color', (status, text) => {
    render(<ConnectionIndicator status={status} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
  });

  it('muestra las operaciones pendientes de enviar', () => {
    render(<ConnectionIndicator status="offline" pending={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('3 pendientes');
  });
});
