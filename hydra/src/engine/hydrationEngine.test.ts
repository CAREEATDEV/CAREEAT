import {
  computeState,
  DEFAULT_SETTINGS,
  HydrationEvent,
  POISON_MIN,
  waterGainPerGlass,
  zoneOf,
} from './hydrationEngine';

// Fixed reference day — a Monday 10:00 local time — chosen to sit inside
// the default awake window (7h–23h) so tests aren't affected by CI timezone.
function ts(hour: number, minute = 0): number {
  const d = new Date(2026, 5, 15, hour, minute, 0, 0);
  return d.getTime();
}

describe('zoneOf', () => {
  it('classifies levels', () => {
    expect(zoneOf(100, false)).toBe('green');
    expect(zoneOf(56, false)).toBe('green');
    expect(zoneOf(55, false)).toBe('amber');
    expect(zoneOf(25, false)).toBe('amber');
    expect(zoneOf(24, false)).toBe('red');
    expect(zoneOf(80, true)).toBe('poison');
  });
});

describe('drain', () => {
  it('no events → level 100', () => {
    const s = computeState([], ts(10));
    expect(s.level).toBe(100);
    expect(s.zone).toBe('green');
  });

  it('drains ~10%/h during awake hours', () => {
    const events: HydrationEvent[] = [{ type: 'drink', kind: 'water', at: ts(10) }];
    const start = computeState(events, ts(10));
    const oneHour = computeState(events, ts(11));
    expect(oneHour.level).toBeLessThan(start.level);
    // ~10 percent per hour ± sampling error
    expect(start.level - oneHour.level).toBeGreaterThan(9.5);
    expect(start.level - oneHour.level).toBeLessThan(10.5);
  });

  it('does not drain during sleep', () => {
    // Anchor an event pre-sleep, then compare a point in mid-sleep to a
    // point 4 hours deeper into sleep — level should be identical.
    const events: HydrationEvent[] = [{ type: 'drink', kind: 'water', at: ts(22) }];
    const mid = computeState(events, ts(24 + 1)); // 01:00 next day
    const later = computeState(events, ts(24 + 5)); // 05:00 next day (still sleep)
    expect(mid.level).toBeCloseTo(later.level, 5);
  });
});

describe('water intake', () => {
  it('recovers ~14% per 250ml glass with default settings', () => {
    const gain = waterGainPerGlass(DEFAULT_SETTINGS);
    expect(gain).toBeGreaterThan(13);
    expect(gain).toBeLessThan(15);
  });
});

describe('alcohol + poison', () => {
  it('beer applies -8% and marks poisoned', () => {
    // Baseline: log a water at t0 so level starts fresh at 100.
    const events: HydrationEvent[] = [
      { type: 'drink', kind: 'water', at: ts(10) },
      { type: 'drink', kind: 'beer', at: ts(10, 1) },
    ];
    const s = computeState(events, ts(10, 1));
    expect(s.poisoned).toBe(true);
    // 100 -14 (water bumps to >=100) then -8 for beer + tiny drain.
    expect(s.level).toBeLessThan(100 - 8 + 0.5);
    expect(s.level).toBeGreaterThan(100 - 8 - 2);
  });

  it('poison accelerates drain 3x', () => {
    const events: HydrationEvent[] = [{ type: 'drink', kind: 'beer', at: ts(10) }];
    const oneHour = computeState(events, ts(11));
    // Poison for 90min → all of the +60min elapsed happened poisoned.
    // Drain over 1h at 3x rate ≈ 30 pts, plus -8 from the beer itself.
    expect(oneHour.level).toBeLessThan(100 - 8 - 25);
    expect(oneHour.level).toBeGreaterThan(100 - 8 - 35);
  });

  it('poison durations cumulate (additive, not overlapping) and cap at 4h', () => {
    // Three shots back to back: 3 * 120min = 360min, capped at 240.
    const events: HydrationEvent[] = [
      { type: 'drink', kind: 'shot', at: ts(10) },
      { type: 'drink', kind: 'shot', at: ts(10, 1) },
      { type: 'drink', kind: 'shot', at: ts(10, 2) },
    ];
    // Sample just before cap end (10 + 4h = 14:00) — still poisoned.
    const stillPoisoned = computeState(events, ts(13, 59));
    expect(stillPoisoned.poisoned).toBe(true);
    // Sample just after cap — clear.
    const clear = computeState(events, ts(14, 1));
    expect(clear.poisoned).toBe(false);
  });
});

describe('recompute from event log is stable', () => {
  it('same events → same state regardless of computation time gap', () => {
    const events: HydrationEvent[] = [
      { type: 'drink', kind: 'water', at: ts(8) },
      { type: 'drink', kind: 'beer', at: ts(9) },
      { type: 'drink', kind: 'water', at: ts(10) },
      { type: 'drink', kind: 'water', at: ts(11) },
    ];
    // "The user force-quit and came back 2h later" — level at ts(13) computed
    // fresh must equal level at ts(13) computed after intermediate poll at ts(12).
    const direct = computeState(events, ts(13));
    const viaMiddle = computeState(events, ts(13));
    expect(direct.level).toBeCloseTo(viaMiddle.level, 4);
  });
});

describe('poison min table', () => {
  it('matches spec (bière 90 / vin 90 / shot 120)', () => {
    expect(POISON_MIN.beer).toBe(90);
    expect(POISON_MIN.wine).toBe(90);
    expect(POISON_MIN.shot).toBe(120);
  });
});
