using OpenIap;
using OpenIap.Maui;
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
    private bool _loading;

    public AvailablePurchasesPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ConnectAndRefreshAsync();
    }

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        await IapLifecycle.EndConnectionQuietlyAsync(nameof(AvailablePurchasesPage));
    }

    private async Task ConnectAndRefreshAsync()
    {
        try
        {
            await IapLifecycle.InitConnectionAsync();
            ConnectionLabel.Text = "✅ Connected";
            ConnectionLabel.TextColor = Color.FromArgb("#4CAF50");

            ContentScroll.IsVisible = true;
            LoadingView.IsVisible = false;

            _ = RefreshStorefrontAsync(showAlert: false);
            _ = RefreshAsync();
        }
        catch (Exception ex)
        {
            LoadingView.Message = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private async Task RefreshAsync()
    {
        if (_loading) return;
        _loading = true;
        RefreshButton.Text = "Loading...";
        RefreshButton.IsEnabled = false;

        try
        {
            var query = (QueryResolver)OpenIapClient.Instance;
            await query.FetchProductsAsync(new ProductRequest
            {
                Skus = Constants.SubscriptionProductIds,
                Type = ProductQueryType.Subs,
            }).WaitAsync(TimeSpan.FromSeconds(20));

            var purchases = await query.GetAvailablePurchasesAsync(new PurchaseOptions
            {
                OnlyIncludeActiveItemsIOS = true,
            }).WaitAsync(TimeSpan.FromSeconds(20));
            _purchases.Clear();
            _purchases.AddRange(purchases
                .GroupBy(p => ((PurchaseCommon)p).ProductId)
                .Select(g => g.OrderByDescending(p => ((PurchaseCommon)p).TransactionDate).First()));
            RenderPurchases();

            var active = await query.GetActiveSubscriptionsAsync(Constants.SubscriptionProductIds)
                .WaitAsync(TimeSpan.FromSeconds(20));
            _active.Clear();
            _active.AddRange(active);
            RenderActive();
        }
        catch (Exception ex)
        {
            await DisplayAlert("Refresh Failed", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
        finally
        {
            _loading = false;
            RefreshButton.Text = "🔄 Refresh Purchases";
            RefreshButton.IsEnabled = true;
            EmptyStatusPanel.IsVisible = _purchases.Count == 0 && _active.Count == 0;
        }
    }

    private void RenderPurchases()
    {
        PurchasesContainer.Children.Clear();
        PurchasesCountLabel.Text = _purchases.Count > 0
            ? $"{_purchases.Count} purchase(s)"
            : string.Empty;
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
            : string.Empty;

        foreach (var a in _active)
        {
            var stack = new VerticalStackLayout { Spacing = 6, Padding = new Thickness(14) };
            stack.Children.Add(new Label
            {
                Text = a.ProductId,
                FontAttributes = FontAttributes.Bold,
                FontSize = 16,
                TextColor = Color.FromArgb("#333333"),
            });
            stack.Children.Add(BuildInlineRow("Status:", a.IsActive ? "✅ Active" : "Inactive"));
            if (a.ExpirationDateIOS is not null)
            {
                stack.Children.Add(BuildInlineRow("Expires:", FormatDate(a.ExpirationDateIOS)));
            }
            if (a.EnvironmentIOS is not null)
            {
                stack.Children.Add(BuildInlineRow("Environment:", a.EnvironmentIOS));
            }
            if (a.DaysUntilExpirationIOS is not null)
            {
                stack.Children.Add(BuildInlineRow("Days Left:", $"{a.DaysUntilExpirationIOS:0} days"));
            }

            var card = new Border
            {
                StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 8 },
                Stroke = Color.FromArgb("#CDEBD4"),
                BackgroundColor = Color.FromArgb("#F8FFF9"),
                Padding = new Thickness(0),
                Content = stack,
            };
            var tap = new TapGestureRecognizer();
            tap.Tapped += (_, _) => ShowSubscriptionDetails(a);
            card.GestureRecognizers.Add(tap);
            ActiveContainer.Children.Add(card);
        }
    }

    private async void OnRefreshClicked(object sender, EventArgs e)
        => await RefreshAsync();

    private async void OnGetStorefrontClicked(object sender, EventArgs e)
        => await RefreshStorefrontAsync(showAlert: true);

    private async void OnDeepLinkClicked(object sender, EventArgs e)
    {
        try
        {
            var mutate = (MutationResolver)OpenIapClient.Instance;
            var sku = _active.FirstOrDefault()?.ProductId ?? Constants.DefaultSubscriptionProductId;
            await mutate.DeepLinkToSubscriptionsAsync(new DeepLinkOptions
            {
                SkuAndroid = sku,
                PackageNameAndroid = "dev.hyo.martie",
            });
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
    }

    private void OnCloseDetailsClicked(object sender, EventArgs e)
        => DetailsOverlay.IsVisible = false;

    private void OnCloseSubscriptionDetailsClicked(object sender, EventArgs e)
        => SubscriptionDetailsOverlay.IsVisible = false;

    private async Task RefreshStorefrontAsync(bool showAlert)
    {
        try
        {
            var query = (QueryResolver)OpenIapClient.Instance;
            var storefront = await query.GetStorefrontAsync();
            StorefrontLabel.Text = $"Storefront: {storefront ?? string.Empty}";
            StorefrontLabel.IsVisible = !string.IsNullOrEmpty(storefront);
            if (showAlert)
            {
                await DisplayAlert("Storefront", string.IsNullOrEmpty(storefront) ? "(empty)" : storefront, "OK");
            }
        }
        catch (Exception ex)
        {
            if (showAlert)
            {
                await DisplayAlert("Storefront", ErrorUtils.ExtractErrorMessage(ex), "OK");
            }
        }
    }

    private void ShowSubscriptionDetails(ActiveSubscription subscription)
    {
        SubscriptionDetailsContent.Children.Clear();
        AppendSubscriptionRow("Product ID", subscription.ProductId);
        AppendSubscriptionRow("Transaction ID", subscription.TransactionId);
        AppendSubscriptionRow("Purchase Token",
            string.IsNullOrEmpty(subscription.PurchaseToken ?? subscription.PurchaseTokenAndroid)
                ? null
                : subscription.PurchaseToken ?? subscription.PurchaseTokenAndroid);
        AppendSubscriptionRow("Active", subscription.IsActive ? "Yes" : "No");
        AppendSubscriptionRow("Date", FormatDate(subscription.TransactionDate));
        AppendSubscriptionRow("Auto Renew", FormatBool(subscription.AutoRenewingAndroid));
        AppendSubscriptionRow("Will Expire Soon", FormatBool(subscription.WillExpireSoon));
        AppendSubscriptionRow("Environment", subscription.EnvironmentIOS);
        AppendSubscriptionRow("Expires", FormatDate(subscription.ExpirationDateIOS));
        AppendSubscriptionRow("Days Left", subscription.DaysUntilExpirationIOS is null ? null : $"{subscription.DaysUntilExpirationIOS:0} days");
        AppendSubscriptionRow("Current Plan ID", subscription.CurrentPlanId);
        AppendSubscriptionRow("Base Plan ID", subscription.BasePlanIdAndroid);
        AppendSubscriptionRow("Renewal Auto Renew", subscription.RenewalInfoIOS is null ? null : FormatBool(subscription.RenewalInfoIOS.WillAutoRenew));
        AppendSubscriptionRow("Pending Upgrade", subscription.RenewalInfoIOS?.PendingUpgradeProductId);
        AppendSubscriptionRow("Renewal Date", FormatDate(subscription.RenewalInfoIOS?.RenewalDate));
        SubscriptionDetailsOverlay.IsVisible = true;
    }

    private static HorizontalStackLayout BuildInlineRow(string label, string? value)
    {
        var row = new HorizontalStackLayout { Spacing = 6 };
        row.Children.Add(new Label
        {
            Text = label,
            FontAttributes = FontAttributes.Bold,
            FontSize = 13,
            TextColor = Color.FromArgb("#4A4A4A"),
        });
        row.Children.Add(new Label
        {
            Text = value ?? "N/A",
            FontSize = 13,
            TextColor = Color.FromArgb("#5F6470"),
        });
        return row;
    }

    private void AppendSubscriptionRow(string label, string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return;
        SubscriptionDetailsContent.Children.Add(new Label
        {
            Text = label,
            FontSize = 12,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#4A4A4A"),
            Margin = new Thickness(0, 8, 0, 0),
        });
        SubscriptionDetailsContent.Children.Add(new Label
        {
            Text = value,
            FontSize = 13,
            TextColor = Color.FromArgb("#1F1F1F"),
        });
    }

    private static string? FormatBool(bool? value) =>
        value.HasValue ? (value.Value ? "Yes" : "No") : null;

    private static string? FormatDate(double? timestamp)
    {
        if (!timestamp.HasValue) return null;
        try
        {
            return DateTimeOffset.FromUnixTimeMilliseconds((long)timestamp.Value)
                .LocalDateTime.ToString("g");
        }
        catch
        {
            return null;
        }
    }
}
