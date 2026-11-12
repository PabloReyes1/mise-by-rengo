import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  validatePrimaryOverride,
  validateTheme,
  type ThemeTokens,
} from './index.js';

// Valores de Docs/18 §2
const botanical: ThemeTokens = {
  id: 'botanical-graphite',
  primary: '#243A35',
  secondary: '#526D61',
  accent: '#A5A58D',
  surface: '#E9E5D8',
  background: '#F8F7F2',
  success: '#38845B',
  warning: '#D69B3D',
  error: '#C65353',
};

describe('contrastRatio (fórmula de luminancia WCAG, tabla de Docs/18 §4)', () => {
  it.each([
    ['#FFFFFF', '#243A35', 12.13], // blanco sobre primary
    ['#243A35', '#F8F7F2', 11.31], // primary sobre background
    ['#526D61', '#E9E5D8', 4.48], // secondary sobre surface
    ['#A5A58D', '#F8F7F2', 2.34], // accent sobre background
    ['#243A35', '#D69B3D', 4.98], // primary sobre warning
  ])('%s sobre %s = %f', (fg, bg, expected) => {
    expect(contrastRatio(fg, bg)).toBeCloseTo(expected, 2);
  });

  it('acepta hex de 3 dígitos y en minúsculas', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 2);
  });
});

describe('validateTheme (combinaciones permitidas de Docs/18 §4.1)', () => {
  it('Botanical Graphite pasa todas las reglas', () => {
    expect(validateTheme(botanical)).toEqual([]);
  });

  it('un tema con warning oscuro falla y dice qué combinación no cumple', () => {
    const malo = { ...botanical, warning: '#6B5420' };
    const fallas = validateTheme(malo);
    expect(fallas).toHaveLength(1);
    expect(fallas[0]).toMatchObject({ foreground: 'primary', background: 'warning', minimum: 4.5 });
  });
});

describe('validatePrimaryOverride (el cliente solo cambia primary, PA-048)', () => {
  it('acepta un primary oscuro', () => {
    expect(validatePrimaryOverride('#1F3A5F', botanical)).toEqual([]);
  });

  it('rechaza un primary claro y explica las tres reglas que no cumple', () => {
    const fallas = validatePrimaryOverride('#A5A58D', botanical);
    expect(fallas.map((f) => `${f.foreground}/${f.background}`)).toEqual([
      'white/primary',
      'primary/background',
      'primary/surface',
    ]);
  });

  it('rechaza un valor que no es un color hex', () => {
    expect(() => validatePrimaryOverride('verde', botanical)).toThrow(/color/);
  });
});

describe('temas del producto (Docs/18 §8.4)', () => {
  it('todos los temas que se pueden elegir pasan el validador', async () => {
    const { THEMES } = await import('./index.js');
    for (const theme of Object.values(THEMES)) {
      expect(validateTheme(theme), theme.id).toEqual([]);
    }
  });

  it('los temas pendientes de PA-057 no pasan y por eso no se pueden elegir', async () => {
    const { THEMES, THEMES_PENDING_REVIEW } = await import('./index.js');
    for (const theme of Object.values(THEMES_PENDING_REVIEW)) {
      expect(validateTheme(theme).length, theme.id).toBeGreaterThan(0);
      expect(THEMES[theme.id]).toBeUndefined();
    }
  });

  it('themeById cae al tema por defecto con un id desconocido o pendiente', async () => {
    const { themeById } = await import('./index.js');
    expect(themeById('no-existe').id).toBe('botanical-graphite');
    expect(themeById('cielo-de-medianoche').id).toBe('botanical-graphite');
  });
});
