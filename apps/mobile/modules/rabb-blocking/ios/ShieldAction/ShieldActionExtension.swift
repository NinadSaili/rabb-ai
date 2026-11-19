import ManagedSettings
import UserNotifications

/// Primary button closes the shield screen. Secondary posts a local notification that opens Rabb.ai when tapped.
/// Whether an extension may post notifications must be confirmed on a device (spike S10). If it cannot, the copy
/// in ShieldConfiguration already tells the user to open Rabb.ai from the home screen.
final class ShieldActionExtension: ShieldActionDelegate {
    private func handle(_ action: ShieldAction, completion: @escaping (ShieldActionResponse) -> Void) {
        switch action {
        case .primaryButtonPressed:
            completion(.close)
        case .secondaryButtonPressed:
            let content = UNMutableNotificationContent()
            content.title = NSLocalizedString("Seek the Word first", comment: "")
            content.body = NSLocalizedString("Tap to open Rabb.ai and start today's ritual.", comment: "")
            let request = UNNotificationRequest(identifier: "rabb.shield.open", content: content, trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
            UNUserNotificationCenter.current().add(request) { _ in completion(.close) }
        @unknown default:
            completion(.close)
        }
    }
    override func handle(action: ShieldAction, for application: ApplicationToken, completionHandler: @escaping (ShieldActionResponse) -> Void) { handle(action, completion: completionHandler) }
    override func handle(action: ShieldAction, for webDomain: WebDomainToken, completionHandler: @escaping (ShieldActionResponse) -> Void) { handle(action, completion: completionHandler) }
    override func handle(action: ShieldAction, for category: ActivityCategoryToken, completionHandler: @escaping (ShieldActionResponse) -> Void) { handle(action, completion: completionHandler) }
}
