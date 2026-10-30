import { describe, expect, it } from 'vitest';
import { canTransition } from '../../src/modules/consultations/service.js';

describe('consultation lifecycle', () => {
  it('allows only intended forward transitions and cancellation', () => {
    expect(canTransition('BOOKED', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransition('BOOKED', 'COMPLETED')).toBe(false);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });
});
