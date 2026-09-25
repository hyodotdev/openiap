using Foundation;

namespace OpenIap.Maui.Example;

// iOS 27 terminates an app built with the iOS 27 SDK that never adopts the
// scene lifecycle. MAUI ships MauiUISceneDelegate, but the linker drops it
// unless a registered subclass names it, so Info.plist points at this one.
[Register("SceneDelegate")]
public class SceneDelegate : MauiUISceneDelegate
{
}
