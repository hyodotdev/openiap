using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using Microsoft.Maui.ApplicationModel;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/offer-code.tsx — iOS presents the
// StoreKit sheet, Android opens the Play Store redeem page.
public partial class OfferCodePage : ContentPage
{
    private bool _connected;
    private bool _isRedeeming;

    public OfferCodePage()
    {
        InitializeComponent();
        ApplyPlatformContent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        try
        {
            await IapLifecycle.InitConnectionAsync();
            _connected = true;
            SetStatus("Connected to Store", Color.FromArgb("#28A745"));
        }
        catch (Exception ex)
        {
            _connected = false;
            SetStatus($"Connection failed: {ErrorUtils.ExtractErrorMessage(ex)}", Color.FromArgb("#DC3545"));
        }

        UpdateButtonState();
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        _connected = false;
        await IapLifecycle.EndConnectionQuietlyAsync(nameof(OfferCodePage));
    }

    private async void OnPresentClicked(object sender, EventArgs e)
    {
        if (!_connected)
        {
            await DisplayAlert("Not Connected", "Please wait for store connection", "OK");
            return;
        }

        _isRedeeming = true;
        UpdateButtonState();

#if IOS || MACCATALYST
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var presented = await mutate.PresentCodeRedemptionSheetIOSAsync();
            ResultPanel.IsVisible = true;
            ResultLabel.Text = presented
                ? "Code redemption sheet presented. After successful redemption, the purchase will appear in purchase history."
                : "The redemption sheet was not presented.";
        }
        catch (Exception ex)
        {
            ResultPanel.IsVisible = true;
            ResultLabel.Text = $"Failed to redeem code: {ErrorUtils.ExtractErrorMessage(ex)}";
        }
        finally
        {
            _isRedeeming = false;
            UpdateButtonState();
        }
#elif ANDROID
        try
        {
            await Browser.OpenAsync("https://play.google.com/redeem?code=", BrowserLaunchMode.External);
            ResultPanel.IsVisible = true;
            ResultLabel.Text = "Play Store opened. Enter your code there, then return to this app to see your purchase.";
        }
        catch (Exception ex)
        {
            ResultPanel.IsVisible = true;
            ResultLabel.Text = $"Failed to open Play Store: {ErrorUtils.ExtractErrorMessage(ex)}";
        }
        finally
        {
            _isRedeeming = false;
            UpdateButtonState();
        }
#else
        ResultPanel.IsVisible = true;
        ResultLabel.Text = "Offer code redemption is not available on this platform.";
        _isRedeeming = false;
        UpdateButtonState();
        await Task.CompletedTask;
#endif
    }

    private void ApplyPlatformContent()
    {
#if IOS || MACCATALYST
        RedeemButton.Text = "🎁 Redeem Offer Code";
        HowItWorksLabel.Text = "• Tap the button below to open the redemption sheet\n• Enter your offer code\n• The system will validate and apply the code\n• Your purchase will appear in purchase history";
        PlatformTitleLabel.Text = "Platform: ios";
        PlatformLabel.Text = "iOS supports in-app code redemption via StoreKit";
        TestingLabel.Text = "• Use TestFlight or App Store Connect to generate test codes\n• Test on real devices, not simulators\n• Sandbox environment supports offer codes";
#elif ANDROID
        RedeemButton.Text = "🎁 Open Play Store";
        HowItWorksLabel.Text = "• Tap the button to open Google Play Store\n• Enter your promo code in the Play Store\n• Complete the redemption process\n• Return to this app to see your purchase";
        PlatformTitleLabel.Text = "Platform: android";
        PlatformLabel.Text = "Android requires redemption through Google Play Store";
        TestingLabel.Text = "• Generate promo codes in Google Play Console\n• Test with your Google account\n• Ensure app is properly configured for IAP";
#else
        RedeemButton.Text = "🎁 Redeem Offer Code";
        HowItWorksLabel.Text = "Offer code redemption requires an iOS or Android store surface.";
        PlatformTitleLabel.Text = "Platform: unsupported";
        PlatformLabel.Text = "This platform has no IAP binding wired up.";
        TestingLabel.Text = "Run the example on iOS or Android.";
#endif
        UpdateButtonState();
    }

    private void SetStatus(string text, Color color)
    {
        StatusLabel.Text = text;
        StatusDot.Color = color;
    }

    private void UpdateButtonState()
    {
        RedeemButton.IsEnabled = _connected && !_isRedeeming;
        RedeemButton.Opacity = RedeemButton.IsEnabled ? 1 : 0.6;
        if (_isRedeeming)
        {
            RedeemButton.Text = "Redeeming...";
        }
        else
        {
            ApplyPlatformButtonText();
        }
    }

    private void ApplyPlatformButtonText()
    {
#if IOS || MACCATALYST
        RedeemButton.Text = "🎁 Redeem Offer Code";
#elif ANDROID
        RedeemButton.Text = "🎁 Open Play Store";
#else
        RedeemButton.Text = "🎁 Redeem Offer Code";
#endif
    }
}
