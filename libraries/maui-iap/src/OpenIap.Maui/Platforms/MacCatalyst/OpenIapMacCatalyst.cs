// macCatalyst delegates to the same iOS resolver — Mac Catalyst is a thin
// rewrap of UIKit + StoreKit, and OpenIAP.xcframework's macCatalyst slice
// exposes the same Objective-C surface as the device slice. Subclassing
// OpenIapIOS keeps any future macCatalyst-only overrides (e.g. window-scene
// APIs) localised to this file without forking the resolver.

#nullable enable

using OpenIap.Maui.Platforms.iOS;

namespace OpenIap.Maui.Platforms.MacCatalyst;

internal sealed class OpenIapMacCatalyst : OpenIapIOS;
