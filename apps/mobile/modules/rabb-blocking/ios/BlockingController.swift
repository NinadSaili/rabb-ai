import FamilyControls
import ManagedSettings
import DeviceActivity
import SwiftUI
import UIKit

/// All Screen Time work for the app target. Restriction state is read back from ManagedSettingsStore, never from a flag.
final class BlockingController {
    static let shared = BlockingController()
    private let store = ManagedSettingsStore(named: .init("rabb"))
    private let center = DeviceActivityCenter()

    // MARK: Authorization

    func permissionState() -> String {
        switch AuthorizationCenter.shared.authorizationStatus {
        case .approved: return "granted"
        case .denied: return "denied"
        case .notDetermined: return "not_determined"
        @unknown default: return "unavailable"
        }
    }

    /// Returns a permission state. Throws the failure code when the entitlement is missing.
    func requestAuthorization() async -> (state: String, failure: String?) {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            return (permissionState(), nil)
        } catch let e as FamilyControlsError {
            // Mapping to be confirmed on a device (spike S1, S2): cancel or denial versus a missing entitlement.
            switch e {
            case .authorizationCanceled: return ("denied", "authorization_denied")
            default: return (permissionState(), "entitlement_missing")
            }
        } catch {
            return (permissionState(), "native_error")
        }
    }

    // MARK: Restrictions (read back from the store)

    var restrictionApplied: Bool {
        guard AuthorizationCenter.shared.authorizationStatus == .approved else { return false }
        return store.shield.applications != nil || store.shield.applicationCategories != nil || store.shield.webDomains != nil
    }

    func status(failure: String? = nil) -> [String: Any?] {
        var failureCode = failure
        if failureCode == nil, AuthorizationCenter.shared.authorizationStatus == .denied { failureCode = "authorization_revoked" }
        let beat = RabbShared.heartbeatMs
        if failureCode == nil, beat > 0, Date().timeIntervalSince1970 * 1000 - beat > 36 * 3600 * 1000, !RabbShared.windows.isEmpty { failureCode = "extension_unresponsive" }
        return ["restrictionApplied": restrictionApplied, "tier": AuthorizationCenter.shared.authorizationStatus == .approved ? "tier1" : "tier0", "lastHeartbeatMs": beat > 0 ? beat : nil, "failure": failureCode]
    }

    func apply() -> [String: Any?] {
        let s = RabbShared.selection
        RabbShared.suspendedUntilMs = 0
        store.shield.applications = s.applicationTokens.isEmpty ? nil : s.applicationTokens
        store.shield.applicationCategories = s.categoryTokens.isEmpty ? nil : .specific(s.categoryTokens)
        store.shield.webDomains = s.webDomainTokens.isEmpty ? nil : s.webDomainTokens
        return status()
    }

    func remove() -> [String: Any?] {
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
        return status()
    }

    func suspend(untilMs: Double) -> [String: Any?] {
        RabbShared.suspendedUntilMs = untilMs
        return remove()
    }

    // MARK: Schedules (DeviceActivity start and end callbacks run in ScreenTimeMonitor)

    /// Registers the next windows. DeviceActivity needs intervals of at least 15 minutes and the system caps schedules (about 20), so the next few are registered.
    func schedule(windows: [RabbShared.Window]) {
        RabbShared.windows = windows
        center.stopMonitoring()
        let cal = Calendar.current
        let now = Date().timeIntervalSince1970 * 1000
        for (i, w) in windows.filter({ $0.endMs > now && $0.endMs - $0.startMs >= 15 * 60 * 1000 }).prefix(16).enumerated() {
            let start = Date(timeIntervalSince1970: max(w.startMs, now + 60_000) / 1000), end = Date(timeIntervalSince1970: w.endMs / 1000)
            let comps: Set<Calendar.Component> = [.year, .month, .day, .hour, .minute]
            let schedule = DeviceActivitySchedule(intervalStart: cal.dateComponents(comps, from: start), intervalEnd: cal.dateComponents(comps, from: end), repeats: false)
            try? center.startMonitoring(DeviceActivityName("rabb.\(i).\(w.scheduleId)"), during: schedule)
        }
    }

    // MARK: Picker

    @MainActor
    func presentPicker(from controller: UIViewController?, completion: @escaping (Bool) -> Void) {
        let host = UIHostingController(rootView: PickerHost(initial: RabbShared.selection) { selection in
            if let selection { RabbShared.selection = selection }
            controller?.presentedViewController?.dismiss(animated: true) { completion(selection != nil) }
        })
        controller?.present(host, animated: true)
    }
}

private struct PickerHost: View {
    @State var selection: FamilyActivitySelection
    let finish: (FamilyActivitySelection?) -> Void
    init(initial: FamilyActivitySelection, finish: @escaping (FamilyActivitySelection?) -> Void) { _selection = State(initialValue: initial); self.finish = finish }
    var body: some View {
        NavigationView {
            FamilyActivityPicker(selection: $selection)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) { Button(NSLocalizedString("Cancel", comment: "")) { finish(nil) } }
                    ToolbarItem(placement: .confirmationAction) { Button(NSLocalizedString("Done", comment: "")) { finish(selection) } }
                }
        }
    }
}
