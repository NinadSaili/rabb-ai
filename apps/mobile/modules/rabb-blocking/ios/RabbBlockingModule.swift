import ExpoModulesCore
import FamilyControls

/// iOS implementation of the AppBlockingService contract (apps/mobile/src/services/blocking/types.ts).
/// Written for the Expo Modules API. Not compiled in the authoring environment: no Xcode (docs/IOS_SCREEN_TIME.md, docs/STATUS.md).
public class RabbBlockingModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RabbBlocking")

        AsyncFunction("getCapabilities") { () -> [String: Any] in
            let c = BlockingController.shared
            let approved = c.permissionState() == "granted"
            var unmet: [[String: String]] = []
            if !approved { unmet.append(["requirement": "family_controls", "message": "Screen Time access is not granted, so Rabb.ai cannot restrict apps. It can still remind you."]) }
            return ["platform": "ios", "tier": approved ? "tier1" : "tier0", "unmet": unmet, "guaranteed": false]
        }

        AsyncFunction("getPermissionState") { (kind: String) -> String in
            kind == "family_controls" ? BlockingController.shared.permissionState() : "unavailable"
        }

        // The JS layer shows the prominent disclosure and gets consent BEFORE calling this.
        AsyncFunction("requestPermission") { (kind: String) async -> String in
            guard kind == "family_controls" else { return "unavailable" }
            return await BlockingController.shared.requestAuthorization().state
        }

        AsyncFunction("presentAppPicker") { (promise: Promise) in
            Task { @MainActor in
                guard BlockingController.shared.permissionState() == "granted" else {
                    promise.resolve(["result": "failed", "failure": "authorization_denied"]); return
                }
                BlockingController.shared.presentPicker(from: self.appContext?.utilities?.currentViewController()) { selected in
                    let s = RabbShared.selection
                    promise.resolve(["result": selected ? "selected" : "cancelled",
                                     "summary": ["count": s.applicationTokens.count, "categoryCount": s.categoryTokens.count, "webDomainCount": s.webDomainTokens.count]])
                }
            }
        }

        // Tokens are opaque: counts only. Names are shown by SelectedAppsSummaryView.
        AsyncFunction("getSelectedApplicationDisplayNames") { () -> [String: Int] in
            let s = RabbShared.selection
            return ["count": s.applicationTokens.count, "categoryCount": s.categoryTokens.count, "webDomainCount": s.webDomainTokens.count]
        }

        AsyncFunction("applyRestrictions") { () -> [String: Any?] in BlockingController.shared.apply() }
        AsyncFunction("removeRestrictions") { () -> [String: Any?] in BlockingController.shared.remove() }
        AsyncFunction("suspendUntil") { (untilMs: Double) -> [String: Any?] in BlockingController.shared.suspend(untilMs: untilMs) }
        AsyncFunction("setFeatureFlags") { (_: [String: Bool]) in }

        AsyncFunction("scheduleRestrictions") { (windows: [[String: Any]]) in
            let parsed = windows.compactMap { w -> RabbShared.Window? in
                guard let id = w["scheduleId"] as? String, let s = (w["startMs"] as? NSNumber)?.doubleValue, let e = (w["endMs"] as? NSNumber)?.doubleValue else { return nil }
                return RabbShared.Window(scheduleId: id, startMs: s, endMs: e)
            }
            BlockingController.shared.schedule(windows: parsed)
        }

        // Always a fresh read from ManagedSettingsStore.
        AsyncFunction("getRestrictionStatus") { () -> [String: Any?] in BlockingController.shared.status() }

        View(SelectedAppsSummaryView.self) {
            Prop("version") { (view: SelectedAppsSummaryView, value: Int) in view.version = value }
        }
    }
}
