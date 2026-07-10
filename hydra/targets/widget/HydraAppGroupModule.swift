// Native RN module compiled into the main app (not the widget) that lets the
// JS side write into the shared App Group and reload widget timelines.
// The @bacons/apple-targets config plugin picks up files in this folder and
// adds them to the correct target based on filename — this one is auto-added
// to the main app if you name it *AppGroup*.swift. If your setup does not
// auto-wire it, move this file next to your other RN native modules.

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
