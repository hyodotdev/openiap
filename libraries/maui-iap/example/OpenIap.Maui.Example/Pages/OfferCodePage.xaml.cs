using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/offer-code.tsx — iOS-only
// presentCodeRedemptionSheetIOS, with a hint shown on Android explaining
// where promo codes are redeemed instead.
public partial class OfferCodePage : ContentPage
{
    public OfferCodePage()
    {
        InitializeComponent();
#if IOS || MACCATALYST
        PlatformLabel.Text = "Supported on iOS / macCatalyst.";
#elif ANDROID
        PlatformLabel.Text = "Android does not surface an in-app redemption sheet — direct users to play.google.com/redeem.";
#else
        PlatformLabel.Text = "This platform has no IAP binding wired up.";
#endif
    }

    private async void OnPresentClicked(object sender, EventArgs e)
    {
#if IOS || MACCATALYST
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.PresentCodeRedemptionSheetIOSAsync();
            ResultPanel.IsVisible = true;
            ResultLabel.Text = "Presented redemption sheet — outcome arrives via PurchaseUpdated.";
        }
        catch (Exception ex)
        {
            ResultPanel.IsVisible = true;
            ResultLabel.Text = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
#else
        ResultPanel.IsVisible = true;
        ResultLabel.Text = "Offer code redemption is iOS / macCatalyst only.";
        await Task.CompletedTask;
#endif
    }
}
