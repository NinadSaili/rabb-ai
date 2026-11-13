import ManagedSettings
import ManagedSettingsUI
import UIKit

/// Shield copy. Shield extensions cannot launch the host app, so the text invites the user to open Rabb.ai themselves,
/// and the secondary button schedules a local notification that does (see ShieldAction). Verify on a device (spike S9, S10).
final class ShieldConfigurationExtension: ShieldConfigurationDataSource {
    private func config() -> ShieldConfiguration {
        ShieldConfiguration(
            backgroundBlurStyle: .systemMaterial,
            backgroundColor: UIColor(red: 0.98, green: 0.97, blue: 0.94, alpha: 1),
            title: ShieldConfiguration.Label(text: NSLocalizedString("Seek the Word first", comment: "shield title"), color: UIColor(red: 0.12, green: 0.12, blue: 0.11, alpha: 1)),
            subtitle: ShieldConfiguration.Label(text: NSLocalizedString("Open Rabb.ai to read today's verse and pray. Your apps unlock when you finish.", comment: "shield subtitle"), color: UIColor(red: 0.33, green: 0.33, blue: 0.31, alpha: 1)),
            primaryButtonLabel: ShieldConfiguration.Label(text: NSLocalizedString("OK", comment: ""), color: .white),
            primaryButtonBackgroundColor: UIColor(red: 0.37, green: 0.42, blue: 0.29, alpha: 1),
            secondaryButtonLabel: ShieldConfiguration.Label(text: NSLocalizedString("Remind me to open Rabb.ai", comment: ""), color: UIColor(red: 0.37, green: 0.42, blue: 0.29, alpha: 1))
        )
    }
    override func configuration(shielding application: Application) -> ShieldConfiguration { config() }
    override func configuration(shielding application: Application, in category: ActivityCategory) -> ShieldConfiguration { config() }
    override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration { config() }
    override func configuration(shielding webDomain: WebDomain, in category: ActivityCategory) -> ShieldConfiguration { config() }
}
