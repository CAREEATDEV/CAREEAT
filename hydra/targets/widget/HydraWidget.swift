import WidgetKit
import SwiftUI
import AppIntents

struct HydraEntry: TimelineEntry {
    let date: Date
    let state: HydrationState
}

struct HydraProvider: TimelineProvider {
    func placeholder(in context: Context) -> HydraEntry {
        HydraEntry(date: Date(), state: HydrationState(
            levelMl: 1750, dailyNeedMl: 2240, levelPct: 78,
            zone: .green, poisoned: false, poisonUntil: nil,
            poisonMult: 1, ambleAt: nil, redAt: nil,
            absorbedLastHourMl: 0, absorbCapMl: 1000, saturated: false
        ))
    }

    func getSnapshot(in context: Context, completion: @escaping (HydraEntry) -> Void) {
        completion(entry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<HydraEntry>) -> Void) {
        let now = Date()
        var entries: [HydraEntry] = []
        let stepSec: TimeInterval = 15 * 60
        let horizonSec: TimeInterval = 6 * 3600
        var i = 0.0
        while i <= horizonSec {
            entries.append(entry(at: now.addingTimeInterval(i)))
            i += stepSec
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(horizonSec))))
    }

    private func entry(at date: Date) -> HydraEntry {
        let snap = loadSharedSnapshot()
        let ms = date.timeIntervalSince1970 * 1000
        let s: HydrationState
        if let snap = snap {
            s = computeState(events: snap.events, at: ms, profile: snap.profile)
        } else {
            s = HydrationState(
                levelMl: 2240, dailyNeedMl: 2240, levelPct: 100,
                zone: .green, poisoned: false, poisonUntil: nil,
                poisonMult: 1, ambleAt: nil, redAt: nil,
                absorbedLastHourMl: 0, absorbCapMl: 1000, saturated: false
            )
        }
        return HydraEntry(date: date, state: s)
    }
}

struct HydraBarView: View {
    let state: HydrationState
    let segments: Int = 14
    @Environment(\.widgetFamily) private var family

    private var zoneColor: Color {
        switch state.zone {
        case .poison: return Color(red: 0.706, green: 0.298, blue: 1.0)
        case .red:    return Color(red: 1.0,   green: 0.231, blue: 0.290)
        case .amber:  return Color(red: 1.0,   green: 0.690, blue: 0.125)
        case .green:  return Color(red: 0.243, green: 0.878, blue: 0.478)
        }
    }

    private var statusText: String {
        if state.poisoned { return "EMPOISONNÉ" }
        switch state.zone {
        case .red: return "CRITIQUE"
        case .amber: return "TU SÈCHES"
        case .poison, .green: return "HYDRATÉ"
        }
    }

    private var countdown: String {
        guard let red = state.redAt else { return "—" }
        let secs = red / 1000 - Date().timeIntervalSince1970
        if secs <= 0 { return "0m" }
        let h = Int(secs / 3600), m = (Int(secs) % 3600) / 60
        return h > 0 ? "\(h)h\(String(format: "%02d", m))" : "\(m)m"
    }

    var body: some View {
        let filled = Int((state.levelPct / 100.0) * Double(segments))
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text("HYDRA").font(.system(size: 10, weight: .bold, design: .monospaced))
                Spacer()
                Text("\(Int(state.levelPct))%")
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(zoneColor)
            }
            HStack(spacing: 2) {
                ForEach(0..<segments, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 1)
                        .fill(i < filled ? zoneColor : Color.gray.opacity(0.3))
                        .frame(height: 10)
                }
            }
            HStack {
                Text(statusText).font(.system(size: 9, weight: .semibold))
                    .foregroundColor(zoneColor)
                Spacer()
                Text("→\(countdown)").font(.system(size: 9, weight: .regular, design: .monospaced))
                    .foregroundColor(.gray)
            }

            // Interactive "+ EAU" button (iOS 17+). The home-screen systemSmall
            // has the room for a proper button; the lock-screen rectangular is
            // tiny + monochrome, so we keep a compact tappable target there.
            if #available(iOS 17.0, *) {
                Button(intent: LogWaterIntent(volumeMl: 250)) {
                    if family == .systemSmall {
                        Text("＋ EAU · 250 mL")
                            .font(.system(size: 11, weight: .heavy))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    } else {
                        Text("＋ EAU").font(.system(size: 9, weight: .heavy))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 3)
                    }
                }
                .buttonStyle(.plain)
                .tint(zoneColor)
                .padding(.top, 2)
            }
        }
        // Fallback for iOS < 17 (and for the whole-widget tap): open the app.
        .widgetURL(URL(string: "hydra://home"))
        .containerBackground(for: .widget) { Color.black }
    }
}

struct HydraLockWidget: Widget {
    let kind = "HydraLockWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: HydraProvider()) { entry in
            HydraBarView(state: entry.state)
        }
        .configurationDisplayName("HYDRA")
        .description("Barre de vie hydratation.")
        .supportedFamilies([.accessoryRectangular, .systemSmall])
    }
}

@main
struct HydraWidgetBundle: WidgetBundle {
    var body: some Widget {
        HydraLockWidget()
        // The lock-screen / Control Center "+ Eau" button (iOS 18+).
        if #available(iOS 18.0, *) {
            HydraWaterControl()
        }
    }
}
