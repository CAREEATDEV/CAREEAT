import { HydrationEvent } from '../engine/hydrationEngine';
import {
  dayDrinkStats,
  greenStreak,
  lastNDaysWater,
  startOfDay,
} from './stats';

const DAY_MS = 24 * 3600_000;

// A fixed reference "now" at midday so intraday timestamps stay in the same day.
const NOON = startOfDay(Date.parse('2026-01-15T00:00:00')) + 12 * 3600_000;

describe('dayDrinkStats', () => {
  it('sums water + electrolytes and counts glasses for the day', () => {
    const events: HydrationEvent[] = [
      { type: 'water', at: NOON - 3600_000, volumeMl: 250 },
      { type: 'water', at: NOON - 1800_000, volumeMl: 500 },
      { type: 'electrolytes', at: NOON - 900_000, volumeMl: 300 },
      { type: 'alcohol', at: NOON - 600_000, volumeMl: 400, abv: 5 },
      // previous day — must be excluded
      { type: 'water', at: NOON - DAY_MS, volumeMl: 999 },
    ];
    const s = dayDrinkStats(events, NOON);
    expect(s.waterMl).toBe(1050);
    expect(s.glasses).toBe(4);
    expect(s.alcoholUnits).toBe(1);
  });

  it('returns zeros for an empty day', () => {
    expect(dayDrinkStats([], NOON)).toEqual({
      waterMl: 0,
      glasses: 0,
      alcoholUnits: 0,
    });
  });
});

describe('lastNDaysWater', () => {
  it('returns 7 buckets, newest last, each with the right daily total', () => {
    const events: HydrationEvent[] = [
      { type: 'water', at: NOON, volumeMl: 1000 }, // today
      { type: 'water', at: NOON - 2 * DAY_MS, volumeMl: 400 }, // 2 days ago
    ];
    const bars = lastNDaysWater(events, NOON, 7);
    expect(bars).toHaveLength(7);
    expect(bars[6].waterMl).toBe(1000); // today is last
    expect(bars[4].waterMl).toBe(400); // 2 days ago
    expect(bars[0].waterMl).toBe(0); // 6 days ago, nothing
  });
});

describe('greenStreak', () => {
  it('counts consecutive days meeting the goal, tolerating a partial today', () => {
    const goal = 2000;
    const events: HydrationEvent[] = [
      { type: 'water', at: NOON - DAY_MS, volumeMl: 2000 }, // yesterday: reached
      { type: 'water', at: NOON - 2 * DAY_MS, volumeMl: 2200 }, // 2d ago: reached
      { type: 'water', at: NOON - 3 * DAY_MS, volumeMl: 500 }, // 3d ago: missed
    ];
    // Today has nothing yet → streak keeps the 2 previous reached days.
    expect(greenStreak(events, NOON, goal)).toBe(2);
  });

  it('is 0 when yesterday missed the goal', () => {
    const events: HydrationEvent[] = [
      { type: 'water', at: NOON - DAY_MS, volumeMl: 100 },
    ];
    expect(greenStreak(events, NOON, 2000)).toBe(0);
  });
});
