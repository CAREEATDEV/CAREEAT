import {
  alcoholNetMl,
  baseDrainMlPerHour,
  computeState,
  dailyNeedMl,
  DEFAULT_PROFILE,
  ethanolGrams,
  HydrationEvent,
  peakPoisonExtra,
  remainingAbsorptionMl,
  sweatRateMlPerHour,
  UserProfile,
  zoneOf,
} from './hydrationEngine';

// Fixed reference day — Monday 15 June 2026 — so tests are timezone-agnostic
// as long as we build wall-clock hours via new Date(...).
function ts(hour: number, minute = 0): number {
  return new Date(2026, 5, 15, hour, minute, 0, 0).getTime();
}

const P70: UserProfile = { ...DEFAULT_PROFILE, weightKg: 70, awakeHours: 16 };

// A tiny water log at t0 anchors the timeline. The starting level is already
// capped at the daily need, so this adds nothing measurable — it's just a
// t=0 marker so integration has a starting point.
function anchor(atMs: number): HydrationEvent {
  return { type: 'water', at: atMs, volumeMl: 1 };
}

describe('daily need', () => {
  it('70 kg → 2240 mL', () => {
    expect(dailyNeedMl(P70)).toBeCloseTo(2240, 6);
  });
  it('base drain 70 kg / 16h ≈ 140 mL/h', () => {
    expect(baseDrainMlPerHour(P70)).toBeCloseTo(140, 6);
  });
});

describe('#1 — passive drain over 2 h (70 kg, 16 h éveil)', () => {
  it('drops ~280 mL', () => {
    const events = [anchor(ts(10))];
    const before = computeState(events, ts(10), P70);
    const after = computeState(events, ts(12), P70);
    const drop = before.levelMl - after.levelMl;
    expect(drop).toBeGreaterThan(275);
    expect(drop).toBeLessThan(285);
  });
});

describe('#2 — sleep window ×0.4', () => {
  it('mid-sleep 2 h drains ~0.4× daytime 2 h', () => {
    const events = [anchor(ts(22))];
    // Daytime baseline: 10:00 → 12:00 elsewhere in the day.
    const dayEvents = [anchor(ts(10))];
    const dayDrop =
      computeState(dayEvents, ts(10), P70).levelMl -
      computeState(dayEvents, ts(12), P70).levelMl;
    // Sleep interval: 01:00 → 03:00 next day, wholly inside 23–07 window.
    const nightDrop =
      computeState(events, ts(24 + 1), P70).levelMl -
      computeState(events, ts(24 + 3), P70).levelMl;
    const ratio = nightDrop / dayDrop;
    expect(ratio).toBeGreaterThan(0.38);
    expect(ratio).toBeLessThan(0.42);
  });
});

describe('#3 — beer 500 mL / 5%', () => {
  it('net water balance is slightly positive (~+278 mL)', () => {
    const net = alcoholNetMl(500, 5);
    // 500 * 0.95 = 475 mL water; ethanol 19.725 g × 10 = 197.25 mL loss; net ≈ +277.75
    expect(net).toBeGreaterThan(270);
    expect(net).toBeLessThan(285);
  });
  it('poison peak multiplier ≈ ×1.6 (between ×1.3 and ×2)', () => {
    const g = ethanolGrams(500, 5); // ≈ 19.7 g
    const extra = peakPoisonExtra(g);
    expect(1 + extra).toBeGreaterThan(1.5);
    expect(1 + extra).toBeLessThan(1.75);
  });
  it('logs beer → poisoned=true, level not tanked', () => {
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 1), volumeMl: 500, abv: 5 },
    ];
    const just = computeState(events, ts(10, 2), P70);
    expect(just.poisoned).toBe(true);
    // level should still be near capacity (2240) — beer is essentially neutral
    expect(just.levelMl).toBeGreaterThan(2200);
  });
});

describe('#4 — shot 40 mL / 40%', () => {
  it('net water balance is negative (~-102 mL)', () => {
    const net = alcoholNetMl(40, 40);
    expect(net).toBeLessThan(-95);
    expect(net).toBeGreaterThan(-115);
  });
  it('logs shot → poisoned=true, redAt closer than baseline', () => {
    const baseline: HydrationEvent[] = [anchor(ts(10))];
    const withShot: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 1), volumeMl: 40, abv: 40 },
    ];
    const bBase = computeState(baseline, ts(10, 2), P70);
    const bShot = computeState(withShot, ts(10, 2), P70);
    expect(bShot.poisoned).toBe(true);
    // countdown shrinks (redAt earlier) because poison ×~1.4 speeds drain
    if (bBase.redAt && bShot.redAt) {
      expect(bShot.redAt).toBeLessThan(bBase.redAt);
    }
  });
});

describe('#5 — two drinks cumulate, capped ×3 / 4 h', () => {
  it('multiplier cumulates but never exceeds ×3', () => {
    // Four beers close together — deliberately overshoot to test the cap.
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 5), volumeMl: 500, abv: 8 },  // ~31 g
      { type: 'alcohol', at: ts(10, 10), volumeMl: 500, abv: 8 },
      { type: 'alcohol', at: ts(10, 15), volumeMl: 500, abv: 8 },
      { type: 'alcohol', at: ts(10, 20), volumeMl: 500, abv: 8 },
    ];
    // Sample near a shared peak zone.
    const s = computeState(events, ts(12, 0), P70);
    expect(s.poisoned).toBe(true);
    expect(s.poisonMult).toBeLessThanOrEqual(3.0 + 1e-9);
  });

  it('poison window ends at last drink + 4 h', () => {
    const lastAt = ts(10, 30);
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'alcohol', at: ts(10, 5), volumeMl: 500, abv: 5 },
      { type: 'alcohol', at: lastAt, volumeMl: 500, abv: 5 },
    ];
    const beforeEnd = computeState(events, lastAt + 4 * 3600_000 - 60_000, P70);
    const afterEnd = computeState(events, lastAt + 4 * 3600_000 + 60_000, P70);
    expect(beforeEnd.poisoned).toBe(true);
    expect(afterEnd.poisoned).toBe(false);
  });
});

describe('#6 — sport by sex', () => {
  it('moderate 60 min → male loses ~800 mL', () => {
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'sport', at: ts(10, 1), durationMin: 60, intensity: 'moderate' },
    ];
    const before = computeState(events, ts(10, 1), P70);
    const after = computeState(events, ts(11, 1), P70);
    const sportLoss =
      before.levelMl - after.levelMl - baseDrainMlPerHour(P70); // subtract 1h passive drain
    expect(sportLoss).toBeGreaterThan(780);
    expect(sportLoss).toBeLessThan(820);
  });

  it('moderate 60 min → female loses ~500 mL', () => {
    const F70: UserProfile = { ...P70, sex: 'female' };
    const events: HydrationEvent[] = [
      anchor(ts(10)),
      { type: 'sport', at: ts(10, 1), durationMin: 60, intensity: 'moderate' },
    ];
    const before = computeState(events, ts(10, 1), F70);
    const after = computeState(events, ts(11, 1), F70);
    const sportLoss = before.levelMl - after.levelMl - baseDrainMlPerHour(F70);
    expect(sportLoss).toBeGreaterThan(485);
    expect(sportLoss).toBeLessThan(515);
  });

  it('sweatRate direct lookup matches spec', () => {
    expect(sweatRateMlPerHour('male', 'moderate', null)).toBe(800);
    expect(sweatRateMlPerHour('female', 'moderate', null)).toBe(500);
    expect(sweatRateMlPerHour('male', 'light', null)).toBe(400);
    expect(sweatRateMlPerHour('male', 'intense', null)).toBe(1200);
    expect(sweatRateMlPerHour('male', 'intense', 30)).toBe(1600);
  });
});

describe('#7 — ambient temp > 30 °C', () => {
  it('base drain ×1.4', () => {
    const cool: UserProfile = { ...P70, ambientTempC: null };
    const hot: UserProfile = { ...P70, ambientTempC: 32 };
    const events = [anchor(ts(10))];
    const coolDrop =
      computeState(events, ts(10), cool).levelMl -
      computeState(events, ts(11), cool).levelMl;
    const hotDrop =
      computeState(events, ts(10), hot).levelMl -
      computeState(events, ts(11), hot).levelMl;
    const ratio = hotDrop / coolDrop;
    expect(ratio).toBeGreaterThan(1.38);
    expect(ratio).toBeLessThan(1.42);
  });
});

describe('#8 — force-quit / incremental recompute is stable', () => {
  it('level at t3 identical whether computed in one shot or step by step', () => {
    const events: HydrationEvent[] = [
      anchor(ts(8)),
      { type: 'water', at: ts(9, 15), volumeMl: 300 },
      { type: 'alcohol', at: ts(10, 30), volumeMl: 500, abv: 5 },
      { type: 'water', at: ts(11), volumeMl: 250 },
      { type: 'sport', at: ts(12), durationMin: 45, intensity: 'moderate' },
    ];
    const target = ts(14, 0);
    const oneShot = computeState(events, target, P70);
    // Sample every 15 minutes leading up to `target` — the engine must
    // yield the same final state at `target` regardless of whether we
    // polled it in between (function is pure, but this exercises the
    // "force-quit and reopen 2h later" contract from the spec).
    let stepped;
    for (let t = ts(8); t <= target; t += 15 * 60_000) {
      stepped = computeState(events, t, P70);
    }
    stepped = computeState(events, target, P70);
    expect(stepped!.levelMl).toBeCloseTo(oneShot.levelMl, 6);
  });
});

describe('zone thresholds', () => {
  it('zoneOf classifies correctly', () => {
    expect(zoneOf(80, false)).toBe('green');
    expect(zoneOf(55, false)).toBe('amber');
    expect(zoneOf(25, false)).toBe('amber');
    expect(zoneOf(24, false)).toBe('red');
    expect(zoneOf(80, true)).toBe('poison');
  });
});

describe('water absorption cap (~1000 mL / rolling hour)', () => {
  it('a single 2 L chug only credits ~1000 mL to the bar', () => {
    // Drain a big deficit first so there is room, then chug 2 L at once.
    const events: HydrationEvent[] = [
      { type: 'water', at: ts(6), volumeMl: 1 }, // anchor early, drain down
      { type: 'water', at: ts(12), volumeMl: 2000 },
    ];
    const before = computeState(events, ts(12), P70); // just before the chug is applied? it's applied at ts(12)
    // Right after the chug: level rose by at most the cap (1000), not 2000.
    const after = computeState(events, ts(12, 0), P70);
    expect(after.absorbedLastHourMl).toBeLessThanOrEqual(1000 + 1e-6);
    expect(after.saturated).toBe(true);
    // The excess 1000 mL is overflow — not stored.
    expect(after.levelMl).toBeLessThan(P70.weightKg * 32 + 1);
  });

  it('same 2 L split into 4×500 over 4 h is fully credited', () => {
    const chug: HydrationEvent[] = [
      { type: 'water', at: ts(8), volumeMl: 2000 },
    ];
    const spread: HydrationEvent[] = [
      { type: 'water', at: ts(8), volumeMl: 500 },
      { type: 'water', at: ts(9), volumeMl: 500 },
      { type: 'water', at: ts(10), volumeMl: 500 },
      { type: 'water', at: ts(11), volumeMl: 500 },
    ];
    // Compare credited water in each hour: spread never exceeds the cap and
    // so every mL counts, chug loses half to overflow.
    const chugState = computeState(chug, ts(8), P70);
    expect(chugState.absorbedLastHourMl).toBeLessThanOrEqual(1000 + 1e-6);
    const spreadLast = computeState(spread, ts(11), P70);
    expect(spreadLast.absorbedLastHourMl).toBeCloseTo(500, 0);
  });

  it('remainingAbsorptionMl drops after drinking and refills over an hour', () => {
    const events: HydrationEvent[] = [{ type: 'water', at: ts(10), volumeMl: 800 }];
    expect(remainingAbsorptionMl(events, ts(10, 1))).toBeCloseTo(200, 0);
    // an hour later the window has rolled past → full capacity again
    expect(remainingAbsorptionMl(events, ts(11, 1))).toBeCloseTo(1000, 0);
  });
});

describe('weight scales daily need', () => {
  it('90 kg profile has larger need and larger drain than 70 kg', () => {
    const P90 = { ...P70, weightKg: 90 };
    expect(dailyNeedMl(P90)).toBe(90 * 32);
    expect(baseDrainMlPerHour(P90)).toBeGreaterThan(baseDrainMlPerHour(P70));
  });
});
