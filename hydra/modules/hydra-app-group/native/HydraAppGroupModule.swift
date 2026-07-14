// Native RN module compiled into the MAIN app (never the widget extension).
// Lets the JS side write the shared snapshot into the App Group and reload the
// widget timelines. Injected into the app target by plugins/withHydraAppGroup.js
// (kept outside targets/ so @bacons/apple-targets does not sweep it into the
// widget target, where `import React` is unavailable).

import Foundation
import WidgetKit
import React

@objc(HydraAppGroup)
class HydraAppGroup: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool { return false }

    @objc
    func writeSnapshot(_ appGroup: String,
                       json: String,
                       resolver resolve: @escaping RCTPromiseResolveBlock,
                       rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = UserDefaults(suiteName: appGroup) else {
            reject("no_group", "App Group unavailable: \(appGroup)", nil)
            return
        }
        defaults.set(json, forKey: "hydraSnapshot")
        resolve(nil)
    }

    @objc
    func reloadWidget(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        resolve(nil)
    }
}
