using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
        IapLifecycle.StartPurchaseFlow();
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        return new Window(new AppShell());
    }
}
