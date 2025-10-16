import SwiftUI
import OpenIAP

@main
@available(iOS 15.0, *)
struct OpenIapExampleApp: App {
    init() {
        // Enable verbose logging for the example app only
        OpenIapLog.setEnabled(true)
    }
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
