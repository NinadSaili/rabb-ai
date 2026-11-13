import ExpoModulesCore
import FamilyControls
import SwiftUI

/// Application tokens are opaque: the host app cannot read app names. This view renders them with SwiftUI Label(token),
/// so the user sees real names and icons while JavaScript only ever receives counts.
final class SelectedAppsModel: ObservableObject {
    @Published var selection = RabbShared.selection
    func reload() { selection = RabbShared.selection }
}

struct SelectedAppsList: View {
    @ObservedObject var model: SelectedAppsModel
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(model.selection.applicationTokens), id: \.self) { Label($0).labelStyle(.titleAndIcon) }
            ForEach(Array(model.selection.categoryTokens), id: \.self) { Label($0).labelStyle(.titleAndIcon) }
            ForEach(Array(model.selection.webDomainTokens), id: \.self) { Label($0).labelStyle(.titleAndIcon) }
        }
        .accessibilityElement(children: .combine)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

public final class SelectedAppsSummaryView: ExpoView {
    private let model = SelectedAppsModel()
    private lazy var host = UIHostingController(rootView: SelectedAppsList(model: model))

    required public init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: leadingAnchor), host.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            host.view.topAnchor.constraint(equalTo: topAnchor), host.view.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    /// Bumped from JS after the picker closes so the list reloads.
    var version: Int = 0 { didSet { model.reload() } }
}
