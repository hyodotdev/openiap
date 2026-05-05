using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/all-products.tsx — fetches the
// combined `type: 'all'` result, renders products and subscriptions in two
// sections, and opens a details overlay with type-narrowed information.
public partial class AllProductsPage : ContentPage
{
    private readonly List<Product> _products = new();
    private readonly List<ProductSubscription> _subscriptions = new();

    public AllProductsPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await ConnectAndFetchAsync();
    }

    private async Task ConnectAndFetchAsync()
    {
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var query = (QueryResolver)Iap.Instance;

            await mutate.InitConnectionAsync();
            ConnectionLabel.Text = "✅ Connected";
            ConnectionLabel.TextColor = Color.FromArgb("#4CAF50");

            var allSkus = Constants.ProductIds.Concat(Constants.SubscriptionProductIds).ToList();
            var result = await query.FetchProductsAsync(new ProductRequest
            {
                Skus = allSkus,
                Type = ProductQueryType.All,
            });

            _products.Clear();
            _subscriptions.Clear();
            switch (result)
            {
                case FetchProductsResultProducts r when r.Value is not null:
                    _products.AddRange(r.Value);
                    break;
                case FetchProductsResultSubscriptions r when r.Value is not null:
                    _subscriptions.AddRange(r.Value);
                    break;
                case FetchProductsResultAll r when r.Value is not null:
                    foreach (var item in r.Value)
                    {
                        switch (item)
                        {
                            case Product p: _products.Add(p); break;
                            case ProductSubscription s: _subscriptions.Add(s); break;
                        }
                    }
                    break;
            }

            RenderProducts();
            RenderSubscriptions();
            ContentScroll.IsVisible = true;
            LoadingView.IsVisible = false;
        }
        catch (Exception ex)
        {
            LoadingView.Message = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private void RenderProducts()
    {
        ProductsContainer.Children.Clear();
        ProductsCountLabel.Text = _products.Count > 0
            ? $"{_products.Count} product(s) loaded"
            : "No products";
        foreach (var p in _products)
        {
            ProductsContainer.Children.Add(BuildProductCard(p, GetInAppLabel(p), GetInAppBadgeColor(p)));
        }
    }

    private void RenderSubscriptions()
    {
        SubsContainer.Children.Clear();
        SubsCountLabel.Text = _subscriptions.Count > 0
            ? $"{_subscriptions.Count} subscription(s) loaded"
            : "No subscriptions";
        foreach (var s in _subscriptions)
        {
            SubsContainer.Children.Add(BuildProductCard(s, "SUBS", Color.FromArgb("#9C27B0")));
        }
    }

    private static string GetInAppLabel(Product p)
    {
        var c = (ProductCommon)p;
        if (Constants.ConsumableProductIdSet.Contains(c.Id)) return "CONSUMABLE";
        if (Constants.NonConsumableProductIdSet.Contains(c.Id)) return "NON-CONSUMABLE";
        return "IN-APP";
    }

    private static Color GetInAppBadgeColor(Product p)
    {
        var c = (ProductCommon)p;
        if (Constants.ConsumableProductIdSet.Contains(c.Id)) return Color.FromArgb("#FF9800");
        if (Constants.NonConsumableProductIdSet.Contains(c.Id)) return Color.FromArgb("#3DDC84");
        return Color.FromArgb("#9E9E9E");
    }

    private View BuildProductCard(object item, string badgeText, Color badgeColor)
    {
        // Both Product and ProductSubscription implement ProductCommon on
        // every concrete leaf. ProductOrSubscription does too once cast to
        // its concrete leaf, so go through that interface uniformly.
        var c = (ProductCommon)item;
        var (id, title, description, displayPrice) = (c.Id, c.Title, c.Description, c.DisplayPrice);

        var titleRow = new Grid
        {
            ColumnDefinitions = new ColumnDefinitionCollection { new(GridLength.Star), new(GridLength.Auto) },
            ColumnSpacing = 8,
        };
        var titleStack = new VerticalStackLayout { Spacing = 4 };
        titleStack.Children.Add(new Label
        {
            Text = title,
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#1A1A1A"),
        });
        var badgeBorder = new Border
        {
            StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 999 },
            Padding = new Thickness(8, 2),
            BackgroundColor = badgeColor,
            HorizontalOptions = LayoutOptions.Start,
        };
        badgeBorder.Content = new Label
        {
            Text = badgeText,
            FontSize = 11,
            FontAttributes = FontAttributes.Bold,
            TextColor = Colors.White,
        };
        titleStack.Children.Add(badgeBorder);
        Grid.SetColumn(titleStack, 0);
        titleRow.Children.Add(titleStack);

        var price = new Label
        {
            Text = displayPrice,
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#007AFF"),
            VerticalTextAlignment = TextAlignment.Center,
        };
        Grid.SetColumn(price, 1);
        titleRow.Children.Add(price);

        var descLabel = new Label
        {
            Text = description,
            FontSize = 13,
            TextColor = Color.FromArgb("#5F6470"),
        };

        var detailsButton = new Button
        {
            Text = "Details",
            BackgroundColor = Color.FromArgb("#E5EAF1"),
            TextColor = Color.FromArgb("#1A1A1A"),
            CornerRadius = 8,
            HorizontalOptions = LayoutOptions.Start,
            Padding = new Thickness(14, 6),
        };
        detailsButton.Clicked += (_, _) => ShowDetails(item);

        var card = new Border
        {
            StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 12 },
            Stroke = Color.FromArgb("#E1E7EF"),
            BackgroundColor = Colors.White,
            Padding = new Thickness(16),
        };
        var cardStack = new VerticalStackLayout { Spacing = 8 };
        cardStack.Children.Add(titleRow);
        cardStack.Children.Add(descLabel);
        cardStack.Children.Add(detailsButton);
        card.Content = cardStack;
        return card;
    }

    private void ShowDetails(object item)
    {
        DetailsContent.Children.Clear();
        switch (item)
        {
            case Product p:
                var pc = (ProductCommon)p;
                AppendRow("Product ID:", pc.Id);
                AppendRow("Title:", pc.Title);
                AppendRow("Description:", pc.Description);
                AppendRow("Price:", pc.DisplayPrice);
                AppendRow("Currency:", pc.Currency ?? "N/A");
                AppendRow("Type:", pc.Type.ToJson());
                AppendRow("Platform:", pc.Platform.ToJson());
                if (p is ProductIOS pios)
                {
                    AppendRow("Is Family Shareable:", pios.IsFamilyShareableIOS ? "Yes" : "No");
                    if (pios.SubscriptionOffers is { Count: > 0 } iosOffers)
                    {
                        AppendRow($"Subscription Offers ({iosOffers.Count}):",
                            string.Join(", ", iosOffers.Select(o => o.Id)));
                    }
                }
                else if (p is ProductAndroid pand)
                {
                    AppendRow("Name (Android):", pand.NameAndroid);
                }
                break;
            case ProductSubscription s:
                var sc = (ProductCommon)s;
                AppendRow("Product ID:", sc.Id);
                AppendRow("Title:", sc.Title);
                AppendRow("Description:", sc.Description);
                AppendRow("Price:", sc.DisplayPrice);
                AppendRow("Currency:", sc.Currency ?? "N/A");
                AppendRow("Type:", sc.Type.ToJson());
                AppendRow("Platform:", sc.Platform.ToJson());
                if (s is ProductSubscriptionIOS sios && sios.SubscriptionPeriodUnitIOS is { } unit)
                {
                    AppendRow("Subscription Period (iOS):",
                        $"{sios.SubscriptionPeriodNumberIOS} {unit.ToJson()}");
                }
                if (s is ProductSubscriptionAndroid sand && sand.SubscriptionOfferDetailsAndroid is { Count: > 0 } offers)
                {
                    AppendRow($"Subscription Offers ({offers.Count}):",
                        string.Join(", ", offers.Select(o => o.BasePlanId)));
                }
                break;
        }
        DetailsOverlay.IsVisible = true;
    }

    private void AppendRow(string label, string? value)
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
    {
        DetailsOverlay.IsVisible = false;
    }
}
