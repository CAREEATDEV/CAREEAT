// Physiological hydration engine — the differentiator of HYDRA.
// The bar represents mL of hydration relative to the user's daily need
// (weightKg × 32 mL). State is NEVER stored mutable: every call recomputes
// from the ordered event log + profile. Keeping the file pure and free of
// side-effects makes the Swift port in targets/widget/ trivially symmetric.

export type Sex = 'male' | 'female';
export type SportIntensity = 'light' | 'moderate' | 'intense';
export type Zone = 'green' | 'amber' | 'red' | 'poison';

export interface UserProfile {
  weightKg: number;
  sex: Sex;
  awakeHours: number;
  sleepStartHour: number;
  sleepEndHour: number;
  ambientTempC: number | null;    // null = 20°C reference (no penalty)
  altitudeM: number;
  dailyGoalOverrideMl: number | null; // let user pin a goal manually
}

export const DEFAULT_PROFILE: UserProfile = {
  weightKg: 70,
  sex: 'male',
  awakeHours: 16,
  sleepStartHour: 23,
  sleepEndHour: 7,
  ambientTempC: null,
  altitudeM: 0,
  dailyGoalOverrideMl: null,
};

// One shape per event kind — no discriminant string in field names to keep
// the JSON compact for the App Group snapshot the widget reads.
export type HydrationEvent =
  | { type: 'water'; at: number; volumeMl: number }
  | { type: 'electrolytes'; at: number; volumeMl: number }
  | { type: 'alcohol'; at: number; volumeMl: number; abv: number }
  | { type: 'caffeine'; at: number; volumeMl: number; caffeineMg?: number }
  | { type: 'sport'; at: number; durationMin: number; intensity: SportIntensity }
  | { type: 'profile'; at: number; patch: Partial<UserProfile> };

export interface HydrationState {
  levelMl: number;
  dailyNeedMl: number;
  levelPct: number;
  zone: Zone;
  poisoned: boolean;
  poisonUntil: number | null;
  poisonMult: number;
  ambleAt: number | null;
  redAt: number | null;
}

// ————————— Physio helpers —————————

// 32 mL/kg is the mid-band of the clinical 30–35 mL/kg guidance and matches
// EFSA-style adult recommendations once you factor in food water.
export const ML_PER_KG_DAY = 32;
export const ETHANOL_DENSITY_G_PER_ML = 0.789;
export const DIURESIS_ML_PER_G_ETHANOL = 10; // Eggleton constant (approx.)

export function dailyNeedMl(p: UserProfile): number {
  return p.dailyGoalOverrideMl ?? p.weightKg * ML_PER_KG_DAY;
}

export function baseDrainMlPerHour(p: UserProfile): number {
  return dailyNeedMl(p) / p.awakeHours;
}

function tempMultiplier(tempC: number | null): number {
  if (tempC == null) return 1.0;
  if (tempC < 18) return 0.9;
  if (tempC < 25) return 1.0;
  if (tempC <= 30) return 1.2;
  return 1.4;
}

function altitudeMultiplier(altM: number): number {
  // > 2500 m adds ~3% baseline. Kept conservative — full model TODO.
  return altM > 2500 ? 1.03 : 1.0;
}

// Baker 2017 + heat literature. Intense sport in heat >28°C is the only
// case where sex stops mattering — everyone sweats a lot.
export function sweatRateMlPerHour(
  sex: Sex,
  intensity: SportIntensity,
  tempC: number | null
): number {
  if (intensity === 'light') return 400;
  if (intensity === 'moderate') return sex === 'male' ? 800 : 500;
  // intense
  if (tempC != null && tempC > 28) return 1600;
  return 1200;
}

export function ethanolGrams(volumeMl: number, abv: number): number {
  return volumeMl * (abv / 100) * ETHANOL_DENSITY_G_PER_ML;
}

// ————————— Poison window model —————————

const POISON_WINDOW_MS = 4 * 3600_000;
const POISON_PEAK_MS = 2 * 3600_000;

// ≤10 g ethanol → peak ×1.3 (extra 0.3). ≥30 g → peak ×2 (extra 1.0).
// Linear interpolation in between — matches the spec text.
export function peakPoisonExtra(ethanolG: number): number {
  const g = Math.max(10, Math.min(30, ethanolG));
  return 0.3 + ((g - 10) / 20) * 0.7;
}

// Triangular envelope: 0 at eventAt, peakExtra at eventAt+2h, 0 at
// eventAt+4h. Any earlier or later contributes nothing.
function poisonExtraFromEvent(eventAt: number, ethanolG: number, t: number): number {
  const dt = t - eventAt;
  if (dt < 0 || dt > POISON_WINDOW_MS) return 0;
  const peakExtra = peakPoisonExtra(ethanolG);
  const rise = dt / POISON_PEAK_MS;                              // 0→1 over first 2h
  const fall = (POISON_WINDOW_MS - dt) / POISON_PEAK_MS;         // 1→0 over last 2h
  return peakExtra * Math.min(rise, fall);
}

// Cumulative multiplier across all still-active alcohol events, capped ×3.
function poisonMultiplierAt(events: HydrationEvent[], t: number): number {
  let extra = 0;
  for (const e of events) {
    if (e.type !== 'alcohol') continue;
    if (t < e.at || t > e.at + POISON_WINDOW_MS) continue;
    extra += poisonExtraFromEvent(e.at, ethanolGrams(e.volumeMl, e.abv), t);
  }
  return Math.min(3.0, 1.0 + extra);
}

function poisonEndsAt(events: HydrationEvent[], now: number): number | null {
  let end: number | null = null;
  for (const e of events) {
    if (e.type !== 'alcohol') continue;
    const windowEnd = e.at + POISON_WINDOW_MS;
    if (now <= windowEnd) end = end == null ? windowEnd : Math.max(end, windowEnd);
  }
  return end;
}

// ————————— Sleep window —————————

function isSleeping(at: number, p: UserProfile): boolean {
  const d = new Date(at);
  const h = d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  const { sleepStartHour: a, sleepEndHour: b } = p;
  if (a === b) return false;
  return a < b ? h >= a && h < b : h >= a || h < b;
}

const SLEEP_MULTIPLIER = 0.4;

// ————————— Profile effective at time t —————————

function effectiveProfile(
  events: HydrationEvent[],
  at: number,
  base: UserProfile
): UserProfile {
  let p = { ...base };
  for (const e of events) {
    if (e.at > at) break;
    if (e.type === 'profile') p = { ...p, ...e.patch };
  }
  return p;
}

// ————————— Integrator —————————

const STEP_MS = 60_000; // 1-min sampling — accurate enough over 6h horizon.

// Base drain per ms at midpoint, given profile + poison + sleep.
function drainMlPerMs(p: UserProfile, poisonMult: number, sleeping: boolean): number {
  let mult = 1.0;
  mult *= tempMultiplier(p.ambientTempC);
  mult *= altitudeMultiplier(p.altitudeM);
  mult *= poisonMult;
  if (sleeping) mult *= SLEEP_MULTIPLIER;
  return (baseDrainMlPerHour(p) * mult) / 3600_000;
}

// Sweat loss produced by any sport event whose window intersects [t0, t1].
function sportLossMlOver(
  events: HydrationEvent[],
  t0: number,
  t1: number,
  p: UserProfile
): number {
  let loss = 0;
  for (const e of events) {
    if (e.type !== 'sport') continue;
    const endAt = e.at + e.durationMin * 60_000;
    const s = Math.max(e.at, t0);
    const en = Math.min(endAt, t1);
    if (en <= s) continue;
    loss += (sweatRateMlPerHour(p.sex, e.intensity, p.ambientTempC) * (en - s)) / 3600_000;
  }
  return loss;
}

// Integrate total mL lost between `from` and `to`.
function integrateLoss(
  events: HydrationEvent[],
  from: number,
  to: number,
  baseProfile: UserProfile
): number {
  if (to <= from) return 0;
  let acc = 0;
  let t = from;
  while (t < to) {
    const next = Math.min(t + STEP_MS, to);
    const mid = (t + next) / 2;
    const p = effectiveProfile(events, mid, baseProfile);
    const poison = poisonMultiplierAt(events, mid);
    acc += drainMlPerMs(p, poison, isSleeping(mid, p)) * (next - t);
    acc += sportLossMlOver(events, t, next, p);
    t = next;
  }
  return acc;
}

// ————————— Zone classification —————————

export function zoneOf(pct: number, poisoned: boolean): Zone {
  if (poisoned) return 'poison';
  if (pct > 55) return 'green';
  if (pct >= 25) return 'amber';
  return 'red';
}

// ————————— Instantaneous drink impact (mL) —————————

// Alcohol Layer A: honest net water balance from the drink.
export function alcoholNetMl(volumeMl: number, abv: number): number {
  const waterInDrink = volumeMl * (1 - abv / 100);
  const diuresis = ethanolGrams(volumeMl, abv) * DIURESIS_ML_PER_G_ETHANOL;
  return waterInDrink - diuresis;
}

function caffeineNetMl(e: Extract<HydrationEvent, { type: 'caffeine' }>): number {
  const mg = e.caffeineMg ?? 90;
  // MVP: treat < 500 mg as net water; 500+ mg costs ~250 mL over 3h — we
  // apply the loss as a single instantaneous debit for now (TODO: distribute).
  if (mg >= 500) return e.volumeMl - 250;
  return e.volumeMl;
}

function applyEventImpact(
  event: HydrationEvent,
  levelMl: number,
  cap: number
): number {
  switch (event.type) {
    case 'water':
      return clamp(levelMl + event.volumeMl, 0, cap);
    case 'electrolytes':
      return clamp(levelMl + event.volumeMl * 1.1, 0, cap);
    case 'alcohol':
      return clamp(levelMl + alcoholNetMl(event.volumeMl, event.abv), 0, cap);
    case 'caffeine':
      return clamp(levelMl + caffeineNetMl(event), 0, cap);
    case 'sport':
    case 'profile':
      return levelMl; // sport is applied via the integrator; profile has no direct impact
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ————————— Public: compute state at `at` —————————

export function computeState(
  events: HydrationEvent[],
  at: number,
  baseProfile: UserProfile = DEFAULT_PROFILE
): HydrationState {
  const sorted = [...events].sort((a, b) => a.at - b.at);
  const profileAtNow = effectiveProfile(sorted, at, baseProfile);
  const capNow = dailyNeedMl(profileAtNow);

  if (sorted.length === 0) {
    return {
      levelMl: capNow,
      dailyNeedMl: capNow,
      levelPct: 100,
      zone: 'green',
      poisoned: false,
      poisonUntil: null,
      poisonMult: 1,
      ambleAt: null,
      redAt: null,
    };
  }

  // Anchor: level starts at capacity at the first event's timestamp.
  const startProfile = effectiveProfile(sorted, sorted[0].at, baseProfile);
  let levelMl = dailyNeedMl(startProfile);
  let cursor = sorted[0].at;

  for (const e of sorted) {
    levelMl -= integrateLoss(sorted, cursor, e.at, baseProfile);
    const p = effectiveProfile(sorted, e.at, baseProfile);
    levelMl = applyEventImpact(e, levelMl, dailyNeedMl(p));
    cursor = e.at;
  }
  levelMl -= integrateLoss(sorted, cursor, at, baseProfile);
  levelMl = clamp(levelMl, 0, capNow);

  const poisonMult = poisonMultiplierAt(sorted, at);
  const poisoned = poisonMult > 1.0;
  const poisonUntil = poisoned ? poisonEndsAt(sorted, at) : null;
  const levelPct = (levelMl / capNow) * 100;
  const zone = zoneOf(levelPct, poisoned);
  const { ambleAt, redAt } = forecastZoneCrossings(
    sorted,
    at,
    levelMl,
    baseProfile
  );

  return {
    levelMl,
    dailyNeedMl: capNow,
    levelPct,
    zone,
    poisoned,
    poisonUntil,
    poisonMult,
    ambleAt,
    redAt,
  };
}

// ————————— Forecast when we hit amber / red next —————————

export function forecastZoneCrossings(
  events: HydrationEvent[],
  fromAt: number,
  startLevelMl: number,
  baseProfile: UserProfile,
  horizonMs: number = 6 * 3600_000
): { ambleAt: number | null; redAt: number | null } {
  const profileNow = effectiveProfile(events, fromAt, baseProfile);
  const cap = dailyNeedMl(profileNow);
  const amberThresh = cap * 0.55;
  const redThresh = cap * 0.25;

  let ambleAt: number | null = startLevelMl <= amberThresh ? fromAt : null;
  let redAt: number | null = startLevelMl < redThresh ? fromAt : null;
  if (ambleAt != null && redAt != null) return { ambleAt, redAt };

  let level = startLevelMl;
  let t = fromAt;
  const end = fromAt + horizonMs;
  while (t < end) {
    const next = Math.min(t + STEP_MS, end);
    const dt = next - t;
    const mid = (t + next) / 2;
    const p = effectiveProfile(events, mid, baseProfile);
    const poison = poisonMultiplierAt(events, mid);
    level -= drainMlPerMs(p, poison, isSleeping(mid, p)) * dt;
    level -= sportLossMlOver(events, t, next, p);
    if (ambleAt == null && level <= amberThresh) ambleAt = next;
    if (redAt == null && level < redThresh) {
      redAt = next;
      break;
    }
    t = next;
  }
  return { ambleAt, redAt };
}

// Convenience wrapper.
export function stateNow(
  events: HydrationEvent[],
  profile?: UserProfile
): HydrationState {
  return computeState(events, Date.now(), profile);
}

// ————————— Preset drinks (editable in Settings) —————————

export interface DrinkPreset {
  key: string;
  label: string;
  kind: 'water' | 'electrolytes' | 'alcohol' | 'caffeine';
  volumeMl: number;
  abv?: number;
  caffeineMg?: number;
}

export const DEFAULT_PRESETS: DrinkPreset[] = [
  { key: 'water', label: 'EAU', kind: 'water', volumeMl: 250 },
  { key: 'water_bottle', label: 'BOUTEILLE', kind: 'water', volumeMl: 500 },
  { key: 'electrolytes', label: 'ÉLECTROLYTES', kind: 'electrolytes', volumeMl: 500 },
  { key: 'beer_lager', label: 'BIÈRE 5%', kind: 'alcohol', volumeMl: 500, abv: 5 },
  { key: 'beer_ipa', label: 'IPA 8%', kind: 'alcohol', volumeMl: 500, abv: 8 },
  { key: 'wine', label: 'VIN 13%', kind: 'alcohol', volumeMl: 150, abv: 13 },
  { key: 'shot', label: 'SHOT 40%', kind: 'alcohol', volumeMl: 40, abv: 40 },
  { key: 'cocktail', label: 'COCKTAIL', kind: 'alcohol', volumeMl: 200, abv: 15 },
  { key: 'coffee', label: 'CAFÉ', kind: 'caffeine', volumeMl: 100, caffeineMg: 90 },
];
