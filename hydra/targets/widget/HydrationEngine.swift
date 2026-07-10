import Foundation

// Strictly symmetric port of src/engine/hydrationEngine.ts. Any change to the
// TS source of truth must be mirrored here — the acceptance criteria require
// the same test cases to pass on both sides.

enum DrinkKind: String, Codable {
    case water, beer, wine, shot
}

enum EventType: String, Codable {
    case drink, settings
}

struct HydrationEvent: Codable {
    let type: EventType
    let kind: DrinkKind?
    let at: TimeInterval  // ms since epoch, to match JS
    let volumeMl: Double?
    let settings: EngineSettings?
}

struct EngineSettings: Codable {
    var dailyGoalMl: Double
    var sleepStartHour: Double
    var sleepEndHour: Double
    var awakeHoursToEmpty: Double
    var waterMl: Double
    var beerMl: Double
    var wineMl: Double
    var shotMl: Double

    static let `default` = EngineSettings(
        dailyGoalMl: 2000,
        sleepStartHour: 23,
        sleepEndHour: 7,
        awakeHoursToEmpty: 10,
        waterMl: 250,
        beerMl: 330,
        wineMl: 150,
        shotMl: 40
    )
}

enum Zone: String {
    case green, amber, red, poison
}

struct HydrationState {
    var level: Double
    var zone: Zone
    var poisoned: Bool
    var poisonUntil: TimeInterval?
    var ambleAt: TimeInterval?
    var redAt: TimeInterval?
}

let POISON_MIN: [DrinkKind: Double] = [
    .beer: 90, .wine: 90, .shot: 120
]
let DRINK_IMPACT: [DrinkKind: Double] = [
    .beer: -8, .wine: -6, .shot: -15
]
let POISON_CAP_MIN: Double = 240
let POISON_MULTIPLIER: Double = 3

private struct Interval { var start: TimeInterval; var end: TimeInterval }

private func clamp(_ v: Double, _ lo: Double, _ hi: Double) -> Double {
    return min(max(v, lo), hi)
}

func waterGainPerGlass(_ s: EngineSettings) -> Double {
    let ref = (250.0 / 2000.0) * 100.0 * (14.0 / 12.5)
    let perMl = ref / 250.0
    return perMl * s.waterMl
}

private func isSleeping(at ms: TimeInterval, _ s: EngineSettings) -> Bool {
    let d = Date(timeIntervalSince1970: ms / 1000.0)
    let cal = Calendar.current
    let comps = cal.dateComponents([.hour, .minute, .second], from: d)
    let h = Double(comps.hour ?? 0) + Double(comps.minute ?? 0)/60.0 + Double(comps.second ?? 0)/3600.0
    let a = s.sleepStartHour, b = s.sleepEndHour
    if a == b { return false }
    return a < b ? (h >= a && h < b) : (h >= a || h < b)
}

private func baseDrainRate(_ s: EngineSettings) -> Double {
    let msAwakeToEmpty = s.awakeHoursToEmpty * 3_600_000.0
    return 100.0 / msAwakeToEmpty
}

private func mergeIntervals(_ xs: [Interval]) -> [Interval] {
    var out: [Interval] = []
    for x in xs {
        if var last = out.last, x.start <= last.end {
            last.end = max(last.end, x.end)
            out[out.count - 1] = last
        } else {
            out.append(x)
        }
    }
    return out
}

private func integrateDrain(
    from: TimeInterval, to: TimeInterval,
    _ s: EngineSettings, _ poison: [Interval]
) -> Double {
    if to <= from { return 0 }
    let STEP: Double = 60_000
    let rate = baseDrainRate(s)
    var acc = 0.0
    var t = from
    while t < to {
        let next = min(t + STEP, to)
        let mid = (t + next) / 2
        if !isSleeping(at: mid, s) {
            let poisoned = poison.contains { mid >= $0.start && mid < $0.end }
            let mult = poisoned ? POISON_MULTIPLIER : 1.0
            acc += rate * mult * (next - t)
        }
        t = next
    }
    return acc
}

private func effectiveSettings(
    _ events: [HydrationEvent], _ at: TimeInterval, _ base: EngineSettings
) -> EngineSettings {
    var s = base
    for e in events {
        if e.at > at { break }
        if e.type == .settings, let patch = e.settings {
            s.dailyGoalMl = patch.dailyGoalMl
            s.sleepStartHour = patch.sleepStartHour
            s.sleepEndHour = patch.sleepEndHour
            s.awakeHoursToEmpty = patch.awakeHoursToEmpty
            s.waterMl = patch.waterMl
            s.beerMl = patch.beerMl
            s.wineMl = patch.wineMl
            s.shotMl = patch.shotMl
        }
    }
    return s
}

private func extractPoisonWindows(_ events: [HydrationEvent]) -> [Interval] {
    var raw: [Interval] = []
    var carryEnd: TimeInterval = 0
    for e in events {
        guard e.type == .drink, let k = e.kind, k != .water else { continue }
        guard let durMin = POISON_MIN[k] else { continue }
        let start = carryEnd > e.at ? carryEnd : e.at
        var end = start + durMin * 60_000
        if let active = raw.first(where: { $0.end > e.at }) {
            let capEnd = active.start + POISON_CAP_MIN * 60_000
            if end > capEnd { end = capEnd }
        } else {
            let capEnd = e.at + POISON_CAP_MIN * 60_000
            if end > capEnd { end = capEnd }
        }
        raw.append(Interval(start: start, end: end))
        carryEnd = end
    }
    return mergeIntervals(raw)
}

func zoneOf(_ level: Double, poisoned: Bool) -> Zone {
    if poisoned { return .poison }
    if level > 55 { return .green }
    if level >= 25 { return .amber }
    return .red
}

func computeState(
    events rawEvents: [HydrationEvent],
    at: TimeInterval,
    settings baseSettings: EngineSettings = .default
) -> HydrationState {
    let sorted = rawEvents.sorted { $0.at < $1.at }
    let poison = extractPoisonWindows(sorted)

    if sorted.isEmpty {
        return HydrationState(
            level: 100, zone: .green, poisoned: false,
            poisonUntil: nil, ambleAt: nil, redAt: nil
        )
    }

    var level = 100.0
    var cursor = sorted.first!.at
    for e in sorted {
        let s = effectiveSettings(sorted, e.at, baseSettings)
        level -= integrateDrain(from: cursor, to: e.at, s, poison)
        level = clamp(level, 0, 100)
        if e.type == .drink, let k = e.kind {
            let s2 = effectiveSettings(sorted, e.at, baseSettings)
            if k == .water {
                level += waterGainPerGlass(s2)
            } else if let imp = DRINK_IMPACT[k] {
                level += imp
            }
            level = clamp(level, 0, 100)
        }
        cursor = e.at
    }
    let s = effectiveSettings(sorted, at, baseSettings)
    level -= integrateDrain(from: cursor, to: at, s, poison)
    level = clamp(level, 0, 100)

    let active = poison.first { at >= $0.start && at < $0.end }
    let poisoned = active != nil
    let poisonUntil = active?.end

    let (ambleAt, redAt) = forecast(
        at: at, startLevel: level,
        baseSettings: baseSettings, poison: poison
    )
    return HydrationState(
        level: level,
        zone: zoneOf(level, poisoned: poisoned),
        poisoned: poisoned,
        poisonUntil: poisonUntil,
        ambleAt: ambleAt,
        redAt: redAt
    )
}

func forecast(
    at: TimeInterval, startLevel: Double,
    baseSettings s: EngineSettings, poison: [Interval],
    horizonMs: TimeInterval = 6 * 3_600_000
) -> (TimeInterval?, TimeInterval?) {
    var ambleAt: TimeInterval? = startLevel <= 55 ? at : nil
    var redAt: TimeInterval? = startLevel < 25 ? at : nil
    if ambleAt != nil && redAt != nil { return (ambleAt, redAt) }
    let STEP: Double = 60_000
    let rate = baseDrainRate(s)
    var level = startLevel
    var t = at
    let end = at + horizonMs
    while t < end {
        let next = min(t + STEP, end)
        let mid = (t + next) / 2
        if !isSleeping(at: mid, s) {
            let poisoned = poison.contains { mid >= $0.start && mid < $0.end }
            let mult = poisoned ? POISON_MULTIPLIER : 1.0
            level -= rate * mult * (next - t)
        }
        if ambleAt == nil && level <= 55 { ambleAt = next }
        if redAt == nil && level < 25 { redAt = next; break }
        t = next
    }
    return (ambleAt, redAt)
}

// Loader used by the widget: reads the JSON snapshot the RN side dropped
// into the App Group UserDefaults.
struct SharedSnapshot: Decodable {
    let version: Int
    let updatedAt: TimeInterval
    let events: [HydrationEvent]
    let settings: EngineSettings
}

func loadSharedSnapshot(appGroup: String = "group.com.chipli.hydra") -> SharedSnapshot? {
    guard let defaults = UserDefaults(suiteName: appGroup) else { return nil }
    guard let raw = defaults.string(forKey: "hydraSnapshot") else { return nil }
    guard let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(SharedSnapshot.self, from: data)
}
