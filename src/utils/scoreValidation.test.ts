import { describe, it, expect } from 'vitest';
import { isValidBadmintonScore } from './scoreValidation.js';

describe('isValidBadmintonScore', () => {
  it('accepts a standard 21-point win', () => {
    expect(isValidBadmintonScore(21, 15)).toBe(true);
    expect(isValidBadmintonScore(21, 19)).toBe(true);
  });

  it('rejects 21 vs 20 (must win by 2 past 20-20)', () => {
    expect(isValidBadmintonScore(21, 20)).toBe(false);
  });

  it('accepts deuce wins by exactly 2 above 20', () => {
    expect(isValidBadmintonScore(22, 20)).toBe(true);
    expect(isValidBadmintonScore(24, 22)).toBe(true);
    expect(isValidBadmintonScore(29, 27)).toBe(true);
  });

  it('rejects a deuce win that is not by exactly 2', () => {
    expect(isValidBadmintonScore(23, 20)).toBe(false);
    expect(isValidBadmintonScore(22, 19)).toBe(false);
  });

  it('caps at 30, where 30-29 wins outright even though it is only +1', () => {
    expect(isValidBadmintonScore(30, 29)).toBe(true);
  });

  // Known gap (pre-existing, not introduced by this extraction): the deuce-win
  // rule (`hi >= 22 && lo >= 20 && hi - lo === 2`) has no upper bound on `hi`,
  // so scores past the real 30-point cap (e.g. 31-29) currently validate as true.
  it('does not actually enforce the 30-point cap on the deuce rule (current behavior)', () => {
    expect(isValidBadmintonScore(31, 29)).toBe(true);
    expect(isValidBadmintonScore(40, 38)).toBe(true);
  });

  it('rejects equal scores', () => {
    expect(isValidBadmintonScore(20, 20)).toBe(false);
  });

  it('rejects negative scores', () => {
    expect(isValidBadmintonScore(-1, 10)).toBe(false);
    expect(isValidBadmintonScore(21, -5)).toBe(false);
  });

  it('rejects a low, non-deuce score below 20', () => {
    expect(isValidBadmintonScore(10, 5)).toBe(false);
  });

  it('is symmetric regardless of which argument is the winner', () => {
    expect(isValidBadmintonScore(15, 21)).toBe(true);
    expect(isValidBadmintonScore(20, 22)).toBe(true);
  });
});
