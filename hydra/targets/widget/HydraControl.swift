// The ControlWidget API ships with the iOS 18 SDK (Xcode 16 = Swift 6). Wrap the
// whole file so an older toolchain (Xcode 15 / Swift 5.x) still compiles the
// widget target without it.
#if compiler(>=6.0)
import WidgetKit
import SwiftUI
import AppIntents

// iOS 18+ Control: a one-tap "+ Eau" button the user can place in the
// lock-screen bottom corners (where flashlight / camera sit) or in Control
// Center. Runs LogWaterIntent without unlocking or opening the app — the
// fastest possible way to log a glass. Gated to iOS 18 at the call site.
@available(iOS 18.0, *)
struct HydraWaterControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "com.shipply.hydraapp.control.water") {
            ControlWidgetButton(action: LogWaterIntent(volumeMl: 250)) {
                Label("+ Eau", systemImage: "drop.fill")
            }
            .tint(Color(red: 0.243, green: 0.878, blue: 0.478)) // HYDRA green
        }
        .displayName("HYDRA · Boire")
        .description("Logue un verre d'eau (250 mL).")
    }
}
#endif
