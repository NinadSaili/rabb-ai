import DeviceActivity
import ManagedSettings
import Foundation

/// Runs when a registered schedule interval starts or ends, even if the app is not running.
/// Tiny on purpose: reads the shared state, flips the shield, writes a heartbeat.
final class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    private let store = ManagedSettingsStore(named: .init("rabb"))

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        RabbShared.heartbeatMs = Date().timeIntervalSince1970 * 1000
        guard !RabbShared.isSuspended else { return } // ritual completed or emergency bypass
        let s = RabbShared.selection
        store.shield.applications = s.applicationTokens.isEmpty ? nil : s.applicationTokens
        store.shield.applicationCategories = s.categoryTokens.isEmpty ? nil : .specific(s.categoryTokens)
        store.shield.webDomains = s.webDomainTokens.isEmpty ? nil : s.webDomainTokens
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        RabbShared.heartbeatMs = Date().timeIntervalSince1970 * 1000
        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.shield.webDomains = nil
    }
}
