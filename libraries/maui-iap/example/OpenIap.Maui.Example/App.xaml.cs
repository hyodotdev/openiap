using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
        // The example's colors are light only; dark mode would darken its inputs and bars.
        UserAppTheme = AppTheme.Light;
        IapLifecycle.StartPurchaseFlow();
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        return new Window(new AppShell());
    }
}
