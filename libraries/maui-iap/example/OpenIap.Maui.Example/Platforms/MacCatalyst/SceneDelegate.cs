using Foundation;

namespace OpenIap.Maui.Example;

// Mac Catalyst 27 enforces the same scene-lifecycle requirement as iOS 27.
// MAUI ships MauiUISceneDelegate, but the linker drops it unless a registered
// subclass names it, so Info.plist points at this one.
[Register("SceneDelegate")]
public class SceneDelegate : MauiUISceneDelegate
{
}
