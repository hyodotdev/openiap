using OpenIap;
using OpenIap.Maui;
using OpenIap.Maui.Example.Utils;
using System.Text.Json;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/all-products.tsx — fetches the
// combined `type: 'all'` result, renders products and subscriptions in two
// sections, and opens a details overlay with type-narrowed information.
public partial class AllProductsPage : ContentPage
{
    private static readonly JsonSerializerOptions PrettyJson = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
    };

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

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        await IapLifecycle.EndConnectionQuietlyAsync(nameof(AllProductsPage));
    }

    private async Task ConnectAndFetchAsync()
    {
        try
        {
            var query = (QueryResolver)Iap.Instance;

            await IapLifecycle.InitConnectionAsync();
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
                    AppendSubscriptionInfoIOS(pios.SubscriptionInfoIOS);
                    AppendSubscriptionOffers(pios.SubscriptionOffers);
                }
                else if (p is ProductAndroid pand)
                {
                    AppendRow("Name (Android):", pand.NameAndroid);
                    AppendOneTimeOffers(pand.OneTimePurchaseOfferDetailsAndroid);
                    AppendDiscountOffers(pand.DiscountOffers);
                    AppendSubscriptionOffers(pand.SubscriptionOffers);
                }
                AppendRawJson(item);
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
                if (s is ProductSubscriptionIOS sios)
                {
                    AppendRow("Is Family Shareable:", sios.IsFamilyShareableIOS ? "Yes" : "No");
                    if (sios.SubscriptionPeriodUnitIOS is { } unit)
                    {
                        AppendRow("Subscription Period (iOS):",
                            $"{sios.SubscriptionPeriodNumberIOS} {unit.ToJson()}");
                    }
                    AppendDiscountsIOS(sios.DiscountsIOS);
                    AppendSubscriptionInfoIOS(sios.SubscriptionInfoIOS);
                    AppendSubscriptionOffers(sios.SubscriptionOffers);
                }
                if (s is ProductSubscriptionAndroid sand)
                {
                    AppendRow("Name (Android):", sand.NameAndroid);
                    AppendAndroidSubscriptionOfferDetails(sand.SubscriptionOfferDetailsAndroid);
                    AppendDiscountOffers(sand.DiscountOffers);
                    AppendSubscriptionOffers(sand.SubscriptionOffers);
                }
                AppendRawJson(item);
                break;
        }
        DetailsOverlay.IsVisible = true;
    }

    private void AppendDiscountsIOS(IReadOnlyList<DiscountIOS>? discounts)
    {
        if (discounts is not { Count: > 0 }) return;
        AppendSection($"iOS Discounts ({discounts.Count})");
        foreach (var discount in discounts)
        {
            AppendOfferTitle(discount.Identifier);
            AppendOfferDetail($"Type: {discount.Type}");
            AppendOfferDetail($"Price: {discount.LocalizedPrice ?? discount.Price}");
            AppendOfferDetail($"Payment Mode: {discount.PaymentMode.ToJson()}");
            AppendOfferDetail($"Periods: {discount.NumberOfPeriods}");
        }
    }

    private void AppendSubscriptionInfoIOS(SubscriptionInfoIOS? info)
    {
        if (info is null) return;
        AppendSection("iOS Subscription Info");
        AppendOfferDetail($"Group ID: {info.SubscriptionGroupId}");
        AppendOfferDetail($"Period: {info.SubscriptionPeriod.Value} {info.SubscriptionPeriod.Unit.ToJson()}");
        if (info.IntroductoryOffer is { } intro)
        {
            AppendOfferTitle("Introductory Offer");
            AppendOfferDetail($"Price: {intro.DisplayPrice}");
            AppendOfferDetail($"Mode: {intro.PaymentMode.ToJson()}");
            AppendOfferDetail($"Periods: {intro.PeriodCount}");
        }
        if (info.PromotionalOffers is { Count: > 0 } promos)
        {
            AppendOfferTitle($"Promotional Offers ({promos.Count})");
            foreach (var promo in promos)
            {
                AppendOfferDetail($"ID: {promo.Id}");
                AppendOfferDetail($"Price: {promo.DisplayPrice}");
                AppendOfferDetail($"Mode: {promo.PaymentMode.ToJson()}");
            }
        }
    }

    private void AppendOneTimeOffers(IReadOnlyList<ProductAndroidOneTimePurchaseOfferDetail>? offers)
    {
        if (offers is not { Count: > 0 }) return;
        AppendSection($"One-Time Purchase Offers ({offers.Count})");
        foreach (var offer in offers)
        {
            AppendOfferTitle(offer.OfferId ?? offer.PurchaseOptionId ?? "Offer");
            AppendOfferDetail($"Price: {offer.FormattedPrice}");
            AppendOfferDetail($"Full Price (micros): {offer.FullPriceMicros}");
            AppendOfferDetail($"Discount: {offer.DiscountDisplayInfo?.DiscountAmount?.FormattedDiscountAmount}");
            AppendOfferDetail($"Percentage: {offer.DiscountDisplayInfo?.PercentageDiscount}");
            AppendOfferDetail($"Release: {FormatMillis(offer.PreorderDetailsAndroid?.PreorderReleaseTimeMillis)}");
            AppendOfferDetail($"Rental Period: {offer.RentalDetailsAndroid?.RentalExpirationPeriod}");
            AppendOfferDetail($"Tags: {FormatList(offer.OfferTags)}");
        }
    }

    private void AppendDiscountOffers(IReadOnlyList<DiscountOffer>? offers)
    {
        if (offers is not { Count: > 0 }) return;
        AppendSection($"Discount Offers ({offers.Count})");
        foreach (var offer in offers)
        {
            AppendOfferTitle(offer.Id ?? "Offer");
            AppendOfferDetail($"Price: {offer.DisplayPrice}");
            AppendOfferDetail($"Full Price (micros): {offer.FullPriceMicrosAndroid}");
            AppendOfferDetail($"Discount: {offer.FormattedDiscountAmountAndroid}");
            AppendOfferDetail($"Percentage: {offer.PercentageDiscountAndroid}");
            AppendOfferDetail($"Valid: {FormatMillis(offer.ValidTimeWindowAndroid?.StartTimeMillis)} - {FormatMillis(offer.ValidTimeWindowAndroid?.EndTimeMillis)}");
            AppendOfferDetail($"Remaining: {offer.LimitedQuantityInfoAndroid?.RemainingQuantity} / {offer.LimitedQuantityInfoAndroid?.MaximumQuantity}");
            AppendOfferDetail($"Release: {FormatMillis(offer.PreorderDetailsAndroid?.PreorderReleaseTimeMillis)}");
            AppendOfferDetail($"Rental Period: {offer.RentalDetailsAndroid?.RentalExpirationPeriod}");
            AppendOfferDetail($"Tags: {FormatList(offer.OfferTagsAndroid)}");
        }
    }

    private void AppendAndroidSubscriptionOfferDetails(IReadOnlyList<ProductSubscriptionAndroidOfferDetails>? offers)
    {
        if (offers is not { Count: > 0 }) return;
        AppendSection($"Android Subscription Offer Details ({offers.Count})");
        foreach (var offer in offers)
        {
            AppendOfferTitle(offer.BasePlanId + (string.IsNullOrEmpty(offer.OfferId) ? string.Empty : $" - {offer.OfferId}"));
            var offerTokenStatus = string.IsNullOrEmpty(offer.OfferToken)
                ? "missing"
                : offer.OfferToken;
            AppendOfferDetail($"Offer Token: {offerTokenStatus}");
            AppendOfferDetail($"Tags: {FormatList(offer.OfferTags)}");
            foreach (var phase in offer.PricingPhases.PricingPhaseList)
            {
                AppendOfferDetail($"Price: {phase.FormattedPrice} · Period: {phase.BillingPeriod} · Cycles: {phase.BillingCycleCount} · Recurrence: {phase.RecurrenceMode}");
            }
        }
    }

    private void AppendSubscriptionOffers(IReadOnlyList<SubscriptionOffer>? offers)
    {
        if (offers is not { Count: > 0 }) return;
        AppendSection($"Subscription Offers ({offers.Count})");
        foreach (var offer in offers)
        {
            var title = offer.BasePlanIdAndroid ?? offer.Id;
            if (!string.IsNullOrEmpty(offer.BasePlanIdAndroid) && offer.Id != offer.BasePlanIdAndroid)
            {
                title += $" - {offer.Id}";
            }
            AppendOfferTitle(title);
            AppendOfferDetail($"Price: {offer.DisplayPrice}");
            AppendOfferDetail($"Payment Mode: {offer.PaymentMode?.ToJson()}");
            if (offer.Period is not null)
            {
                AppendOfferDetail($"Period: {offer.Period.Value} {offer.Period.Unit.ToJson()}");
            }
            AppendOfferDetail($"Period Count: {offer.PeriodCount}");
            AppendOfferDetail($"Tags: {FormatList(offer.OfferTagsAndroid)}");
            foreach (var phase in offer.PricingPhasesAndroid?.PricingPhaseList ?? Array.Empty<PricingPhaseAndroid>())
            {
                AppendOfferDetail($"Price: {phase.FormattedPrice} · Period: {phase.BillingPeriod} · Cycles: {phase.BillingCycleCount} · Recurrence: {phase.RecurrenceMode}");
            }
        }
    }

    private void AppendRawJson(object item)
    {
        try
        {
            AppendSection("Raw Product JSON");
            AppendOfferDetail(SerializeProductPreview(item));
        }
        catch (Exception ex)
        {
            AppendOfferDetail($"Unable to serialize product: {ex.Message}");
        }
    }

    private static string SerializeProductPreview(object item)
    {
        return JsonSerializer.Serialize(item, item.GetType(), PrettyJson);
    }

    private void AppendSection(string title)
    {
        DetailsContent.Children.Add(new Label
        {
            Text = title,
            FontSize = 15,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#1A1A1A"),
            Margin = new Thickness(0, 18, 0, 4),
        });
    }

    private void AppendOfferTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title)) return;
        DetailsContent.Children.Add(new Label
        {
            Text = title,
            FontSize = 13,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#333333"),
            Margin = new Thickness(0, 8, 0, 0),
        });
    }

    private void AppendOfferDetail(string? detail)
    {
        if (string.IsNullOrWhiteSpace(detail)) return;
        DetailsContent.Children.Add(new Label
        {
            Text = detail,
            FontSize = 12,
            TextColor = Color.FromArgb("#555555"),
            FontFamily = detail.TrimStart().StartsWith("{", StringComparison.Ordinal) ? "Menlo" : null,
        });
    }

    private static string? FormatMillis(string? millis)
    {
        if (string.IsNullOrWhiteSpace(millis) || !long.TryParse(millis, out var value)) return null;
        try
        {
            return DateTimeOffset.FromUnixTimeMilliseconds(value).LocalDateTime.ToString("d");
        }
        catch
        {
            return null;
        }
    }

    private static string? FormatList(IReadOnlyList<string>? values) =>
        values is { Count: > 0 } ? string.Join(", ", values) : null;

    private static string TrimMiddle(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length <= 24) return value ?? string.Empty;
        return $"{value[..12]}...{value[^8..]}";
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
