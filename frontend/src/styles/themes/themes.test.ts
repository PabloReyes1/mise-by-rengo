import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateTheme } from '@mise/shared/domain/theme';
import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme } from './apply-theme.js';
import { DEFAULT_THEME_ID, THEMES } from './index.js';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  document.documentElement.removeAttribute('data-theme');
});

describe('temas (Docs/18 §8)', () => {
  it('el tema por defecto es Botanical Graphite', () => {
    expect(DEFAULT_THEME_ID).toBe('botanical-graphite');
    expect(THEMES[DEFAULT_THEME_ID]).toBeDefined();
  });

  it.each(Object.values(THEMES))('$id cumple todas las combinaciones de contraste', (theme) => {
    expect(validateTheme(theme)).toEqual([]);
  });

  it('los valores por defecto del CSS son los del tema por defecto (primera pintura sin saltos)', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'index.css'), 'utf8');
    const normalized = css.toLowerCase();
    for (const [token, value] of Object.entries(THEMES[DEFAULT_THEME_ID]!)) {
      if (token === 'id') continue;
      expect(normalized, `--color-${token}`).toContain(`--color-${token}: ${value.toLowerCase()};`);
    }
  });
});

describe('applyTheme', () => {
  it('pone data-theme y escribe las variables CSS del tema', () => {
    applyTheme('botanical-graphite');
    const root = document.documentElement;
    expect(root.dataset['theme']).toBe('botanical-graphite');
    expect(root.style.getPropertyValue('--color-primary')).toBe('#243A35');
    expect(root.style.getPropertyValue('--color-background')).toBe('#F8F7F2');
  });

  it('con un primary del cliente que cumple, solo cambia --color-primary', () => {
    applyTheme('botanical-graphite', '#1F3A5F');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--color-primary')).toBe('#1F3A5F');
    expect(root.style.getPropertyValue('--color-secondary')).toBe('#526D61');
  });

  it('ignora un primary del cliente que no cumple el contraste y usa el del tema', () => {
    applyTheme('botanical-graphite', '#A5A58D');
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#243A35');
  });

  it('un tema desconocido cae al tema por defecto', () => {
    applyTheme('no-existe');
    expect(document.documentElement.dataset['theme']).toBe('botanical-graphite');
  });
});
