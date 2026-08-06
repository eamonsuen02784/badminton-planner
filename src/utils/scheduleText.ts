import { formatSlotTime } from './slotTime.js';

/**
 * Parses the text produced by buildCopyText (the group-chat copy format) back into a
 * schedule. Player names are resolved against the current roster case-insensitively;
 * an unrecognized name still round-trips as a placeholder ({ name, gender: '?' }).
 */
export function parseScheduleText(text: string, players: { name: string; gender: string }[]) {
  const playerMap = Object.fromEntries(players.map(p => [p.name.toLowerCase(), p]));
  const resolve = (name: string) => playerMap[name.toLowerCase()] || { name, gender: '?' };
  const slots: any[] = [];
  let cur: any = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const slotMatch = line.match(/^--- Slot (\d+) .* ---$/);
    if (slotMatch) {
      if (cur) slots.push(cur);
      cur = { slot: +slotMatch[1]!, courts: [], sitting: [] };
      continue;
    }
    if (!cur) continue;
    const courtMatch = line.match(/^(?:Court (\d+): )?(.+?)\s{2}vs\s{2}(.+)$/);
    if (courtMatch) {
      cur.courts.push({
        court: courtMatch[1] ? +courtMatch[1] : cur.courts.length + 1,
        teamA: courtMatch[2]!.split('&').map(n => resolve(n.trim())),
        teamB: courtMatch[3]!.split('&').map(n => resolve(n.trim())),
      });
      continue;
    }
    const sitMatch = line.match(/^Sit: (.+)$/);
    if (sitMatch) cur.sitting = sitMatch[1]!.split(',').map(n => resolve(n.trim()));
  }
  if (cur) slots.push(cur);
  return slots.length > 0 ? { schedule: slots, gamesPlayed: players.map(() => 0) } : null;
}

/** Builds the group-chat copy text ('full' includes sit list + games-played tally, 'games' is matchups only). */
export function buildCopyText(
  result: { schedule: any[]; gamesPlayed: number[] } | null,
  {
    mode,
    extraCourt,
    numCourts,
    gameMinutes,
    sessionStart,
    totalSlots,
    players,
    scores,
  }: {
    mode: 'full' | 'games';
    extraCourt: { enabled: boolean; startMin: number; durationMin: number };
    numCourts: number;
    gameMinutes: number;
    sessionStart: string;
    totalSlots: number;
    players: { name: string }[];
    scores: Record<string, { a: string; b: string; applied?: boolean }>;
  }
): string {
  if (!result) return '';
  const hasMultiCourts = result.schedule.some(s => s.courts.length > 1);
  const courtDesc = extraCourt.enabled
    ? ` · ${numCourts} court${numCourts > 1 ? 's' : ''} +1 extra (${extraCourt.startMin}–${extraCourt.startMin + extraCourt.durationMin}m)`
    : numCourts > 1 ? ` × ${numCourts} courts` : '';
  const lines = [`🏸 Badminton Schedule — ${totalSlots} slots × ${gameMinutes} min${courtDesc}\n`];
  result.schedule.forEach(s => {
    lines.push(`--- Slot ${s.slot} (${formatSlotTime(s.slot, { gameMinutes, sessionStart })}) ---`);
    s.courts.forEach((court: any, ci: number) => {
      const tA = court.teamA.map((p: any) => p.name).join(' & ');
      const tB = court.teamB.map((p: any) => p.name).join(' & ');
      const sc = scores[`s${s.slot}c${ci}`];
      const scoreStr = sc?.applied ? `  [${sc.a}–${sc.b}]` : '';
      lines.push(`  ${hasMultiCourts ? `Court ${court.court}: ` : ''}${tA}  vs  ${tB}${scoreStr}`);
    });
    if (mode === 'full' && s.sitting?.length > 0) lines.push(`  Sit: ${s.sitting.map((p: any) => p.name).join(', ')}`);
  });
  if (mode === 'full') {
    lines.push('\nGames per player:');
    players.forEach((p, i) => lines.push(`  ${p.name}: ${result.gamesPlayed[i]}`));
  }
  return lines.join('\n');
}
