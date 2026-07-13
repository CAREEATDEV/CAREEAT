import { formatCountdown, formatCountdownPrecise } from './time';

const S = 1000;
const M = 60 * S;
const H = 3600 * S;

describe('formatCountdownPrecise', () => {
  const now = 1_000_000_000_000;

  it('shows hours, minutes and zero-padded seconds', () => {
    expect(formatCountdownPrecise(now + 2 * H + 5 * M + 9 * S, now)).toBe(
      '2h 05m 09s'
    );
  });

  it('drops the hours block below one hour', () => {
    expect(formatCountdownPrecise(now + 13 * M + 1 * S, now)).toBe('13m 01s');
  });

  it('shows only seconds under a minute', () => {
    expect(formatCountdownPrecise(now + 7 * S, now)).toBe('7s');
  });

  it('returns a dash when the target is null or already passed', () => {
    expect(formatCountdownPrecise(null, now)).toBe('—');
    expect(formatCountdownPrecise(now - 1, now)).toBe('—');
  });
});

describe('formatCountdown (coarse, used by the widget)', () => {
  const now = 1_000_000_000_000;
  it('keeps minute granularity', () => {
    expect(formatCountdown(now + 5 * H + 20 * M, now)).toBe('5h20');
    expect(formatCountdown(now + 42 * M, now)).toBe('42min');
  });
});
