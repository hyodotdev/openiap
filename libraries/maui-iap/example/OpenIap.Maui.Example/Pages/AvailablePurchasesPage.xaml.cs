using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using OpenIap.Maui.Example.Components;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/available-purchases.tsx —
// initConnection, getAvailablePurchases (deduplicated), getActiveSubscriptions,
// and a manage-subscriptions deep link.
public partial class AvailablePurchasesPage : ContentPage
{
    private readonly List<Purchase> _purchases = new();
    private readonly List<ActiveSubscription> _active = new();

    public AvailablePurchasesPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ConnectAndRefreshAsync();
    }

    private async Task ConnectAndRefreshAsync()
    {
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.InitConnectionAsync();
            ConnectionLabel.Text = "✅ Connected";
            ConnectionLabel.TextColor = Color.FromArgb("#4CAF50");
            await RefreshAsync();
            ContentScroll.IsVisible = true;
            LoadingView.IsVisible = false;
        }
        catch (Exception ex)
        {
            LoadingView.Message = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private async Task RefreshAsync()
    {
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var purchases = await query.GetAvailablePurchasesAsync(null);
            _purchases.Clear();
            _purchases.AddRange(purchases
                .GroupBy(p => ((PurchaseCommon)p).ProductId)
                .Select(g => g.OrderByDescending(p => ((PurchaseCommon)p).TransactionDate).First()));
            RenderPurchases();

            var active = await query.GetActiveSubscriptionsAsync(Constants.SubscriptionProductIds);
            _active.Clear();
            _active.AddRange(active);
            RenderActive();
        }
        catch (Exception ex)
        {
            await DisplayAlert("Refresh Failed", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
    }

    private void RenderPurchases()
    {
        PurchasesContainer.Children.Clear();
        PurchasesCountLabel.Text = _purchases.Count > 0
            ? $"{_purchases.Count} stored purchase(s)"
            : "No saved purchases yet.";
        foreach (var p in _purchases)
        {
            var row = new PurchaseSummaryRow { Purchase = p };
            row.Tapped += (_, _) =>
            {
                PurchaseDetailsView.Purchase = p;
                DetailsOverlay.IsVisible = true;
            };
            PurchasesContainer.Children.Add(row);
        }
    }

    private void RenderActive()
    {
        ActiveContainer.Children.Clear();
        ActiveCountLabel.Text = _active.Count > 0
            ? $"{_active.Count} active subscription(s)"
            : "No active subscriptions";

        foreach (var a in _active)
        {
            var stack = new VerticalStackLayout { Spacing = 4, Padding = new Thickness(0, 6) };
            stack.Children.Add(new Label
            {
                Text = a.ProductId,
                FontAttributes = FontAttributes.Bold,
                FontSize = 14,
            });
            stack.Children.Add(new Label
            {
                Text = $"isActive: {a.IsActive}",
                FontSize = 12,
                TextColor = Color.FromArgb("#5F6470"),
            });
            ActiveContainer.Children.Add(stack);
        }
    }

    private async void OnRefreshClicked(object sender, EventArgs e)
        => await RefreshAsync();

    private async void OnDeepLinkClicked(object sender, EventArgs e)
    {
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.DeepLinkToSubscriptionsAsync(null);
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
    }

    private void OnCloseDetailsClicked(object sender, EventArgs e)
        => DetailsOverlay.IsVisible = false;
}
