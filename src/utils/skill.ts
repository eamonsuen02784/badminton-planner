/** A player's current skill rating: their win rate, defaulting to 0.5 with no recorded games. */
export function computeSkill(name: string, winLoss: Record<string, { wins: number; losses: number }>): number {
  const wl = winLoss[name];
  if (!wl || wl.wins + wl.losses === 0) return 0.5;
  return wl.wins / (wl.wins + wl.losses);
}
