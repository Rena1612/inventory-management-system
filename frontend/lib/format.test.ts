import { describe, expect, it } from 'vitest';

import { MOVEMENT_LABEL, formatDelta } from './format';

/**
 * The sign of a movement used to be derived here from its type, which coupled the
 * UI to a ledger rule. The API now returns `delta` (see movement_service.DELTA_SQL
 * and test_delta_reports_the_effect_on_stock), so all that is left is formatting
 * the number it hands over.
 */
describe('formatDelta', () => {
  it('always shows a sign so a column of deltas scans as up or down', () => {
    expect(formatDelta(600)).toBe('+600');
    expect(formatDelta(-1500)).toBe('−1,500');
  });

  it('renders the sign it is given rather than deciding one', () => {
    expect(formatDelta(30)).toBe('+30');
    expect(formatDelta(-30)).toBe('−30');
    expect(formatDelta(7)).toBe('+7');
    expect(formatDelta(-12)).toBe('−12');
  });

  it('uses a true minus so mono columns stay aligned', () => {
    expect(formatDelta(-1500)).toContain('−');
    expect(formatDelta(-1500)).not.toContain('-');
  });

  it('rounds away float noise from NUMERIC strings', () => {
    expect(formatDelta(0.1 + 0.2)).toBe('+0.3');
  });
});

describe('MOVEMENT_LABEL', () => {
  it('covers every movement type the API can return', () => {
    for (const key of ['in', 'out', 'adjust', 'transfer_in', 'transfer_out'] as const) {
      expect(MOVEMENT_LABEL[key]).toBeTruthy();
    }
  });
});