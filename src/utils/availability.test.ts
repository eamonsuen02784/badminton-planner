import { describe, it, expect } from 'vitest';
import { applyAvailability } from './availability.js';

describe('applyAvailability', () => {
  it("'none' mode: everyone is available for the whole session", () => {
    const players = [{ name: 'A' }, { name: 'B' }];
    const result = applyAvailability(players, { staggerMode: 'none', totalSlots: 12 });
    expect(result).toEqual([
      { name: 'A', availFrom: 0, availTo: 11 },
      { name: 'B', availFrom: 0, availTo: 11 },
    ]);
  });

  it("'group' mode: 'full' group players get the whole session", () => {
    const players = [{ name: 'A', group: 'full' }];
    const result = applyAvailability(players, { staggerMode: 'group', totalSlots: 12 });
    expect(result[0]).toMatchObject({ availFrom: 0, availTo: 11 });
  });

  it("'group' mode: 'early' players get 0 through mid+overlap-1", () => {
    // totalSlots=12: midSlot=6, overlap=max(1, floor(12*0.2))=2 -> availTo = 6+2-1 = 7
    const players = [{ name: 'A', group: 'early' }];
    const result = applyAvailability(players, { staggerMode: 'group', totalSlots: 12 });
    expect(result[0]).toMatchObject({ availFrom: 0, availTo: 7 });
  });

  it("'group' mode: 'late' players get mid-overlap through the end", () => {
    // midSlot=6, overlap=2 -> availFrom = 6-2 = 4
    const players = [{ name: 'A', group: 'late' }];
    const result = applyAvailability(players, { staggerMode: 'group', totalSlots: 12 });
    expect(result[0]).toMatchObject({ availFrom: 4, availTo: 11 });
  });

  it("'custom' mode leaves the player's own availFrom/availTo untouched", () => {
    const players = [{ name: 'A', availFrom: 3, availTo: 8 }];
    const result = applyAvailability(players, { staggerMode: 'custom', totalSlots: 12 });
    expect(result[0]).toMatchObject({ availFrom: 3, availTo: 8 });
  });

  it('leavesAt clamps availTo down, but never extends it', () => {
    const early = applyAvailability([{ name: 'A', group: 'early', leavesAt: 2 }], { staggerMode: 'group', totalSlots: 12 });
    expect(early[0]!.availTo).toBe(2); // clamped below the group's natural availTo of 7

    const full = applyAvailability([{ name: 'B', group: 'full', leavesAt: 20 }], { staggerMode: 'group', totalSlots: 12 });
    expect(full[0]!.availTo).toBe(11); // leavesAt beyond the session doesn't extend it
  });

  it('leaves availFrom untouched when leavesAt is set (leavesAt only bounds the end)', () => {
    const result = applyAvailability([{ name: 'A', group: 'late', leavesAt: 5 }], { staggerMode: 'group', totalSlots: 12 });
    expect(result[0]).toMatchObject({ availFrom: 4, availTo: 5 });
  });
});
