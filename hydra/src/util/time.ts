export function formatCountdown(target: number | null, from: number = Date.now()): string {
  if (!target || target <= from) return '—';
  const s = Math.round((target - from) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
  return `${m}min`;
}

// Second-precise variant for the live "ROUGE DANS" timer on the BARRE screen —
// the ticking seconds make the drain feel real. (The native widget can't tick
// per second, so it keeps the coarse formatCountdown above.)
export function formatCountdownPrecise(
  target: number | null,
  from: number = Date.now()
): string {
  if (!target || target <= from) return '—';
  const total = Math.max(0, Math.round((target - from) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}
