import {
  activeSportSessions,
  formatSportRemaining,
  hasActiveSportSession,
  sportDrainSummary,
} from './sport';
import { DEFAULT_PROFILE, HydrationEvent } from '../engine/hydrationEngine';

const P70 = { ...DEFAULT_PROFILE, weightKg: 70, awakeHours: 16 };

describe('sport util', () => {
  const now = 1_700_000_000_000;

  it('detects active sport window', () => {
    const events: HydrationEvent[] = [
      { type: 'sport', at: now - 10 * 60_000, durationMin: 30, intensity: 'moderate' },
    ];
    const sessions = activeSportSessions(events, now, P70);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].remainingSec).toBe(20 * 60);
    // 70 kg male, 8 METs, temperate → ≈ 800 mL/h
    expect(sessions[0].sweatMlPerHour).toBeCloseTo(800.8, 1);
  });

  it('ignores finished sessions', () => {
    const events: HydrationEvent[] = [
      { type: 'sport', at: now - 60 * 60_000, durationMin: 30, intensity: 'moderate' },
    ];
    expect(activeSportSessions(events, now, P70)).toHaveLength(0);
  });

  it('hasActiveSportSession reflects active window', () => {
    const events: HydrationEvent[] = [
      { type: 'sport', at: now - 5 * 60_000, durationMin: 30, intensity: 'moderate' },
    ];
    expect(hasActiveSportSession(events, now, P70)).toBe(true);
    expect(hasActiveSportSession(events, now + 30 * 60_000, P70)).toBe(false);
  });

  it('sums sweat drain when multiple sessions overlap in history', () => {
    const events: HydrationEvent[] = [
      { type: 'sport', at: now - 5 * 60_000, durationMin: 30, intensity: 'moderate' },
      { type: 'sport', at: now - 2 * 60_000, durationMin: 20, intensity: 'intense' },
    ];
    const sessions = activeSportSessions(events, now, P70);
    const drain = sportDrainSummary(sessions, P70);
    expect(sessions).toHaveLength(2);
    // moderate (800.8) + intense (1151.15) at 70 kg male, temperate
    expect(drain.sweatMlPerH).toBeCloseTo(800.8 + 1151.15, 1);
    expect(drain.totalMlPerH).toBeGreaterThan(drain.passiveMlPerH);
  });

  it('formats remaining time', () => {
    expect(formatSportRemaining(125)).toBe('2m 05s');
    expect(formatSportRemaining(8)).toBe('8s');
  });
});
