import { describe, expect, it } from 'vitest';
import { toMoney } from './admin-api.js';

describe('toMoney (precio escrito por el usuario → string decimal de la API)', () => {
  it.each([
    ['58', '58.00'],
    ['58.5', '58.50'],
    ['58,5', '58.50'],
    [' 17.50 ', '17.50'],
    ['0.1', '0.10'],
    ['007', '7.00'],
  ])('%s → %s', (input, expected) => {
    expect(toMoney(input)).toBe(expected);
  });

  it.each(['', 'abc', '-5', '1.234', '1e3'])('rechaza %s', (input) => {
    expect(toMoney(input)).toBeNull();
  });
});
