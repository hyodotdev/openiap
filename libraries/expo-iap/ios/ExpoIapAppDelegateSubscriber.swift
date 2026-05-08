import ExpoModulesCore
import OpenIAP
#if canImport(UIKit)
import UIKit
#endif

public class ExpoIapAppDelegateSubscriber: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        if #available(iOS 15.0, tvOS 16.0, *) {
            _ = OpenIapModule.shared
        }
        return true
    }
}
