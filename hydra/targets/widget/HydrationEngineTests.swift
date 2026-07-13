// Swift-side tests mirroring src/engine/hydrationEngine.test.ts (v2 physio).
// Run from Xcode's Test navigator (cmd+U) or:
//   xcodebuild test -workspace ios/hydra.xcworkspace -scheme HydraWidget \
//     -destination 'platform=iOS Simulator,name=iPhone 15 Pro'

import XCTest

final class HydrationEngineTests: XCTestCase {
    private func ts(_ h: Int, _ m: Int = 0) -> TimeInterval {
        var c = DateComponents()
        c.year = 2026; c.month = 6; c.day = 15; c.hour = h; c.minute = m
        return Calendar.current.date(from: c)!.timeIntervalSince1970 * 1000
    }
    private let P70 = UserProfile(
        weightKg: 70, sex: .male, awakeHours: 16,
        sleepStartHour: 23, sleepEndHour: 7,
        ambientTempC: nil, relativeHumidityPct: nil,
        altitudeM: 0, dailyGoalOverrideMl: nil
    )
    private func anchor(_ at: TimeInterval) -> HydrationEvent {
        HydrationEvent(type: .water, at: at, volumeMl: 1, abv: nil,
                       caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
    }

    func testDailyNeed70kg() {
        XCTAssertEqual(dailyNeedMl(P70), 2240, accuracy: 1e-6)
        XCTAssertEqual(baseDrainMlPerHour(P70), 140, accuracy: 1e-6)
    }

    // #1
    func testPassiveDrain2h() {
        let evs = [anchor(ts(10))]
        let before = computeState(events: evs, at: ts(10), profile: P70)
        let after = computeState(events: evs, at: ts(12), profile: P70)
        let drop = before.levelMl - after.levelMl
        XCTAssertGreaterThan(drop, 275)
        XCTAssertLessThan(drop, 285)
    }

    // #2
    func testSleepMultiplier() {
        let day = computeState(events: [anchor(ts(10))], at: ts(10), profile: P70).levelMl
                - computeState(events: [anchor(ts(10))], at: ts(12), profile: P70).levelMl
        let night = computeState(events: [anchor(ts(22))], at: ts(24 + 1), profile: P70).levelMl
                  - computeState(events: [anchor(ts(22))], at: ts(24 + 3), profile: P70).levelMl
        let ratio = night / day
        XCTAssertGreaterThan(ratio, 0.38)
        XCTAssertLessThan(ratio, 0.42)
    }

    // #3 — beer stays hydration-positive, poison mild after the ABV gate.
    func testBeer5pctNeutralAndPoison() {
        XCTAssertGreaterThan(alcoholNetMl(volumeMl: 500, abv: 5), 405)
        XCTAssertLessThan(alcoholNetMl(volumeMl: 500, abv: 5), 425)
        let g = ethanolGrams(volumeMl: 500, abv: 5)
        XCTAssertGreaterThan(1 + peakPoisonExtra(g, 5), 1.1)
        XCTAssertLessThan(1 + peakPoisonExtra(g, 5), 1.3)

        let evs: [HydrationEvent] = [
            anchor(ts(10)),
            HydrationEvent(type: .alcohol, at: ts(10, 1), volumeMl: 500, abv: 5,
                           caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let s = computeState(events: evs, at: ts(10, 2), profile: P70)
        XCTAssertTrue(s.poisoned)
        XCTAssertGreaterThan(s.levelMl, 2200)
    }

    // #4b — concentration gate: a shot outweighs a beer despite fewer grams.
    func testConcentrationGateShotOutweighsBeer() {
        XCTAssertEqual(concentrationFactor(5), 0.3, accuracy: 1e-6)
        XCTAssertEqual(concentrationFactor(14), 0.65, accuracy: 1e-2)
        XCTAssertEqual(concentrationFactor(40), 1.0, accuracy: 1e-6)

        let beerG = ethanolGrams(volumeMl: 400, abv: 5) // ≈ 15.8 g
        let shotG = ethanolGrams(volumeMl: 40, abv: 40) // ≈ 12.6 g
        XCTAssertGreaterThan(beerG, shotG)
        XCTAssertGreaterThan(peakPoisonExtra(shotG, 40), peakPoisonExtra(beerG, 5))

        XCTAssertGreaterThan(alcoholNetMl(volumeMl: 400, abv: 5), 0)
        XCTAssertLessThan(alcoholNetMl(volumeMl: 40, abv: 40), 0)
    }

    // #4
    func testShotNegativeAndPoison() {
        XCTAssertLessThan(alcoholNetMl(volumeMl: 40, abv: 40), -95)
        XCTAssertGreaterThan(alcoholNetMl(volumeMl: 40, abv: 40), -115)

        let base: [HydrationEvent] = [anchor(ts(10))]
        let withShot: [HydrationEvent] = [
            anchor(ts(10)),
            HydrationEvent(type: .alcohol, at: ts(10, 1), volumeMl: 40, abv: 40,
                           caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let bBase = computeState(events: base, at: ts(10, 2), profile: P70)
        let bShot = computeState(events: withShot, at: ts(10, 2), profile: P70)
        XCTAssertTrue(bShot.poisoned)
        if let br = bBase.redAt, let sr = bShot.redAt {
            XCTAssertLessThan(sr, br)
        }
    }

    // #5
    func testPoisonCumulateCap3xAnd4h() {
        let evs: [HydrationEvent] = [
            anchor(ts(10)),
            HydrationEvent(type: .alcohol, at: ts(10, 5),  volumeMl: 500, abv: 8, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .alcohol, at: ts(10, 10), volumeMl: 500, abv: 8, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .alcohol, at: ts(10, 15), volumeMl: 500, abv: 8, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .alcohol, at: ts(10, 20), volumeMl: 500, abv: 8, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
        ]
        let s = computeState(events: evs, at: ts(12, 0), profile: P70)
        XCTAssertTrue(s.poisoned)
        XCTAssertLessThanOrEqual(s.poisonMult, 3.0 + 1e-9)

        let lastAt = ts(10, 30)
        let evs2: [HydrationEvent] = [
            anchor(ts(10)),
            HydrationEvent(type: .alcohol, at: ts(10, 5), volumeMl: 500, abv: 5, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .alcohol, at: lastAt,    volumeMl: 500, abv: 5, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let beforeEnd = computeState(events: evs2, at: lastAt + 4 * 3_600_000 - 60_000, profile: P70)
        let afterEnd = computeState(events: evs2, at: lastAt + 4 * 3_600_000 + 60_000, profile: P70)
        XCTAssertTrue(beforeEnd.poisoned)
        XCTAssertFalse(afterEnd.poisoned)
    }

    // #6
    func testSportBySex() {
        let male: [HydrationEvent] = [
            anchor(ts(10)),
            HydrationEvent(type: .sport, at: ts(10, 1), volumeMl: nil, abv: nil,
                           caffeineMg: nil, durationMin: 60, intensity: .moderate, patch: nil)
        ]
        let before = computeState(events: male, at: ts(10, 1), profile: P70)
        let after = computeState(events: male, at: ts(11, 1), profile: P70)
        let sportLoss = before.levelMl - after.levelMl - baseDrainMlPerHour(P70)
        XCTAssertGreaterThan(sportLoss, 780)
        XCTAssertLessThan(sportLoss, 820)

        // Female residual is ~10 % below male at matched mass/intensity.
        var F70 = P70; F70.sex = .female
        let ratio = sweatRateMlPerHour(F70, intensity: .moderate)
                  / sweatRateMlPerHour(P70, intensity: .moderate)
        XCTAssertEqual(ratio, 0.9, accuracy: 1e-6)

        // Metabolic-heat calibration (70 kg male, temperate).
        XCTAssertEqual(sweatRateMlPerHour(P70, intensity: .moderate), 800.8, accuracy: 0.1)
        XCTAssertEqual(sweatRateMlPerHour(P70, intensity: .light), 400.4, accuracy: 0.1)
        XCTAssertEqual(sweatRateMlPerHour(P70, intensity: .intense), 1151.15, accuracy: 0.1)

        // Sweat scales linearly with body mass.
        var P90 = P70; P90.weightKg = 90
        let massRatio = sweatRateMlPerHour(P90, intensity: .moderate)
                      / sweatRateMlPerHour(P70, intensity: .moderate)
        XCTAssertEqual(massRatio, 90.0 / 70.0, accuracy: 1e-6)
    }

    // Water absorption cap (~1000 mL / rolling hour)
    func testWaterAbsorptionCap() {
        let chug: [HydrationEvent] = [
            HydrationEvent(type: .water, at: ts(12), volumeMl: 2000, abv: nil,
                           caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let after = computeState(events: chug, at: ts(12), profile: P70)
        XCTAssertLessThanOrEqual(after.absorbedLastHourMl, 1000 + 1e-6)
        XCTAssertTrue(after.saturated)

        let spread: [HydrationEvent] = [
            HydrationEvent(type: .water, at: ts(8),  volumeMl: 500, abv: nil, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .water, at: ts(9),  volumeMl: 500, abv: nil, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .water, at: ts(10), volumeMl: 500, abv: nil, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .water, at: ts(11), volumeMl: 500, abv: nil, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
        ]
        let last = computeState(events: spread, at: ts(11), profile: P70)
        XCTAssertEqual(last.absorbedLastHourMl, 500, accuracy: 1)
        XCTAssertFalse(last.saturated)
    }

    // Alcohol's water shares the absorption cap; saturated → a drink is net-negative.
    func testAlcoholRespectsAbsorptionCap() {
        let base: [HydrationEvent] = [
            HydrationEvent(type: .water, at: ts(20), volumeMl: 1000, abv: nil,
                           caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let withBeer: [HydrationEvent] = base + [
            HydrationEvent(type: .alcohol, at: ts(20, 1), volumeMl: 400, abv: 5,
                           caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let before = computeState(events: base, at: ts(20, 1), profile: P70).levelMl
        let after = computeState(events: withBeer, at: ts(20, 1), profile: P70).levelMl
        XCTAssertLessThan(after, before) // saturated hour → beer is a net loss

        // With fresh capacity the same beer is a net gain.
        let anchor: [HydrationEvent] = [
            HydrationEvent(type: .water, at: ts(8), volumeMl: 1, abv: nil,
                           caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let anchorBeer: [HydrationEvent] = anchor + [
            HydrationEvent(type: .alcohol, at: ts(20), volumeMl: 400, abv: 5,
                           caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil)
        ]
        let b0 = computeState(events: anchor, at: ts(20), profile: P70).levelMl
        let b1 = computeState(events: anchorBeer, at: ts(20), profile: P70).levelMl
        XCTAssertGreaterThan(b1, b0)
    }

    // #7
    func testAmbientTemp30Multiplier() {
        var cool = P70; cool.ambientTempC = nil
        var hot = P70;  hot.ambientTempC = 32
        let evs = [anchor(ts(10))]
        let coolDrop = computeState(events: evs, at: ts(10), profile: cool).levelMl
                     - computeState(events: evs, at: ts(11), profile: cool).levelMl
        let hotDrop = computeState(events: evs, at: ts(10), profile: hot).levelMl
                    - computeState(events: evs, at: ts(11), profile: hot).levelMl
        let ratio = hotDrop / coolDrop
        XCTAssertGreaterThan(ratio, 1.38)
        XCTAssertLessThan(ratio, 1.42)
    }

    // #8
    func testIncrementalEqualsOneShot() {
        let evs: [HydrationEvent] = [
            anchor(ts(8)),
            HydrationEvent(type: .water, at: ts(9, 15), volumeMl: 300, abv: nil, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .alcohol, at: ts(10, 30), volumeMl: 500, abv: 5, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .water, at: ts(11), volumeMl: 250, abv: nil, caffeineMg: nil, durationMin: nil, intensity: nil, patch: nil),
            HydrationEvent(type: .sport, at: ts(12), volumeMl: nil, abv: nil, caffeineMg: nil, durationMin: 45, intensity: .moderate, patch: nil)
        ]
        let target = ts(14, 0)
        let oneShot = computeState(events: evs, at: target, profile: P70)
        // Poll every 15 min then compare final — pure function contract.
        var t = ts(8)
        while t <= target {
            _ = computeState(events: evs, at: t, profile: P70)
            t += 15 * 60_000
        }
        let stepped = computeState(events: evs, at: target, profile: P70)
        XCTAssertEqual(stepped.levelMl, oneShot.levelMl, accuracy: 1e-6)
    }
}
