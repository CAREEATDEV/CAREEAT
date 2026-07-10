export function formatCountdown(target: number | null, from: number = Date.now()): string {
  if (!target || target <= from) return '—';
  const s = Math.round((target - from) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}min`;
}

export function computeGreenStreak(events: { at: number; type: string }[]): number {
  // Very simple heuristic: a day is "in the green" if we have >=1 water event
  // for it. Placeholder until we build proper daily aggregates.
  const days = new Set<string>();
  for (const e of events) {
    if (e.type !== 'drink') continue;
    const d = new Date(e.at);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  let streak = 0;
  const cur = new Date();
  while (true) {
    const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
    if (days.has(key)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
