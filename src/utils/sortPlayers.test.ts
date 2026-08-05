import { describe, it, expect } from 'vitest';
import { sortPlayerIndicesForDisplay } from './sortPlayers.js';

describe('sortPlayerIndicesForDisplay', () => {
  it('groups all M before all F, alphabetical within each group', () => {
    const players = [
      { name: 'Zoe', gender: 'F' },
      { name: 'Bob', gender: 'M' },
      { name: 'Alice', gender: 'F' },
      { name: 'Tom', gender: 'M' },
    ];
    const order = sortPlayerIndicesForDisplay(players).map(i => players[i]!.name);
    expect(order).toEqual(['Bob', 'Tom', 'Alice', 'Zoe']);
  });

  it('returns indices into the original array, not a reordered copy', () => {
    const players = [
      { name: 'Zoe', gender: 'F' },
      { name: 'Bob', gender: 'M' },
    ];
    const indices = sortPlayerIndicesForDisplay(players);
    expect(indices).toEqual([1, 0]);
  });

  it('is case-insensitive within a gender group', () => {
    const players = [
      { name: 'bob', gender: 'M' },
      { name: 'Alice', gender: 'M' },
    ];
    const order = sortPlayerIndicesForDisplay(players).map(i => players[i]!.name);
    expect(order).toEqual(['Alice', 'bob']);
  });

  it('handles an all-one-gender roster', () => {
    const players = [
      { name: 'Charlie', gender: 'M' },
      { name: 'Alice', gender: 'M' },
      { name: 'Bob', gender: 'M' },
    ];
    const order = sortPlayerIndicesForDisplay(players).map(i => players[i]!.name);
    expect(order).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  it('handles an empty roster', () => {
    expect(sortPlayerIndicesForDisplay([])).toEqual([]);
  });

  it('is stable for duplicate names within the same gender', () => {
    const players = [
      { name: 'Sam', gender: 'M' },
      { name: 'Sam', gender: 'M' },
    ];
    expect(sortPlayerIndicesForDisplay(players)).toEqual([0, 1]);
  });
});
