import Foundation
import FamilyControls

/// Small Codable state shared between the app and the three extensions through the App Group container.
/// Keep this file tiny: extensions run under a tight memory limit (reported around 6 MB for the monitor, verify with Instruments, spike S13).
/// Selection tokens never leave this container. Nothing here is logged or uploaded.
public enum RabbShared {
    public static let groupId = "group.com.rabbai.app"
    private static var defaults: UserDefaults? { UserDefaults(suiteName: groupId) }

    public struct Window: Codable { public let scheduleId: String; public let startMs: Double; public let endMs: Double }

    public static var selection: FamilyActivitySelection {
        get {
            guard let data = defaults?.data(forKey: "selection"), let s = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else { return FamilyActivitySelection() }
            return s
        }
        set { defaults?.set(try? JSONEncoder().encode(newValue), forKey: "selection") }
    }

    /// Epoch ms. Restrictions stay off while now < suspendedUntil (ritual completed or emergency bypass).
    public static var suspendedUntilMs: Double {
        get { defaults?.double(forKey: "suspendedUntilMs") ?? 0 }
        set { defaults?.set(newValue, forKey: "suspendedUntilMs") }
    }

    public static var windows: [Window] {
        get { (defaults?.data(forKey: "windows")).flatMap { try? JSONDecoder().decode([Window].self, from: $0) } ?? [] }
        set { defaults?.set(try? JSONEncoder().encode(newValue), forKey: "windows") }
    }

    /// Written by the monitor extension on every callback. A stale value means the extension is not running (extension_unresponsive).
    public static var heartbeatMs: Double {
        get { defaults?.double(forKey: "heartbeatMs") ?? 0 }
        set { defaults?.set(newValue, forKey: "heartbeatMs") }
    }

    public static var isSuspended: Bool { Date().timeIntervalSince1970 * 1000 < suspendedUntilMs }
}
