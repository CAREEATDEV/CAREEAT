// Pure, deterministic event-sourced hydration engine.
// The level is never stored as mutable state — it is always recomputed from
// the ordered event log for a given point in time. Keeping this file free
// of side effects makes it trivially symmetric with the Swift port used by
// the widget (see targets/widget/HydrationEngine.swift).

export type DrinkKind = 'water' | 'beer' | 'wine' | 'shot';

export type HydrationEvent =
  | { type: 'drink'; kind: DrinkKind; at: number; volumeMl?: number }
  | { type: 'settings'; at: number; settings: Partial<EngineSettings> };

export interface EngineSettings {
  // Daily water goal in ml — used to derive water gain per 250ml glass.
  dailyGoalMl: number;
  // Sleep window during which passive drain is paused. Wraps midnight.
  sleepStartHour: number; // 0..23
  sleepEndHour: number;   // 0..23
  // Awake hours over which a full 100% drains without any drinks.
  awakeHoursToEmpty: number;
  // Container sizes (ml).
  waterMl: number;   // default 250
  beerMl: number;    // (informational)
  wineMl: number;
  shotMl: number;
}

export const DEFAULT_SETTINGS: EngineSettings = {
  dailyGoalMl: 2000,
  sleepStartHour: 23,
  sleepEndHour: 7,
  awakeHoursToEmpty: 10,
  waterMl: 250,
  beerMl: 330,
  wineMl: 150,
  shotMl: 40,
};

// Instantaneous drink impact on the bar (percent points).
export const DRINK_IMPACT: Record<Exclude<DrinkKind, 'water'>, number> = {
  beer: -8,
  wine: -6,
  shot: -15,
};

// Poison window durations added per drink (minutes).
export const POISON_MIN: Record<Exclude<DrinkKind, 'water'>, number> = {
  beer: 90,
  wine: 90,
  shot: 120,
};

export const POISON_CAP_MIN = 240; // 4 hours total
export const POISON_MULTIPLIER = 3;

export type Zone = 'green' | 'amber' | 'red' | 'poison';

export interface HydrationState {
  level: number;      // 0..100
  zone: Zone;
  poisoned: boolean;
  poisonUntil: number | null;
  // Timestamp when we predict the bar will hit each zone next (ms epoch),
  // or null if we don't cross it in the forecast horizon.
  ambleAt: number | null;
  redAt: number | null;
}

export function waterGainPerGlass(settings: EngineSettings): number {
  // Design brief says +14% per 250ml at a 2000ml goal — keep that as the
  // reference and scale linearly with container size and goal.
  const ref = (250 / 2000) * 100 * (14 / 12.5); // ≈ 14
  const perMl = ref / 250;
  return perMl * settings.waterMl;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function isSleeping(at: number, s: EngineSettings): boolean {
  const d = new Date(at);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const { sleepStartHour: a, sleepEndHour: b } = s;
  if (a === b) return false;
  return a < b ? h >= a && h < b : h >= a || h < b;
}

// Base drain rate in %/ms during awake, non-poison time.
function baseDrainRate(s: EngineSettings): number {
  const msAwakeToEmpty = s.awakeHoursToEmpty * 3_600_000;
  return 100 / msAwakeToEmpty;
}

// Compute total poison milliseconds active on the interval [from, to],
// given a list of already-active poison windows (sorted by start).
// Windows produce a union — we don't multiply the multiplier itself.
function unionActiveMs(
  windows: Array<{ start: number; end: number }>,
  from: number,
  to: number
): number {
  if (to <= from) return 0;
  let acc = 0;
  let cursor = from;
  for (const w of windows) {
    if (w.end <= from) continue;
    if (w.start >= to) break;
    const s = Math.max(w.start, cursor, from);
    const e = Math.min(w.end, to);
    if (e > s) acc += e - s;
    if (w.end > cursor) cursor = w.end;
  }
  return acc;
}

// Merge overlapping intervals (assumes sorted by start).
function mergeIntervals(
  xs: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const x of xs) {
    const last = out[out.length - 1];
    if (last && x.start <= last.end) {
      last.end = Math.max(last.end, x.end);
    } else {
      out.push({ ...x });
    }
  }
  return out;
}

// Integrate drain over [from, to] with settings, poison windows and sleep.
// Returns the total percent points drained (positive number).
function integrateDrain(
  from: number,
  to: number,
  s: EngineSettings,
  poisonWindows: Array<{ start: number; end: number }>
): number {
  if (to <= from) return 0;
  // We sample at 60s granularity — small enough for a 15-minute widget entry
  // to be accurate to a fraction of a percent, cheap enough for six hours.
  const STEP = 60_000;
  const rate = baseDrainRate(s);
  let acc = 0;
  let t = from;
  while (t < to) {
    const next = Math.min(t + STEP, to);
    const midpoint = (t + next) / 2;
    if (!isSleeping(midpoint, s)) {
      const poisoned = poisonWindows.some(
        (w) => midpoint >= w.start && midpoint < w.end
      );
      const mult = poisoned ? POISON_MULTIPLIER : 1;
      acc += rate * mult * (next - t);
    }
    t = next;
  }
  return acc;
}

// Extract the effective settings snapshot at time `at` (applies the last
// settings event that occurred at or before `at`, if any).
function effectiveSettings(
  events: HydrationEvent[],
  at: number,
  base: EngineSettings
): EngineSettings {
  let s = { ...base };
  for (const e of events) {
    if (e.at > at) break;
    if (e.type === 'settings') s = { ...s, ...e.settings };
  }
  return s;
}

// Extract poison windows from the drink history, capped and merged.
function extractPoisonWindows(
  events: HydrationEvent[]
): Array<{ start: number; end: number }> {
  const raw: Array<{ start: number; end: number }> = [];
  let carryEnd = 0;
  for (const e of events) {
    if (e.type !== 'drink') continue;
    if (e.kind === 'water') continue;
    const durMin = POISON_MIN[e.kind];
    // Cumulative: if a new poison arrives while another is active, extend
    // the window from the previous end instead of overlapping it, so the
    // *total* poisoned time grows. Cap the tail at POISON_CAP_MIN from
    // the earliest still-active start.
    const start = carryEnd > e.at ? carryEnd : e.at;
    let end = start + durMin * 60_000;
    // find the earliest active window still open at e.at to enforce cap
    const activeAt = raw.find((w) => w.end > e.at);
    if (activeAt) {
      const capEnd = activeAt.start + POISON_CAP_MIN * 60_000;
      if (end > capEnd) end = capEnd;
    } else {
      const capEnd = e.at + POISON_CAP_MIN * 60_000;
      if (end > capEnd) end = capEnd;
    }
    raw.push({ start, end });
    carryEnd = end;
  }
  return mergeIntervals(raw);
}

export function zoneOf(level: number, poisoned: boolean): Zone {
  if (poisoned) return 'poison';
  if (level > 55) return 'green';
  if (level >= 25) return 'amber';
  return 'red';
}

// Compute state at `at` from the full event log. Level starts at 100 at the
// earliest event (or at `at` itself if none) — that's the "fresh install"
// behavior and it's fine because the first drink event happens at that time.
export function computeState(
  events: HydrationEvent[],
  at: number,
  baseSettings: EngineSettings = DEFAULT_SETTINGS
): HydrationState {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const poisonWindows = extractPoisonWindows(sorted);

  // Level starts at 100. If there are no events, we haven't started tracking
  // — return 100 unchanged rather than draining against an arbitrary origin.
  if (sorted.length === 0) {
    return {
      level: 100,
      zone: 'green',
      poisoned: false,
      poisonUntil: null,
      ambleAt: null,
      redAt: null,
    };
  }

  let level = 100;
  let cursor = sorted[0].at;
  for (const e of sorted) {
    // Drain from cursor -> e.at using settings effective at midpoint.
    const s = effectiveSettings(sorted, e.at, baseSettings);
    level -= integrateDrain(cursor, e.at, s, poisonWindows);
    level = clamp(level, 0, 100);
    if (e.type === 'drink') {
      const s2 = effectiveSettings(sorted, e.at, baseSettings);
      if (e.kind === 'water') {
        level += waterGainPerGlass(s2);
      } else {
        level += DRINK_IMPACT[e.kind];
      }
      level = clamp(level, 0, 100);
    }
    cursor = e.at;
  }
  // Drain from last event to `at`.
  const s = effectiveSettings(sorted, at, baseSettings);
  level -= integrateDrain(cursor, at, s, poisonWindows);
  level = clamp(level, 0, 100);

  const active = poisonWindows.find((w) => at >= w.start && at < w.end);
  const poisoned = !!active;
  const poisonUntil = active ? active.end : null;

  const zone = zoneOf(level, poisoned);
  const { ambleAt, redAt } = forecastZoneCrossings(
    events,
    at,
    level,
    baseSettings,
    poisonWindows
  );
  return { level, zone, poisoned, poisonUntil, ambleAt, redAt };
}

// Forecast when we'll enter amber (<=55) and red (<25) starting from
// (at, level). Uses the same integration engine but bails out early once
// both thresholds are hit or we hit the 6h horizon.
export function forecastZoneCrossings(
  _events: HydrationEvent[],
  at: number,
  startLevel: number,
  baseSettings: EngineSettings,
  poisonWindows: Array<{ start: number; end: number }>,
  horizonMs: number = 6 * 3_600_000
): { ambleAt: number | null; redAt: number | null } {
  let ambleAt: number | null = startLevel <= 55 ? at : null;
  let redAt: number | null = startLevel < 25 ? at : null;
  if (ambleAt !== null && redAt !== null) return { ambleAt, redAt };
  const STEP = 60_000;
  const rate = baseDrainRate(baseSettings);
  let level = startLevel;
  let t = at;
  const end = at + horizonMs;
  while (t < end) {
    const next = Math.min(t + STEP, end);
    const midpoint = (t + next) / 2;
    if (!isSleeping(midpoint, baseSettings)) {
      const poisoned = poisonWindows.some(
        (w) => midpoint >= w.start && midpoint < w.end
      );
      const mult = poisoned ? POISON_MULTIPLIER : 1;
      level -= rate * mult * (next - t);
    }
    if (ambleAt === null && level <= 55) ambleAt = next;
    if (redAt === null && level < 25) {
      redAt = next;
      break;
    }
    t = next;
  }
  return { ambleAt, redAt };
}

// Convenience: full state at "now" using a Date.
export function stateNow(
  events: HydrationEvent[],
  settings?: EngineSettings
): HydrationState {
  return computeState(events, Date.now(), settings);
}
