// Swift-side tests mirroring src/engine/hydrationEngine.test.ts. Run these
// from Xcode's Test navigator after prebuild opens the workspace, or via
// `xcodebuild test -scheme HydraWidget` if the target is exposed.

import XCTest

final class HydrationEngineTests: XCTestCase {
    // 2026-06-15 10:00 in *local* time — same anchor as the JS tests.
    private func ts(_ h: Int, _ m: Int = 0) -> TimeInterval {
        var c = DateComponents()
        c.year = 2026; c.month = 6; c.day = 15; c.hour = h; c.minute = m
        let d = Calendar.current.date(from: c)!
        return d.timeIntervalSince1970 * 1000
    }

    func testZoneOf() {
        XCTAssertEqual(zoneOf(100, poisoned: false), .green)
        XCTAssertEqual(zoneOf(56, poisoned: false), .green)
        XCTAssertEqual(zoneOf(55, poisoned: false), .amber)
        XCTAssertEqual(zoneOf(25, poisoned: false), .amber)
        XCTAssertEqual(zoneOf(24, poisoned: false), .red)
        XCTAssertEqual(zoneOf(80, poisoned: true), .poison)
    }

    func testNoEventsLevel100() {
        let s = computeState(events: [], at: ts(10))
        XCTAssertEqual(s.level, 100)
        XCTAssertEqual(s.zone, .green)
    }

    func testDrainOneHour() {
        let events: [HydrationEvent] = [
            HydrationEvent(type: .drink, kind: .water, at: ts(10), volumeMl: nil, settings: nil)
        ]
        let start = computeState(events: events, at: ts(10))
        let hour = computeState(events: events, at: ts(11))
        let delta = start.level - hour.level
        XCTAssertGreaterThan(delta, 9.5)
        XCTAssertLessThan(delta, 10.5)
    }

    func testNoDrainDuringSleep() {
        let events: [HydrationEvent] = [
            HydrationEvent(type: .drink, kind: .water, at: ts(22), volumeMl: nil, settings: nil)
        ]
        let mid = computeState(events: events, at: ts(24 + 1))
        let later = computeState(events: events, at: ts(24 + 5))
        XCTAssertEqual(mid.level, later.level, accuracy: 0.01)
    }

    func testBeerPoisonsAnd8Percent() {
        let events: [HydrationEvent] = [
            HydrationEvent(type: .drink, kind: .water, at: ts(10), volumeMl: nil, settings: nil),
            HydrationEvent(type: .drink, kind: .beer, at: ts(10, 1), volumeMl: nil, settings: nil),
        ]
        let s = computeState(events: events, at: ts(10, 1))
        XCTAssertTrue(s.poisoned)
        XCTAssertLessThan(s.level, 100 - 8 + 0.5)
        XCTAssertGreaterThan(s.level, 100 - 8 - 2)
    }

    func testPoison3xDrain() {
        let events: [HydrationEvent] = [
            HydrationEvent(type: .drink, kind: .beer, at: ts(10), volumeMl: nil, settings: nil)
        ]
        let hour = computeState(events: events, at: ts(11))
        XCTAssertLessThan(hour.level, 100 - 8 - 25)
        XCTAssertGreaterThan(hour.level, 100 - 8 - 35)
    }

    func testPoisonCap4h() {
        let events: [HydrationEvent] = [
            HydrationEvent(type: .drink, kind: .shot, at: ts(10), volumeMl: nil, settings: nil),
            HydrationEvent(type: .drink, kind: .shot, at: ts(10, 1), volumeMl: nil, settings: nil),
            HydrationEvent(type: .drink, kind: .shot, at: ts(10, 2), volumeMl: nil, settings: nil),
        ]
        let stillPoisoned = computeState(events: events, at: ts(13, 59))
        XCTAssertTrue(stillPoisoned.poisoned)
        let clear = computeState(events: events, at: ts(14, 1))
        XCTAssertFalse(clear.poisoned)
    }

    func testWaterGain() {
        let g = waterGainPerGlass(.default)
        XCTAssertGreaterThan(g, 13)
        XCTAssertLessThan(g, 15)
    }
}
