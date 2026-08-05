import { describe, it, expect } from 'vitest';
import { pruneExpiredPlans } from './pruneExpiredPlans.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 15); // 2026-01-15

describe('pruneExpiredPlans', () => {
  it('keeps plans saved within the last 14 days', () => {
    const plans = [{ savedAt: new Date(NOW - 1 * DAY_MS).toISOString() }];
    expect(pruneExpiredPlans(plans, NOW)).toEqual(plans);
  });

  it('drops plans older than 14 days', () => {
    const plans = [{ savedAt: new Date(NOW - 15 * DAY_MS).toISOString() }];
    expect(pruneExpiredPlans(plans, NOW)).toEqual([]);
  });

  it('keeps a plan exactly at the 14-day boundary', () => {
    const plans = [{ savedAt: new Date(NOW - 14 * DAY_MS).toISOString() }];
    expect(pruneExpiredPlans(plans, NOW)).toEqual(plans);
  });

  it('filters a mixed list, preserving order of survivors', () => {
    const fresh1 = { savedAt: new Date(NOW - 1 * DAY_MS).toISOString(), tag: 'fresh1' };
    const stale = { savedAt: new Date(NOW - 20 * DAY_MS).toISOString(), tag: 'stale' };
    const fresh2 = { savedAt: new Date(NOW - 5 * DAY_MS).toISOString(), tag: 'fresh2' };
    expect(pruneExpiredPlans([fresh1, stale, fresh2], NOW)).toEqual([fresh1, fresh2]);
  });

  it('handles an empty list', () => {
    expect(pruneExpiredPlans([], NOW)).toEqual([]);
  });
});
