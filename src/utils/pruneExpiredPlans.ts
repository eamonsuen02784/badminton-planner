import { ARCHIVE_TTL_MS } from '../constants';

/** Drops Saved Plans entries older than ARCHIVE_TTL_MS, relative to `now`. */
export function pruneExpiredPlans<T extends { savedAt: string }>(savedPlans: T[], now: number): T[] {
  const cutoff = now - ARCHIVE_TTL_MS;
  return savedPlans.filter(p => new Date(p.savedAt).getTime() >= cutoff);
}
