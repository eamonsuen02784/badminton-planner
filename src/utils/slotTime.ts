/**
 * Formats a 1-indexed slot's time window. Without a session start time, shows
 * a relative offset (e.g. "~0–15m"); with one, shows actual clock times.
 */
export function formatSlotTime(slotIdx: number, { gameMinutes, sessionStart }: { gameMinutes: number; sessionStart: string }): string {
  const startMin = (slotIdx - 1) * gameMinutes;
  const endMin = slotIdx * gameMinutes;
  if (!sessionStart) return `~${startMin}–${endMin}m`;
  const [h, m] = sessionStart.split(':').map(Number);
  const fmt = (totalMin: number) => {
    const d = new Date(2000, 0, 1, h, m! + totalMin);
    const hh = d.getHours();
    const mm = d.getMinutes();
    const ampm = hh >= 12 ? 'PM' : 'AM';
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${ampm}`;
  };
  return `${fmt(startMin)} – ${fmt(endMin)}`;
}
