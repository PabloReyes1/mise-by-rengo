import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDevUser, loadTemplate, validateTemplate, type Template } from './templates.js';

const TEMPLATES_DIR = join(import.meta.dirname, '..', '..', '..', 'templates');

function load(): Template {
  return loadTemplate(TEMPLATES_DIR, 'restaurante-basico');
}

describe('templates/seed (datos del producto, iguales para todo cliente)', () => {
  it('trae los 42 permisos del catálogo de Docs/03 §3, sin repetidos', () => {
    const { seed } = load();
    expect(seed.permissions).toHaveLength(42);
    expect(new Set(seed.permissions.map((p) => p.code)).size).toBe(42);
  });

  it('trae los tipos de orden MESA y PARA_LLEVAR, sin delivery (Docs/07 order_types)', () => {
    expect(load().seed.orderTypes.map((t) => t.code)).toEqual(['MESA', 'PARA_LLEVAR']);
  });

  it('trae las unidades de Docs/07 §4.6', () => {
    expect(load().seed.units.map((u) => u.code)).toEqual(['kg', 'g', 'l', 'ml', 'u', 'oz']);
  });
});

describe('templates/restaurante-basico (plantilla de onboarding)', () => {
  it('la plantilla real pasa todas las validaciones', () => {
    expect(validateTemplate(load())).toEqual([]);
  });

  it('trae los 5 roles por defecto de Docs/03 §2', () => {
    expect(load().roles.map((r) => r.name)).toEqual([
      'Administrador',
      'Gerente',
      'Cajero',
      'Mesero',
      'Cocina',
    ]);
  });

  it('el Administrador tiene todos los permisos y no se puede borrar', () => {
    const t = load();
    const admin = t.roles.find((r) => r.name === 'Administrador')!;
    expect(admin.isSystem).toBe(true);
    expect([...admin.permissions].sort()).toEqual(t.seed.permissions.map((p) => p.code).sort());
  });

  it('Cocina solo opera el KDS y marca agotados (Docs/03 §4)', () => {
    const cocina = load().roles.find((r) => r.name === 'Cocina')!;
    expect([...cocina.permissions].sort()).toEqual([
      'kds.operate',
      'kds.recall',
      'menu.toggle_soldout',
    ]);
  });

  it('los permisos 🔑 no van en el rol: el Mesero no tiene bill.reopen ni order.cancel_sent', () => {
    const mesero = load().roles.find((r) => r.name === 'Mesero')!;
    expect(mesero.permissions).not.toContain('bill.reopen');
    expect(mesero.permissions).not.toContain('order.cancel_sent');
    // En la plantilla el mesero sí cobra (S-06)
    expect(mesero.permissions).toContain('payment.register');
  });

  it('los descuentos vienen desactivados en la plantilla (S-05)', () => {
    expect(load().settings.discountsEnabled).toBe(false);
  });

  it('solo los métodos de tipo efectivo dan cambio (RF-027)', () => {
    for (const method of load().paymentMethods) {
      expect(method.givesChange).toBe(method.kind === 'CASH');
    }
  });

  it('hay un catálogo de motivos para cada tipo de Docs/07 reasons', () => {
    const types = new Set(load().reasons.map((r) => r.type));
    expect([...types].sort()).toEqual(
      [
        'CANCEL_ITEM',
        'CASH_DEPOSIT',
        'CASH_WITHDRAWAL',
        'CONFLICT',
        'DISCOUNT',
        'REOPEN_BILL',
      ].sort(),
    );
  });

  it('hay una plantilla de ticket por cada documento impreso (Docs/11)', () => {
    expect(
      load()
        .ticketTemplates.map((t) => t.docType)
        .sort(),
    ).toEqual(['COMANDA', 'CORTE', 'MOVIMIENTO', 'PRECUENTA', 'RECIBO'].sort());
  });

  it('el usuario de desarrollo NO es parte de la plantilla de un cliente', () => {
    expect(load()).not.toHaveProperty('devUser');
  });

  it('el usuario de desarrollo se carga aparte y usa roles que existen en la plantilla', () => {
    const dev = loadDevUser(TEMPLATES_DIR, 'restaurante-basico');
    const roles = load().roles.map((r) => r.name);
    expect(dev.roles.every((r) => roles.includes(r))).toBe(true);
  });
});

describe('validateTemplate detecta errores de referencia y formato', () => {
  it('un rol con un permiso que no existe', () => {
    const t = load();
    t.roles[1]!.permissions.push('bill.anular');
    expect(validateTemplate(t)).toContainEqual(expect.stringContaining('bill.anular'));
  });

  it('un producto con una categoría que no existe', () => {
    const t = load();
    t.menu.products[0]!.category = 'no-existe';
    expect(validateTemplate(t)).toContainEqual(expect.stringContaining('no-existe'));
  });

  it('un grupo de modificadores con mínimo mayor que el máximo', () => {
    const t = load();
    t.menu.modifierGroups[0]!.minSelect = 5;
    t.menu.modifierGroups[0]!.maxSelect = 1;
    expect(validateTemplate(t)).toContainEqual(expect.stringContaining('mínimo'));
  });

  it('dos productos con el mismo SKU', () => {
    const t = load();
    t.menu.products[1]!.sku = t.menu.products[0]!.sku;
    expect(validateTemplate(t)).toContainEqual(expect.stringContaining('SKU'));
  });

  it('sin ningún rol con config.roles (siempre debe quedar uno, Docs/03 §2)', () => {
    const t = load();
    for (const role of t.roles)
      role.permissions = role.permissions.filter((p) => p !== 'config.roles');
    expect(validateTemplate(t)).toContainEqual(expect.stringContaining('config.roles'));
  });
});

describe('loadTemplate rechaza datos con formato inválido', () => {
  it('un precio que no es decimal con 2 cifras falla al cargar', async () => {
    const { parseMenu } = await import('./templates.js');
    expect(() =>
      parseMenu({
        categories: [{ key: 'platos', name: 'Platos' }],
        modifierGroups: [],
        products: [{ key: 'x', sku: 'X', name: 'X', category: 'platos', price: 12.5 }],
        combos: [],
      }),
    ).toThrow(/price/);
  });
});
