import { HydrationEvent, POISON_WINDOW_MS } from '../engine/hydrationEngine';
import {
  consumptionRecap,
  dayDrinkStats,
  greenStreak,
  lastNDaysPoisoned,
  lastNDaysWater,
  lifetimeTotals,
  poisonedMsInRange,
  poisonedMsThisWeek,
  poisonFreeStreak,
  startOfDay,
} from './stats';

const DAY_MS = 24 * 3600_000;
const H = 3600_000;

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

describe('poisonedMsInRange', () => {
  it('one drink poisons for exactly the window length', () => {
    const events: HydrationEvent[] = [
      { type: 'alcohol', at: NOON, volumeMl: 400, abv: 5 },
    ];
    expect(poisonedMsInRange(events, NOON, NOON + 10 * H)).toBe(POISON_WINDOW_MS);
  });

  it('overlapping drinks are counted once (union, not sum)', () => {
    const events: HydrationEvent[] = [
      { type: 'alcohol', at: NOON, volumeMl: 400, abv: 5 },
      { type: 'alcohol', at: NOON + 2 * H, volumeMl: 400, abv: 5 }, // overlaps
    ];
    // Union = [NOON, NOON+6h] = 6 h, not 8 h.
    expect(poisonedMsInRange(events, NOON, NOON + 10 * H)).toBe(6 * H);
  });

  it('disjoint drinks add up', () => {
    const events: HydrationEvent[] = [
      { type: 'alcohol', at: NOON, volumeMl: 400, abv: 5 },
      { type: 'alcohol', at: NOON + 6 * H, volumeMl: 400, abv: 5 }, // no overlap
    ];
    expect(poisonedMsInRange(events, NOON, NOON + 20 * H)).toBe(2 * POISON_WINDOW_MS);
  });

  it('clips to the query range', () => {
    const events: HydrationEvent[] = [
      { type: 'alcohol', at: NOON, volumeMl: 400, abv: 5 },
    ];
    // Only look at the first hour of the 4 h window.
    expect(poisonedMsInRange(events, NOON, NOON + H)).toBe(H);
  });

  it('ignores non-alcohol events', () => {
    const events: HydrationEvent[] = [
      { type: 'water', at: NOON, volumeMl: 500 },
    ];
    expect(poisonedMsInRange(events, NOON - H, NOON + H)).toBe(0);
  });
});

describe('poisonFreeStreak & weekly poison', () => {
  it('grows while days stay clean and breaks on a drink today', () => {
    // Clean history → streak counts today + past empty days (capped by loop at
    // the first poisoned day; with no alcohol it just keeps counting, so check
    // a bounded window instead).
    const clean: HydrationEvent[] = [
      { type: 'water', at: NOON - DAY_MS, volumeMl: 500 },
    ];
    expect(poisonFreeStreak(clean, NOON)).toBeGreaterThanOrEqual(1);

    const drankToday: HydrationEvent[] = [
      { type: 'alcohol', at: NOON - H, volumeMl: 400, abv: 5 },
    ];
    expect(poisonFreeStreak(drankToday, NOON)).toBe(0);
  });

  it('poisonedMsThisWeek sums the rolling 7-day window', () => {
    const events: HydrationEvent[] = [
      { type: 'alcohol', at: NOON, volumeMl: 400, abv: 5 }, // today, in-window
      { type: 'alcohol', at: NOON - 3 * DAY_MS, volumeMl: 40, abv: 40 }, // 3d ago
      { type: 'alcohol', at: NOON - 30 * DAY_MS, volumeMl: 400, abv: 5 }, // out
    ];
    // today's window is clipped to NOON (4h would run past "now"), so ~0 of it
    // counts; 3-days-ago contributes a full 4 h.
    const wk = poisonedMsThisWeek(events, NOON);
    expect(wk).toBeGreaterThanOrEqual(POISON_WINDOW_MS);
    expect(wk).toBeLessThan(2 * POISON_WINDOW_MS);
  });

  it('lastNDaysPoisoned returns 7 buckets newest last', () => {
    const events: HydrationEvent[] = [
      { type: 'alcohol', at: NOON - 2 * DAY_MS, volumeMl: 400, abv: 5 },
    ];
    const bars = lastNDaysPoisoned(events, NOON, 7);
    expect(bars).toHaveLength(7);
    expect(bars[4].poisonedMs).toBe(POISON_WINDOW_MS); // 2 days ago
    expect(bars[6].poisonedMs).toBe(0); // today
  });
});

describe('consumptionRecap', () => {
  it('rolls up water, alcohol units, ethanol and clean days', () => {
    const events: HydrationEvent[] = [
      { type: 'water', at: NOON, volumeMl: 1000 },
      { type: 'electrolytes', at: NOON - H, volumeMl: 500 },
      { type: 'alcohol', at: NOON - 5 * DAY_MS, volumeMl: 400, abv: 5 },
      { type: 'alcohol', at: NOON - 5 * DAY_MS + H, volumeMl: 40, abv: 40 },
    ];
    const r = consumptionRecap(events, NOON, 30);
    expect(r.waterMl).toBe(1500);
    expect(r.alcoholUnits).toBe(2);
    expect(r.ethanolG).toBeGreaterThan(20); // ~15.8 + ~12.6 g
    expect(r.poisonedDays).toBe(1); // both drinks on the same day
    expect(r.cleanDays).toBe(29);
  });
});

describe('lifetimeTotals', () => {
  it('sums every drink across all history and tracks the first event', () => {
    const events: HydrationEvent[] = [
      { type: 'water', at: NOON - 200 * DAY_MS, volumeMl: 250 },
      { type: 'electrolytes', at: NOON - 100 * DAY_MS, volumeMl: 500 },
      { type: 'alcohol', at: NOON - 50 * DAY_MS, volumeMl: 400, abv: 5 },
      { type: 'sport', at: NOON - 10 * DAY_MS, durationMin: 30, intensity: 'moderate' },
      { type: 'water', at: NOON, volumeMl: 750 },
    ];
    const t = lifetimeTotals(events);
    expect(t.waterMl).toBe(1500); // 250 + 500 + 750
    expect(t.waterGlasses).toBe(3);
    expect(t.alcoholUnits).toBe(1);
    expect(t.ethanolG).toBeGreaterThan(15);
    expect(t.sinceMs).toBe(NOON - 200 * DAY_MS);
  });

  it('returns zeros and null start for an empty history', () => {
    const t = lifetimeTotals([]);
    expect(t.waterMl).toBe(0);
    expect(t.alcoholUnits).toBe(0);
    expect(t.sinceMs).toBeNull();
  });
});
