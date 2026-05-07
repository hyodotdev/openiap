using OpenIap;
using OpenIap.Maui;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/index.tsx — landing menu with a
// storefront probe in the header.
public partial class HomePage : ContentPage
{
    public HomePage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        try
        {
            var query = (QueryResolver)Iap.Instance;
            var storefront = await query.GetStorefrontAsync();
            StorefrontLabel.Text = string.IsNullOrEmpty(storefront)
                ? "Best Practice Implementations"
                : $"Best Practice Implementations (Store: {storefront})";
        }
        catch
        {
            // Silently fall back on platforms without a wired binding.
            StorefrontLabel.Text = "Best Practice Implementations";
        }
    }

    private async void OnAllProductsClicked(object sender, EventArgs e)
        => await Shell.Current.GoToAsync("all-products");

    private async void OnPurchaseFlowClicked(object sender, EventArgs e)
        => await Shell.Current.GoToAsync("purchase-flow");

    private async void OnSubscriptionFlowClicked(object sender, EventArgs e)
        => await Shell.Current.GoToAsync("subscription-flow");

    private async void OnAvailablePurchasesClicked(object sender, EventArgs e)
        => await Shell.Current.GoToAsync("available-purchases");

    private async void OnOfferCodeClicked(object sender, EventArgs e)
        => await Shell.Current.GoToAsync("offer-code");

    private async void OnAlternativeBillingClicked(object sender, EventArgs e)
        => await Shell.Current.GoToAsync("alternative-billing");

    private async void OnWebhookStreamClicked(object sender, EventArgs e)
        => await Shell.Current.GoToAsync("webhook-stream");
}
