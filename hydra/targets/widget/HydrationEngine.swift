import Foundation

// Strict port of src/engine/hydrationEngine.ts (v2 physiological model).
// Any change to the TS source of truth MUST land here in the same commit.
// The tests in HydrationEngineTests.swift mirror the 8 acceptance cases.

enum Sex: String, Codable { case male, female }
enum SportIntensity: String, Codable { case light, moderate, intense }
enum Zone: String { case green, amber, red, poison }

enum EventType: String, Codable {
    case water, electrolytes, alcohol, caffeine, sport, profile
}

struct UserProfile: Codable {
    var weightKg: Double
    var sex: Sex
    var awakeHours: Double
    var sleepStartHour: Double
    var sleepEndHour: Double
    var ambientTempC: Double?
    var altitudeM: Double
    var dailyGoalOverrideMl: Double?

    static let `default` = UserProfile(
        weightKg: 70,
        sex: .male,
        awakeHours: 16,
        sleepStartHour: 23,
        sleepEndHour: 7,
        ambientTempC: nil,
        altitudeM: 0,
        dailyGoalOverrideMl: nil
    )
}

struct HydrationEvent: Codable {
    let type: EventType
    let at: TimeInterval          // ms since epoch (JS parity)
    let volumeMl: Double?
    let abv: Double?
    let caffeineMg: Double?
    let durationMin: Double?
    let intensity: SportIntensity?
    let patch: UserProfile?
}

struct HydrationState {
    var levelMl: Double
    var dailyNeedMl: Double
    var levelPct: Double
    var zone: Zone
    var poisoned: Bool
    var poisonUntil: TimeInterval?
    var poisonMult: Double
    var ambleAt: TimeInterval?
    var redAt: TimeInterval?
}

// ————————— Physio constants —————————

let ML_PER_KG_DAY: Double = 32
let ETHANOL_DENSITY_G_PER_ML: Double = 0.789
let DIURESIS_ML_PER_G_ETHANOL: Double = 10
let POISON_WINDOW_MS: Double = 4 * 3_600_000
let POISON_PEAK_MS: Double = 2 * 3_600_000
let SLEEP_MULTIPLIER: Double = 0.4
let STEP_MS: Double = 60_000

func dailyNeedMl(_ p: UserProfile) -> Double {
    if let g = p.dailyGoalOverrideMl { return g }
    return p.weightKg * ML_PER_KG_DAY
}

func baseDrainMlPerHour(_ p: UserProfile) -> Double {
    return dailyNeedMl(p) / p.awakeHours
}

private func tempMultiplier(_ tempC: Double?) -> Double {
    guard let t = tempC else { return 1.0 }
    if t < 18 { return 0.9 }
    if t < 25 { return 1.0 }
    if t <= 30 { return 1.2 }
    return 1.4
}

private func altitudeMultiplier(_ altM: Double) -> Double {
    return altM > 2500 ? 1.03 : 1.0
}

func sweatRateMlPerHour(sex: Sex, intensity: SportIntensity, tempC: Double?) -> Double {
    switch intensity {
    case .light: return 400
    case .moderate: return sex == .male ? 800 : 500
    case .intense:
        if let t = tempC, t > 28 { return 1600 }
        return 1200
    }
}

func ethanolGrams(volumeMl: Double, abv: Double) -> Double {
    return volumeMl * (abv / 100) * ETHANOL_DENSITY_G_PER_ML
}

func peakPoisonExtra(_ ethanolG: Double) -> Double {
    let g = min(30, max(10, ethanolG))
    return 0.3 + ((g - 10) / 20) * 0.7
}

private func poisonExtraFromEvent(_ eventAt: TimeInterval, _ ethanolG: Double, _ t: TimeInterval) -> Double {
    let dt = t - eventAt
    if dt < 0 || dt > POISON_WINDOW_MS { return 0 }
    let peakExtra = peakPoisonExtra(ethanolG)
    let rise = dt / POISON_PEAK_MS
    let fall = (POISON_WINDOW_MS - dt) / POISON_PEAK_MS
    return peakExtra * min(rise, fall)
}

private func poisonMultiplierAt(_ events: [HydrationEvent], _ t: TimeInterval) -> Double {
    var extra: Double = 0
    for e in events where e.type == .alcohol {
        guard let vol = e.volumeMl, let abv = e.abv else { continue }
        if t < e.at || t > e.at + POISON_WINDOW_MS { continue }
        let g = ethanolGrams(volumeMl: vol, abv: abv)
        extra += poisonExtraFromEvent(e.at, g, t)
    }
    return min(3.0, 1.0 + extra)
}

private func poisonEndsAt(_ events: [HydrationEvent], _ now: TimeInterval) -> TimeInterval? {
    var end: TimeInterval? = nil
    for e in events where e.type == .alcohol {
        let we = e.at + POISON_WINDOW_MS
        if now <= we { end = end == nil ? we : max(end!, we) }
    }
    return end
}

private func isSleeping(at ms: TimeInterval, _ p: UserProfile) -> Bool {
    let d = Date(timeIntervalSince1970: ms / 1000)
    let c = Calendar.current.dateComponents([.hour, .minute, .second], from: d)
    let h = Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60 + Double(c.second ?? 0) / 3600
    let a = p.sleepStartHour, b = p.sleepEndHour
    if a == b { return false }
    return a < b ? (h >= a && h < b) : (h >= a || h < b)
}

private func effectiveProfile(_ events: [HydrationEvent], _ at: TimeInterval, _ base: UserProfile) -> UserProfile {
    var p = base
    for e in events {
        if e.at > at { break }
        if e.type == .profile, let patch = e.patch {
            p.weightKg = patch.weightKg
            p.sex = patch.sex
            p.awakeHours = patch.awakeHours
            p.sleepStartHour = patch.sleepStartHour
            p.sleepEndHour = patch.sleepEndHour
            p.ambientTempC = patch.ambientTempC
            p.altitudeM = patch.altitudeM
            p.dailyGoalOverrideMl = patch.dailyGoalOverrideMl
        }
    }
    return p
}

private func drainMlPerMs(_ p: UserProfile, poisonMult: Double, sleeping: Bool) -> Double {
    var mult = 1.0
    mult *= tempMultiplier(p.ambientTempC)
    mult *= altitudeMultiplier(p.altitudeM)
    mult *= poisonMult
    if sleeping { mult *= SLEEP_MULTIPLIER }
    return (baseDrainMlPerHour(p) * mult) / 3_600_000
}

private func sportLossMlOver(_ events: [HydrationEvent], _ t0: TimeInterval, _ t1: TimeInterval, _ p: UserProfile) -> Double {
    var loss: Double = 0
    for e in events where e.type == .sport {
        guard let dur = e.durationMin, let intensity = e.intensity else { continue }
        let endAt = e.at + dur * 60_000
        let s = max(e.at, t0)
        let en = min(endAt, t1)
        if en <= s { continue }
        let rate = sweatRateMlPerHour(sex: p.sex, intensity: intensity, tempC: p.ambientTempC)
        loss += rate * (en - s) / 3_600_000
    }
    return loss
}

private func integrateLoss(_ events: [HydrationEvent], _ from: TimeInterval, _ to: TimeInterval, _ base: UserProfile) -> Double {
    if to <= from { return 0 }
    var acc: Double = 0
    var t = from
    while t < to {
        let next = min(t + STEP_MS, to)
        let mid = (t + next) / 2
        let p = effectiveProfile(events, mid, base)
        let poison = poisonMultiplierAt(events, mid)
        acc += drainMlPerMs(p, poisonMult: poison, sleeping: isSleeping(at: mid, p)) * (next - t)
        acc += sportLossMlOver(events, t, next, p)
        t = next
    }
    return acc
}

func zoneOf(pct: Double, poisoned: Bool) -> Zone {
    if poisoned { return .poison }
    if pct > 55 { return .green }
    if pct >= 25 { return .amber }
    return .red
}

func alcoholNetMl(volumeMl: Double, abv: Double) -> Double {
    let water = volumeMl * (1 - abv / 100)
    let diur = ethanolGrams(volumeMl: volumeMl, abv: abv) * DIURESIS_ML_PER_G_ETHANOL
    return water - diur
}

private func caffeineNetMl(_ e: HydrationEvent) -> Double {
    let vol = e.volumeMl ?? 0
    let mg = e.caffeineMg ?? 90
    if mg >= 500 { return vol - 250 }
    return vol
}

private func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
    return min(hi, max(lo, v))
}

private func applyEventImpact(_ e: HydrationEvent, _ levelMl: Double, _ cap: Double) -> Double {
    switch e.type {
    case .water:
        return clamp(levelMl + (e.volumeMl ?? 0), 0, cap)
    case .electrolytes:
        return clamp(levelMl + (e.volumeMl ?? 0) * 1.1, 0, cap)
    case .alcohol:
        return clamp(levelMl + alcoholNetMl(volumeMl: e.volumeMl ?? 0, abv: e.abv ?? 0), 0, cap)
    case .caffeine:
        return clamp(levelMl + caffeineNetMl(e), 0, cap)
    case .sport, .profile:
        return levelMl
    }
}

func computeState(
    events rawEvents: [HydrationEvent],
    at: TimeInterval,
    profile baseProfile: UserProfile = .default
) -> HydrationState {
    let sorted = rawEvents.sorted { $0.at < $1.at }
    let profileNow = effectiveProfile(sorted, at, baseProfile)
    let capNow = dailyNeedMl(profileNow)

    if sorted.isEmpty {
        return HydrationState(
            levelMl: capNow, dailyNeedMl: capNow, levelPct: 100,
            zone: .green, poisoned: false, poisonUntil: nil,
            poisonMult: 1, ambleAt: nil, redAt: nil
        )
    }

    let startProfile = effectiveProfile(sorted, sorted.first!.at, baseProfile)
    var levelMl = dailyNeedMl(startProfile)
    var cursor = sorted.first!.at

    for e in sorted {
        levelMl -= integrateLoss(sorted, cursor, e.at, baseProfile)
        let p = effectiveProfile(sorted, e.at, baseProfile)
        levelMl = applyEventImpact(e, levelMl, dailyNeedMl(p))
        cursor = e.at
    }
    levelMl -= integrateLoss(sorted, cursor, at, baseProfile)
    levelMl = clamp(levelMl, 0, capNow)

    let poisonMult = poisonMultiplierAt(sorted, at)
    let poisoned = poisonMult > 1.0
    let poisonUntil = poisoned ? poisonEndsAt(sorted, at) : nil
    let levelPct = (levelMl / capNow) * 100
    let zone = zoneOf(pct: levelPct, poisoned: poisoned)
    let (ambleAt, redAt) = forecast(events: sorted, at: at, startLevelMl: levelMl, baseProfile: baseProfile)

    return HydrationState(
        levelMl: levelMl, dailyNeedMl: capNow, levelPct: levelPct,
        zone: zone, poisoned: poisoned, poisonUntil: poisonUntil,
        poisonMult: poisonMult, ambleAt: ambleAt, redAt: redAt
    )
}

func forecast(
    events: [HydrationEvent],
    at: TimeInterval,
    startLevelMl: Double,
    baseProfile: UserProfile,
    horizonMs: TimeInterval = 6 * 3_600_000
) -> (TimeInterval?, TimeInterval?) {
    let profileNow = effectiveProfile(events, at, baseProfile)
    let cap = dailyNeedMl(profileNow)
    let amberT = cap * 0.55
    let redT = cap * 0.25
    var ambleAt: TimeInterval? = startLevelMl <= amberT ? at : nil
    var redAt: TimeInterval? = startLevelMl < redT ? at : nil
    if ambleAt != nil && redAt != nil { return (ambleAt, redAt) }
    var level = startLevelMl
    var t = at
    let end = at + horizonMs
    while t < end {
        let next = min(t + STEP_MS, end)
        let dt = next - t
        let mid = (t + next) / 2
        let p = effectiveProfile(events, mid, baseProfile)
        let poison = poisonMultiplierAt(events, mid)
        level -= drainMlPerMs(p, poisonMult: poison, sleeping: isSleeping(at: mid, p)) * dt
        level -= sportLossMlOver(events, t, next, p)
        if ambleAt == nil && level <= amberT { ambleAt = next }
        if redAt == nil && level < redT { redAt = next; break }
        t = next
    }
    return (ambleAt, redAt)
}

// Loader for the widget: reads the snapshot RN wrote into the App Group.
struct SharedSnapshot: Decodable {
    let version: Int
    let updatedAt: TimeInterval
    let events: [HydrationEvent]
    let profile: UserProfile
}

func loadSharedSnapshot(appGroup: String = "group.com.chipli.hydra") -> SharedSnapshot? {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let raw = defaults.string(forKey: "hydraSnapshot"),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(SharedSnapshot.self, from: data)
}
