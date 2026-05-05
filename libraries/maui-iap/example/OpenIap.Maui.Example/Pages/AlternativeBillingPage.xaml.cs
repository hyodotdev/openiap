using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/alternative-billing.tsx — exposes
// the External Offer / User Choice Billing probes (Android) and the External
// Purchase Link / custom-link eligibility checks (iOS).
public partial class AlternativeBillingPage : ContentPage
{
    public AlternativeBillingPage()
    {
        InitializeComponent();
    }

    private void Show(string text)
    {
        ResultPanel.IsVisible = true;
        ResultLabel.Text = text;
    }

    private async void OnCheckExternalOfferClicked(object sender, EventArgs e)
    {
#if ANDROID
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var available = await mutate.CheckAlternativeBillingAvailabilityAndroidAsync();
            Show($"alternative billing available: {available}");
        }
        catch (Exception ex)
        {
            Show($"⚠ {ErrorUtils.ExtractErrorMessage(ex)}");
        }
#else
        Show("External Offer availability is Android only.");
        await Task.CompletedTask;
#endif
    }

    private async void OnCheckUserChoiceClicked(object sender, EventArgs e)
    {
#if ANDROID
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var result = await mutate.IsBillingProgramAvailableAndroidAsync(BillingProgramAndroid.UserChoiceBilling);
            Show($"User Choice Billing available: {result.IsAvailable}");
        }
        catch (Exception ex)
        {
            Show($"⚠ {ErrorUtils.ExtractErrorMessage(ex)}");
        }
#else
        Show("User Choice Billing is Android only.");
        await Task.CompletedTask;
#endif
    }

    private async void OnPresentExternalLinkClicked(object sender, EventArgs e)
    {
#if IOS || MACCATALYST
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var result = await mutate.PresentExternalPurchaseLinkIOSAsync(ExternalUrlEntry.Text ?? string.Empty);
            Show($"success: {result.Success}");
        }
        catch (Exception ex)
        {
            Show($"⚠ {ErrorUtils.ExtractErrorMessage(ex)}");
        }
#else
        Show("External Purchase Link is iOS / macCatalyst only.");
        await Task.CompletedTask;
#endif
    }

    private async void OnCheckEligibilityClicked(object sender, EventArgs e)
    {
#if IOS || MACCATALYST
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var eligible = await query.IsEligibleForExternalPurchaseCustomLinkIOSAsync();
            Show($"eligible: {eligible}");
        }
        catch (Exception ex)
        {
            Show($"⚠ {ErrorUtils.ExtractErrorMessage(ex)}");
        }
#else
        Show("Custom-link eligibility is iOS only.");
        await Task.CompletedTask;
#endif
    }
}
