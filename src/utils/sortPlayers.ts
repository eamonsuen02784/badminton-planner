/**
 * Returns indices into `players` ordered for display: grouped by gender
 * (M before F), alphabetical by name within each group. Returning indices
 * rather than a sorted copy lets callers keep using original array
 * positions (e.g. React state update handlers) after reordering for display.
 */
export function sortPlayerIndicesForDisplay(players: { name: string; gender: string }[]): number[] {
  return players
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = players[a]!, pb = players[b]!;
      if (pa.gender !== pb.gender) return pa.gender === 'M' ? -1 : 1;
      return pa.name.localeCompare(pb.name);
    });
}
