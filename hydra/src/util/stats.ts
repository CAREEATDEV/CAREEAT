// Pure, side-effect-free daily aggregates for the DONNÉES screen. Kept out of
// the engine so hydrationEngine.ts stays the single source of truth for the
// physiological model; these are just presentation-layer roll-ups.

import {
  computeState,
  DEFAULT_PROFILE,
  HydrationEvent,
  UserProfile,
} from '../engine/hydrationEngine';

const DAY_MS = 24 * 3600_000;

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

const isDrink = (e: HydrationEvent) =>
  e.type === 'water' ||
  e.type === 'electrolytes' ||
  e.type === 'alcohol' ||
  e.type === 'caffeine';

export interface DayDrinkStats {
  waterMl: number; // water + electrolytes volume drunk that day
  glasses: number; // number of drink events (water/electro/alcohol/caffeine)
  alcoholUnits: number; // count of alcohol events
}

// Aggregate the raw volumes/counts for the calendar day containing `dayStart`.
export function dayDrinkStats(
  events: HydrationEvent[],
  dayStart: number
): DayDrinkStats {
  const start = startOfDay(dayStart);
  const end = start + DAY_MS;
  let waterMl = 0;
  let glasses = 0;
  let alcoholUnits = 0;
  for (const e of events) {
    if (e.at < start || e.at >= end) continue;
    if (!isDrink(e)) continue;
    glasses += 1;
    if (e.type === 'water' || e.type === 'electrolytes') waterMl += e.volumeMl;
    if (e.type === 'alcohol') alcoholUnits += 1;
  }
  return { waterMl, glasses, alcoholUnits };
}

export interface DayBar {
  dayStart: number;
  label: string; // single-letter weekday (L M M J V S D)
  waterMl: number;
}

const WEEKDAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Water volume for each of the last `count` days, oldest first, newest last.
export function lastNDaysWater(
  events: HydrationEvent[],
  now: number,
  count = 7
): DayBar[] {
  const todayStart = startOfDay(now);
  const out: DayBar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const dayStart = todayStart - i * DAY_MS;
    out.push({
      dayStart,
      label: WEEKDAY_LETTERS[new Date(dayStart).getDay()],
      waterMl: dayDrinkStats(events, dayStart).waterMl,
    });
  }
  return out;
}

// Consecutive days (ending today, or yesterday if today is still empty) that
// reached at least `goalMl` of water. This is the "green streak".
export function greenStreak(
  events: HydrationEvent[],
  now: number,
  goalMl: number
): number {
  const todayStart = startOfDay(now);
  let streak = 0;
  // Today only breaks the streak if it's empty; a partial today still counts
  // once it hits the goal, so we start from today and walk backwards.
  for (let i = 0; ; i++) {
    const dayStart = todayStart - i * DAY_MS;
    const { waterMl } = dayDrinkStats(events, dayStart);
    if (waterMl >= goalMl) {
      streak += 1;
    } else if (i === 0) {
      // Today not reached yet — don't break the run built on previous days.
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// Share of the elapsed day spent in the green zone (sampled). Returns 0–100.
// Time-dependent (uses the engine), so callers pass an explicit `now`.
export function greenTimePctToday(
  events: HydrationEvent[],
  now: number,
  profile: UserProfile = DEFAULT_PROFILE,
  stepMs = 30 * 60_000
): number {
  const start = startOfDay(now);
  if (now <= start) return 100;
  let green = 0;
  let total = 0;
  for (let t = start; t <= now; t += stepMs) {
    total += 1;
    const s = computeState(events, t, profile);
    if (s.zone === 'green') green += 1;
  }
  return total === 0 ? 0 : Math.round((green / total) * 100);
}
