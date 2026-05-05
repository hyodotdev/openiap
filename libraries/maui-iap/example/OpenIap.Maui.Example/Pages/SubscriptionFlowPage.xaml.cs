using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using OpenIap.Maui.Example.Components;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/subscription-flow.tsx — fetches
// subscription products, displays active subscriptions, and exposes the
// deepLinkToSubscriptions manage action plus a subscription details modal.
public partial class SubscriptionFlowPage : ContentPage
{
    private readonly List<ProductSubscription> _subscriptions = new();
    private readonly List<ActiveSubscription> _active = new();
    private Purchase? _lastPurchase;
    private IDisposable? _purchaseSub;
    private IDisposable? _errorSub;

    public SubscriptionFlowPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        _purchaseSub ??= Iap.Instance.PurchaseUpdated.Subscribe(p => MainThread.BeginInvokeOnMainThread(() => OnPurchase(p)));
        _errorSub ??= Iap.Instance.PurchaseError.Subscribe(err => MainThread.BeginInvokeOnMainThread(() => OnPurchaseError(err)));
        await ConnectAndFetchAsync();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        _purchaseSub?.Dispose();
        _errorSub?.Dispose();
        _purchaseSub = _errorSub = null;
    }

    private async Task ConnectAndFetchAsync()
    {
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.InitConnectionAsync();
            ConnectionLabel.Text = "✅ Connected";
            ConnectionLabel.TextColor = Color.FromArgb("#4CAF50");

            var result = await query.FetchProductsAsync(new ProductRequest
            {
                Skus = Constants.SubscriptionProductIds,
                Type = ProductQueryType.Subs,
            });
            _subscriptions.Clear();
            if (result is FetchProductsResultSubscriptions r && r.Value is not null)
            {
                _subscriptions.AddRange(r.Value);
            }
            await RefreshActiveAsync();

            RenderSubscriptions();
            ContentScroll.IsVisible = true;
            LoadingView.IsVisible = false;
        }
        catch (Exception ex)
        {
            LoadingView.Message = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private async Task RefreshActiveAsync()
    {
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var active = await query.GetActiveSubscriptionsAsync(Constants.SubscriptionProductIds);
            _active.Clear();
            _active.AddRange(active);
            RenderActive();
        }
        catch (Exception ex)
        {
            ActiveCountLabel.Text = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private void RenderSubscriptions()
    {
        SubsContainer.Children.Clear();
        SubsCountLabel.Text = _subscriptions.Count > 0
            ? $"{_subscriptions.Count} subscription(s) loaded"
            : "Loading subscriptions...";
        foreach (var s in _subscriptions)
        {
            SubsContainer.Children.Add(BuildSubscriptionCard(s));
        }
    }

    private View BuildSubscriptionCard(ProductSubscription sub)
    {
        var common = (ProductCommon)sub;
        var titleRow = new Grid
        {
            ColumnDefinitions = new ColumnDefinitionCollection { new(GridLength.Star), new(GridLength.Auto) },
            ColumnSpacing = 8,
        };
        var titleLabel = new Label
        {
            Text = common.Title,
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#1A1A1A"),
        };
        Grid.SetColumn(titleLabel, 0);
        titleRow.Children.Add(titleLabel);

        var priceLabel = new Label
        {
            Text = common.DisplayPrice,
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#28A745"),
        };
        Grid.SetColumn(priceLabel, 1);
        titleRow.Children.Add(priceLabel);

        var description = new Label
        {
            Text = common.Description,
            FontSize = 13,
            TextColor = Color.FromArgb("#5F6470"),
        };

        var actionsRow = new HorizontalStackLayout { Spacing = 8 };
        var subscribeButton = new Button
        {
            Text = "Subscribe",
            BackgroundColor = Color.FromArgb("#28A745"),
            TextColor = Colors.White,
            CornerRadius = 8,
            Padding = new Thickness(16, 8),
        };
        subscribeButton.Clicked += async (_, _) => await HandleSubscribeAsync(sub);
        var detailsButton = new Button
        {
            Text = "Details",
            BackgroundColor = Color.FromArgb("#E5EAF1"),
            TextColor = Color.FromArgb("#1A1A1A"),
            CornerRadius = 8,
            Padding = new Thickness(14, 8),
        };
        detailsButton.Clicked += (_, _) => ShowDetails(sub);
        actionsRow.Children.Add(subscribeButton);
        actionsRow.Children.Add(detailsButton);

        var card = new Border
        {
            StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 12 },
            Stroke = Color.FromArgb("#E1E7EF"),
            BackgroundColor = Colors.White,
            Padding = new Thickness(16),
        };
        var stack = new VerticalStackLayout { Spacing = 8 };
        stack.Children.Add(titleRow);
        stack.Children.Add(description);
        stack.Children.Add(actionsRow);
        card.Content = stack;
        return card;
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
                Text = $"isActive: {a.IsActive}, autoRenewing (Android): {a.AutoRenewingAndroid?.ToString() ?? "n/a"}",
                FontSize = 12,
                TextColor = Color.FromArgb("#5F6470"),
            });
            ActiveContainer.Children.Add(stack);
        }
    }

    private async Task HandleSubscribeAsync(ProductSubscription sub)
    {
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.RequestPurchaseAsync(new RequestPurchaseProps
            {
                RequestSubscription = new RequestSubscriptionPropsByPlatforms
                {
                    Apple = new RequestSubscriptionIosProps { Sku = ((ProductCommon)sub).Id },
                    Google = new RequestSubscriptionAndroidProps
                    {
                        Skus = new[] { ((ProductCommon)sub).Id },
                    },
                },
                Type = ProductQueryType.Subs,
            });
            UpdateResult($"Requested subscription {((ProductCommon)sub).Id}.");
        }
        catch (Exception ex)
        {
            UpdateResult($"Subscription failed: {ErrorUtils.ExtractErrorMessage(ex)}");
        }
    }

    private async void OnPurchase(Purchase purchase)
    {
        var common = (PurchaseCommon)purchase;
        _lastPurchase = purchase;
        UpdateResult($"Subscription completed (state: {common.PurchaseState.ToJson()}).");
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.FinishTransactionAsync(
                purchase: new PurchaseInput(purchase),
                isConsumable: false);
        }
        catch
        {
            // Surfaced on next refresh.
        }
        await RefreshActiveAsync();
    }

    private void OnPurchaseError(PurchaseError error)
    {
        UpdateResult($"Subscription failed: {error.Message}");
    }

    private void UpdateResult(string text)
    {
        ResultPanel.IsVisible = true;
        ResultLabel.Text = text;
        if (_lastPurchase is not null)
        {
            LatestPurchaseHeader.IsVisible = true;
            LatestPurchaseRow.IsVisible = true;
            LatestPurchaseRow.Purchase = _lastPurchase;
        }
    }

    private async void OnRefreshActiveClicked(object sender, EventArgs e)
        => await RefreshActiveAsync();

    private async void OnManageClicked(object sender, EventArgs e)
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

    private void ShowDetails(ProductSubscription sub)
    {
        DetailsContent.Children.Clear();
        var c = (ProductCommon)sub;
        AppendDetail("Product ID:", c.Id);
        AppendDetail("Title:", c.Title);
        AppendDetail("Description:", c.Description);
        AppendDetail("Price:", c.DisplayPrice);
        AppendDetail("Currency:", c.Currency ?? "N/A");
        AppendDetail("Type:", c.Type.ToJson());
        AppendDetail("Platform:", c.Platform.ToJson());
        if (sub is ProductSubscriptionIOS sios)
        {
            if (sios.SubscriptionPeriodUnitIOS is { } unit)
            {
                AppendDetail("Subscription Period (iOS):",
                    $"{sios.SubscriptionPeriodNumberIOS} {unit.ToJson()}");
            }
            if (sios.DiscountsIOS is { Count: > 0 } d)
            {
                AppendDetail($"iOS Discounts ({d.Count}):",
                    string.Join(", ", d.Select(x => x.Identifier)));
            }
        }
        else if (sub is ProductSubscriptionAndroid sand && sand.SubscriptionOfferDetailsAndroid is { Count: > 0 } offers)
        {
            AppendDetail($"Subscription Offers ({offers.Count}):",
                string.Join(", ", offers.Select(o => o.BasePlanId)));
        }
        DetailsOverlay.IsVisible = true;
    }

    private void AppendDetail(string label, string? value)
    {
        DetailsContent.Children.Add(new Label
        {
            Text = label,
            FontSize = 12,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#4A4A4A"),
            Margin = new Thickness(0, 8, 0, 0),
        });
        DetailsContent.Children.Add(new Label
        {
            Text = string.IsNullOrEmpty(value) ? "N/A" : value,
            FontSize = 13,
            TextColor = Color.FromArgb("#1F1F1F"),
        });
    }

    private void OnCloseDetailsClicked(object sender, EventArgs e)
        => DetailsOverlay.IsVisible = false;
}
