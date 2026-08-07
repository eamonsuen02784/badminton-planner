/** Badminton rally-point scoring: first to 21 by 2, cap at 30 (30-29 wins outright). */
export function isValidBadmintonScore(a: number, b: number): boolean {
  if (a === b || a < 0 || b < 0) return false;
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi === 21 && lo <= 19) return true;
  if (hi >= 22 && hi <= 29 && lo >= 20 && hi - lo === 2) return true;
  if (hi === 30 && lo === 29) return true;
  return false;
}
