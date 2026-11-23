import { describe, expect, it } from 'vitest';
import { minutesSince, urgency } from './kds-timing.js';

describe('tiempos del KDS (Docs/05 paso 6)', () => {
  it('cuenta minutos enteros desde el envío', () => {
    const sent = '2026-11-23T12:00:00Z';
    expect(minutesSince(sent, Date.parse('2026-11-23T12:09:59Z'))).toBe(9);
    expect(minutesSince(sent, Date.parse('2026-11-23T11:59:00Z'))).toBe(0);
  });

  it('a tiempo, por vencer (10 min) y atrasado (20 min)', () => {
    expect(urgency(9)).toBe('onTime');
    expect(urgency(10)).toBe('warn');
    expect(urgency(20)).toBe('late');
  });
});
