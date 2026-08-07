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

  it('rejects scores past the 30-point cap, even by a valid-looking margin of 2', () => {
    // Fixed bug: the deuce rule previously had no upper bound on `hi`, so 31-29,
    // 40-38, etc. incorrectly validated. Only 30-29 is a valid score at the cap.
    expect(isValidBadmintonScore(31, 29)).toBe(false);
    expect(isValidBadmintonScore(40, 38)).toBe(false);
  });

  it('rejects 30-28 (any hi=30 score other than 30-29 is impossible under rally-point rules)', () => {
    expect(isValidBadmintonScore(30, 28)).toBe(false);
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
