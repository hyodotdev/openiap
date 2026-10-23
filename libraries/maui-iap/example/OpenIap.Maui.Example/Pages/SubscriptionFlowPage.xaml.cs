using OpenIap;
using OpenIap.Maui;
using OpenIap.Maui.Example.Components;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/subscription-flow.tsx on the app's purchase flow.
public partial class SubscriptionFlowPage : ContentPage
{
    private sealed record UpgradeInfo(
        bool CanUpgrade,
        bool IsDowngrade,
        string? CurrentTier,
        string? Message = null,
        bool IsPending = false);

    private static readonly Dictionary<string, int> TierMap = new(StringComparer.Ordinal)
    {
        ["dev.hyo.martie.premium"] = 1,
        ["dev.hyo.martie.premium_year"] = 2,
    };

    private readonly List<ProductSubscription> _subscriptions = new();
    private readonly List<ActiveSubscription> _active = new();
    private Purchase? _lastPurchase;
    private string? _purchaseResult;
    private bool _isProcessing;
    private bool _isCheckingStatus;
    private bool _didFetch;
    private int _tapCount;

    public SubscriptionFlowPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        VerificationButton.Text = IapLifecycle.Label(IapLifecycle.Verification);
        IapLifecycle.Flow.OutcomePublished += OnOutcome;
        await ConnectAndFetchAsync();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        IapLifecycle.Flow.OutcomePublished -= OnOutcome;
    }

    private async Task ConnectAndFetchAsync()
    {
        try
        {
            await OpenIapClient.Mutation.InitConnectionAsync();
            ConnectionLabel.Text = "✅ Connected";
            ConnectionLabel.TextColor = Color.FromArgb("#4CAF50");

            ContentScroll.IsVisible = true;
            LoadingView.IsVisible = false;

            if (!_didFetch)
            {
                _didFetch = true;
                SubsCountLabel.Text = "Loading subscriptions...";
                RenderActive();
                _ = FetchSubscriptionsAsync();
                _ = RefreshActiveAsync(showAlert: false, renderSubscriptionCards: false);
            }
            await RecoverPurchasesAsync();
        }
        catch (Exception ex)
        {
            LoadingView.Message = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private async Task FetchSubscriptionsAsync()
    {
        try
        {
            var result = await OpenIapClient.Query.FetchProductsAsync(new ProductRequest
            {
                Skus = Constants.SubscriptionProductIds,
                Type = ProductQueryType.Subs,
            }).WaitAsync(TimeSpan.FromSeconds(20));

            _subscriptions.Clear();
            if (result is FetchProductsResultSubscriptions r && r.Value is not null)
            {
                _subscriptions.AddRange(r.Value);
            }

            RenderSubscriptions();
        }
        catch (Exception ex)
        {
            SubsCountLabel.Text = $"Failed to load subscriptions: {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private async Task RefreshActiveAsync(bool showAlert = true, bool renderSubscriptionCards = true)
    {
        if (_isCheckingStatus) return;

        _isCheckingStatus = true;
        RefreshActiveButton.IsEnabled = false;
        RefreshActiveButton.Text = "Refreshing status...";
        try
        {
            var active = await OpenIapClient.Query.GetActiveSubscriptionsAsync(IapKitSettings.SubscriptionQueryIds)
                .WaitAsync(TimeSpan.FromSeconds(20));
            _active.Clear();
            _active.AddRange(active.Select(subscription =>
                (Subscription: subscription, ProductId: IapKitSettings.SubscriptionProductId(subscription.ProductId, subscription.CurrentPlanId)))
                .Where(item => item.ProductId is not null)
                .Select(item => item.Subscription with { ProductId = item.ProductId! }));
            RenderActive();
            if (renderSubscriptionCards)
            {
                RenderSubscriptions();
            }
        }
        catch (Exception ex)
        {
            ActiveCountLabel.Text = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
            if (showAlert)
            {
                await DisplayAlertAsync("Refresh Failed", ErrorUtils.ExtractErrorMessage(ex), "OK");
            }
        }
        finally
        {
            _isCheckingStatus = false;
            RefreshActiveButton.IsEnabled = true;
            RefreshActiveButton.Text = "Refresh active subscriptions";
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
        var isSubscribed = IsSubscribed(sub.Id);
        var isPending = IsPendingUpgrade(sub.Id);
        var upgradeInfo = GetUpgradeInfo(sub.Id);
        var isCancelled = IsCancelled(sub.Id);

        var titleRow = new Grid
        {
            ColumnDefinitions = new ColumnDefinitionCollection { new(GridLength.Star), new(GridLength.Auto) },
            ColumnSpacing = 8,
        };
        var titleLabel = new Label
        {
            Text = sub.Title,
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#1A1A1A"),
        };
        Grid.SetColumn(titleLabel, 0);
        titleRow.Children.Add(titleLabel);

        var priceLabel = new Label
        {
            Text = GetSubscriptionDisplayPrice(sub),
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#28A745"),
        };
        Grid.SetColumn(priceLabel, 1);
        titleRow.Children.Add(priceLabel);

        var description = new Label
        {
            Text = sub.Description,
            FontSize = 13,
            TextColor = Color.FromArgb("#5F6470"),
        };

        var period = new Label
        {
            Text = $"per {GetSubscriptionPeriod(sub)}",
            FontSize = 12,
            TextColor = Color.FromArgb("#5F6470"),
        };

        var stack = new VerticalStackLayout { Spacing = 8 };
        stack.Children.Add(titleRow);
        stack.Children.Add(description);
        stack.Children.Add(period);

        var intro = GetIntroductoryOffer(sub);
        if (!string.IsNullOrEmpty(intro))
        {
            stack.Children.Add(BuildBadge(intro, "#E8F7EF", "#208A45"));
        }

        if (!string.IsNullOrEmpty(upgradeInfo.Message))
        {
            stack.Children.Add(BuildBadge(upgradeInfo.Message, "#EAF2FF", "#1769AA"));
        }

        if (isCancelled)
        {
            stack.Children.Add(BuildBadge("⚠ Cancelled (active until expiry)", "#FFF3E0", "#BF5B00"));
        }

        var actionsRow = new HorizontalStackLayout { Spacing = 8 };
        var subscribeButton = new Button
        {
            Text = GetSubscriptionButtonText(_isProcessing, isSubscribed, isCancelled, isPending, upgradeInfo),
            BackgroundColor = GetSubscriptionButtonColor(isSubscribed, isCancelled, isPending, upgradeInfo),
            TextColor = IsPassiveButton(isSubscribed, isPending) ? Color.FromArgb("#1A1A1A") : Colors.White,
            CornerRadius = 8,
            Padding = new Thickness(16, 8),
            IsEnabled = !_isProcessing && !isPending && !(isSubscribed && !isCancelled),
        };
        subscribeButton.Pressed += (_, _) => SetActionStatus($"Subscribe press received: {sub.Id}");
        subscribeButton.Clicked += (_, _) =>
        {
            _tapCount += 1;
            SetActionStatus($"Subscribe tap #{_tapCount}: {sub.Id}");
            _ = HandleSubscriptionTapAsync(sub);
        };

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
        stack.Children.Add(actionsRow);

        if (GetDisabledReason(isSubscribed, isCancelled, isPending) is { } disabledReason)
        {
            stack.Children.Add(new Label
            {
                Text = disabledReason,
                FontSize = 11,
                TextColor = Color.FromArgb("#5F6470"),
            });
        }

        return new Border
        {
            StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 12 },
            Stroke = Color.FromArgb("#E1E7EF"),
            BackgroundColor = Colors.White,
            Padding = new Thickness(16),
            Content = stack,
        };
    }

    private static View BuildBadge(string text, string background, string foreground)
        => new Border
        {
            StrokeThickness = 0,
            StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 6 },
            BackgroundColor = Color.FromArgb(background),
            Padding = new Thickness(8, 4),
            HorizontalOptions = LayoutOptions.Start,
            Content = new Label
            {
                Text = text,
                FontSize = 11,
                FontAttributes = FontAttributes.Bold,
                TextColor = Color.FromArgb(foreground),
            },
        };

    private void RenderActive()
    {
        ActiveContainer.Children.Clear();
        var active = _active.Where(a => a.IsActive).ToList();
        ActiveCountLabel.Text = active.Count > 0
            ? $"{active.Count} active subscription(s)"
            : "No active subscriptions";

        if (active.Count == 0)
        {
            ActiveContainer.Children.Add(new Label
            {
                Text = "Tap Check Status after signing in with a store test account.",
                FontSize = 13,
                TextColor = Color.FromArgb("#5F6470"),
                Padding = new Thickness(0, 8),
            });
            return;
        }

        foreach (var a in active)
        {
            var card = new Border
            {
                StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 12 },
                Stroke = Color.FromArgb("#E1E7EF"),
                BackgroundColor = Color.FromArgb("#F7F9FC"),
                Padding = new Thickness(14),
            };
            var stack = new VerticalStackLayout { Spacing = 6 };
            AddStatusRow(stack, "Status:", "✅ Active", "#208A45");
            AddStatusRow(stack, "Product:", GetSubscriptionTitle(a.ProductId));

            if (a.ExpirationDateIOS is { } expiration)
            {
                AddStatusRow(stack, "Expires:", FormatDate(expiration));
            }

            if (a.RenewalInfoIOS is { } renewal)
            {
                AddStatusRow(stack, "Auto-Renew:", renewal.WillAutoRenew ? "✅ Enabled" : "⚠ Cancelled",
                    renewal.WillAutoRenew ? "#208A45" : "#BF5B00");

                var nextProduct = renewal.PendingUpgradeProductId ?? renewal.AutoRenewPreference;
                if (!string.IsNullOrEmpty(nextProduct) && nextProduct != a.ProductId)
                {
                    AddStatusRow(stack, "Next Renewal:", GetSubscriptionTitle(nextProduct), "#1769AA");
                }
            }
            else if (a.AutoRenewingAndroid is { } autoRenewing)
            {
                AddStatusRow(stack, "Auto-Renew:", autoRenewing ? "✅ Enabled" : "⚠ Cancelled",
                    autoRenewing ? "#208A45" : "#BF5B00");
            }

            if (!string.IsNullOrEmpty(a.EnvironmentIOS))
            {
                AddStatusRow(stack, "Environment:", a.EnvironmentIOS);
            }

            if (a.DaysUntilExpirationIOS is >= 0 and <= 7)
            {
                stack.Children.Add(new Label
                {
                    Text = a.DaysUntilExpirationIOS is { } days
                        ? $"⚠ Subscription expires soon ({days:0} days remaining)."
                        : "⚠ Subscription expires soon.",
                    FontSize = 12,
                    TextColor = Color.FromArgb("#BF5B00"),
                });
            }

            card.Content = stack;
            ActiveContainer.Children.Add(card);
        }
    }

    private static void AddStatusRow(VerticalStackLayout stack, string label, string value, string? color = null)
    {
        var row = new Grid
        {
            ColumnDefinitions = new ColumnDefinitionCollection
            {
                new(GridLength.Auto),
                new(GridLength.Star),
            },
            ColumnSpacing = 8,
        };
        row.Children.Add(new Label
        {
            Text = label,
            FontSize = 12,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#1A1A1A"),
        });
        var valueLabel = new Label
        {
            Text = value,
            FontSize = 12,
            TextColor = color is null ? Color.FromArgb("#5F6470") : Color.FromArgb(color),
            LineBreakMode = LineBreakMode.WordWrap,
        };
        Grid.SetColumn(valueLabel, 1);
        row.Children.Add(valueLabel);
        stack.Children.Add(row);
    }

    private async Task HandleSubscriptionTapAsync(ProductSubscription sub)
    {
        try
        {
            await HandleSubscriptionAsync(sub);
        }
        catch (Exception ex)
        {
            _isProcessing = false;
            UpdateResult($"Subscription tap failed: {ErrorUtils.ExtractErrorMessage(ex)}");
            RenderSubscriptions();
        }
    }

    private async Task HandleSubscriptionAsync(ProductSubscription sub)
    {
        SetActionStatus($"Handling subscription: {sub.Id}");

        var upgradeInfo = GetUpgradeInfo(sub.Id);
        var currentSubscription = GetCurrentSubscription();
        var isSubscribed = IsSubscribed(sub.Id);
        var isCancelled = IsCancelled(sub.Id);

        if (isSubscribed && isCancelled)
        {
            var reactivate = await DisplayAlertAsync(
                "Reactivate Subscription",
                "This subscription is cancelled but still active until expiry. Do you want to reactivate it?",
                "Reactivate",
                "Cancel");
            if (reactivate) await StartSubscriptionRequestAsync(sub);
            else SetActionStatus($"Reactivate cancelled: {sub.Id}");
            return;
        }

        if (isSubscribed && !isCancelled)
        {
            UpdateResult("You already have an active subscription to this product.");
            return;
        }

        if (upgradeInfo.IsPending)
        {
            await DisplayAlertAsync("Upgrade Scheduled",
                upgradeInfo.Message ?? "This subscription upgrade is already scheduled.",
                "OK");
            return;
        }

        if (upgradeInfo.CanUpgrade || upgradeInfo.IsDowngrade)
        {
            var title = upgradeInfo.CanUpgrade ? "Upgrade Subscription" : "Downgrade Subscription";
            var action = upgradeInfo.CanUpgrade ? "Upgrade Now" : "Downgrade";
            var currentTitle = currentSubscription is null ? "current plan" : GetSubscriptionTitle(currentSubscription.ProductId);
            var targetTitle = sub.Title;
            var detail = upgradeInfo.CanUpgrade
                ? "Takes effect immediately. Pro-rated refund may apply."
                : "Usually takes effect at the next renewal date.";
            var proceed = await DisplayAlertAsync(title,
                $"{title.Replace(" Subscription", string.Empty)} from {currentTitle} to {targetTitle}?\n\n{detail}",
                action,
                "Cancel");
            if (proceed) await StartSubscriptionRequestAsync(sub);
            else SetActionStatus($"{title} cancelled: {sub.Id}");
            return;
        }

        await StartSubscriptionRequestAsync(sub);
    }

    private async Task StartSubscriptionRequestAsync(ProductSubscription sub)
    {
        if (_isProcessing)
        {
            UpdateResult($"Subscription request already in progress for {sub.Id}.");
            return;
        }

        _isProcessing = true;
        UpdateResult($"Processing subscription: {sub.Id}");
        RenderSubscriptions();
        try
        {
            SetActionStatus($"Dispatching StoreKit request: {sub.Id}");
            var playPlan = await CurrentPlayPlanAsync(sub);
            // The flow confirms the delivered purchase and reports it to OnOutcome.
            var result = await OpenIapClient.Mutation.RequestPurchaseAsync(new RequestPurchaseProps
            {
                RequestSubscription = new RequestSubscriptionPropsByPlatforms
                {
                    Apple = new RequestSubscriptionIosProps { Sku = sub.Id },
                    Google = new RequestSubscriptionAndroidProps
                    {
                        Skus = new[] { sub.Id },
                        SubscriptionOffers = BuildAndroidSubscriptionOffers(sub),
                        // Without the current plan's token, Play sells a second subscription instead of changing plans.
                        PurchaseToken = playPlan?.PurchaseToken,
                        SubscriptionProductReplacementParams = playPlan is null ? null : new SubscriptionProductReplacementParamsAndroid
                        {
                            OldProductId = playPlan.ProductId,
                            ReplacementMode = GetUpgradeInfo(sub.Id).IsDowngrade
                                ? SubscriptionReplacementModeAndroid.Deferred
                                : SubscriptionReplacementModeAndroid.WithTimeProration,
                        },
                    },
                },
                Type = ProductQueryType.Subs,
            });
            if (result is null) UpdateResult("Subscription request completed without a purchase result.");
        }
        catch (Exception ex)
        {
            UpdateResult(ErrorUtils.FormatPurchaseFailure(ex, "Subscription"));
        }
        finally
        {
            _isProcessing = false;
            RenderSubscriptions();
        }
    }

    // The Play purchase a plan change replaces. Amazon rejects replacement params, and iOS changes plans within the group.
    private async Task<Purchase?> CurrentPlayPlanAsync(ProductSubscription target)
    {
        var current = GetCurrentSubscription();
        if (!IsAndroidPlatform || current is null || current.ProductId == target.Id) return null;
        var purchases = await OpenIapClient.Query.GetAvailablePurchasesAsync();
        return purchases.FirstOrDefault(purchase =>
            purchase.Store == IapStore.Google &&
            purchase.ProductId == current.ProductId &&
            !string.IsNullOrEmpty(purchase.PurchaseToken));
    }

    private async Task RecoverPurchasesAsync()
    {
        try
        {
            await IapLifecycle.Flow.RecoverPurchasesAsync();
        }
        catch (Exception error)
        {
            UpdateResult($"Purchase recovery failed; receipts retained: {error.Message}");
        }
    }

    private async void OnOutcome(object? sender, PurchaseFlowOutcome outcome)
    {
        if (IapKitSettings.SubscriptionProductId(outcome.Purchase) is null) return;
        _lastPurchase = outcome.Purchase;
        UpdateResult(IapLifecycle.Describe(outcome, "Subscription"));
        RenderSubscriptions();
        if (outcome.Status is PurchaseFlowStatus.Entitled) await RefreshActiveAsync(showAlert: false);
    }

    private void SetActionStatus(string text)
    {
        Console.WriteLine($"[SubscriptionFlow] {text}");
        TapStatusPanel.IsVisible = true;
        TapStatusLabel.Text = text;
    }

    private void UpdateResult(string text)
    {
        _purchaseResult = text;
        SetActionStatus(text);
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
            if (IsApplePlatform)
            {
                try
                {
                    await OpenIapClient.Mutation.ShowManageSubscriptionsIOSAsync();
                    await RefreshActiveAsync();
                    return;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SubscriptionFlow] showManageSubscriptionsIOS failed, falling back: {ex.Message}");
                }
            }

            var sku = _subscriptions.FirstOrDefault()?.Id ?? Constants.DefaultSubscriptionProductId;
            await OpenIapClient.Mutation.DeepLinkToSubscriptionsAsync(IsAndroidPlatform
                ? new DeepLinkOptions { SkuAndroid = sku, PackageNameAndroid = "dev.hyo.martie" }
                : null);
        }
        catch (Exception ex)
        {
            await DisplayAlertAsync("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
    }

    private async void OnChangeVerificationClicked(object sender, EventArgs e)
    {
        if (!await IapLifecycle.ChooseVerificationAsync(this)) return;
        VerificationButton.Text = IapLifecycle.Label(IapLifecycle.Verification);
        if (IapLifecycle.Verification != VerificationMethod.Ignore) await RecoverPurchasesAsync();
    }

    private async void OnCopyResultClicked(object sender, EventArgs e)
    {
        if (string.IsNullOrEmpty(_purchaseResult)) return;
        await Clipboard.SetTextAsync(_purchaseResult);
        await DisplayAlertAsync("Copied", "Subscription message copied to clipboard", "OK");
    }

    private void ShowDetails(ProductSubscription sub)
    {
        DetailsContent.Children.Clear();
        AppendDetail("Product ID:", sub.Id);
        AppendDetail("Title:", sub.Title);
        AppendDetail("Description:", sub.Description);
        AppendDetail("Price:", GetSubscriptionDisplayPrice(sub));
        AppendDetail("Period:", GetSubscriptionPeriod(sub));
        AppendDetail("Currency:", sub.Currency);
        AppendDetail("Type:", sub.Type.ToJson());
        AppendDetail("Platform:", sub.Platform.ToJson());

        if (sub is ProductSubscriptionIOS sios)
        {
            AppendDetail("Subscription Group (iOS):", sios.SubscriptionGroupIdIOS);

            if (sios.SubscriptionOffers is { Count: > 0 } offers)
            {
                AppendDetail($"Subscription Offers ({offers.Count}):",
                    string.Join(", ", offers.Select(DescribeOffer)));
            }
        }
        else if (sub is ProductSubscriptionAndroid sand)
        {
            if (sand.SubscriptionOffers is { Count: > 0 } offers)
            {
                AppendDetail($"Subscription Offers ({offers.Count}):",
                    string.Join(", ", offers.Select(DescribeOffer)));
            }
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

    private ActiveSubscription? GetCurrentSubscription()
    {
        var active = _active.Where(s => s.IsActive).ToList();
        if (active.Count == 0) return null;

        return active.Aggregate((best, cur) =>
        {
            var bestTier = GetSubscriptionTier(best.ProductId);
            var curTier = GetSubscriptionTier(cur.ProductId);
            if (curTier > bestTier) return cur;
            if (curTier == bestTier && (cur.ExpirationDateIOS ?? 0) > (best.ExpirationDateIOS ?? 0)) return cur;
            return best;
        });
    }

    private bool IsCancelled(string productId)
    {
        if (!IsApplePlatform) return false;
        var sub = _active.FirstOrDefault(a => a.ProductId == productId);
        return sub is { IsActive: true, RenewalInfoIOS.WillAutoRenew: false };
    }

    private bool IsSubscribed(string productId)
        => _active.Any(a => a.IsActive && a.ProductId == productId);

    private bool IsPendingUpgrade(string productId)
    {
        if (!IsApplePlatform) return false;
        return _active.Any(sub =>
            sub.RenewalInfoIOS?.PendingUpgradeProductId == productId &&
            sub.ProductId != productId);
    }

    private UpgradeInfo GetUpgradeInfo(string targetProductId)
    {
        var current = GetCurrentSubscription();
        if (current is null) return new UpgradeInfo(false, false, null);

        var isCurrentCancelled = IsCancelled(current.ProductId);
        if (current.ProductId == targetProductId)
        {
            return new UpgradeInfo(false, false, current.ProductId);
        }

        if (!isCurrentCancelled &&
            current.RenewalInfoIOS?.PendingUpgradeProductId == targetProductId)
        {
            return new UpgradeInfo(
                false,
                false,
                current.ProductId,
                "This upgrade will activate on your next renewal date",
                true);
        }

        if (isCurrentCancelled)
        {
            return new UpgradeInfo(
                false,
                false,
                current.ProductId,
                "Reactivate current subscription or wait until it expires");
        }

        var currentTier = GetSubscriptionTier(current.ProductId);
        var targetTier = GetSubscriptionTier(targetProductId);
        var canUpgrade = targetTier > currentTier;
        var isDowngrade = targetTier < currentTier;

        return new UpgradeInfo(
            canUpgrade,
            isDowngrade,
            current.ProductId,
            canUpgrade ? "Upgrade available" : isDowngrade ? "Downgrade option" : null);
    }

    private string GetSubscriptionTitle(string? productId)
    {
        if (string.IsNullOrEmpty(productId)) return "Unknown";
        return _subscriptions.FirstOrDefault(s => s.Id == productId)?.Title ?? productId;
    }

    private static int GetSubscriptionTier(string productId)
        => TierMap.GetValueOrDefault(productId, 0);

    private static IReadOnlyList<AndroidSubscriptionOfferInput>? BuildAndroidSubscriptionOffers(ProductSubscription sub)
    {
        if (sub is not ProductSubscriptionAndroid android) return null;

        var offers = android.SubscriptionOffers
            .Where(o => !string.IsNullOrEmpty(o.OfferTokenAndroid))
            .Select(o => new AndroidSubscriptionOfferInput
            {
                Sku = android.Id,
                OfferToken = o.OfferTokenAndroid!,
            })
            .ToList();

        return offers.Count > 0 ? offers : null;
    }

    private static string GetSubscriptionDisplayPrice(ProductSubscription sub)
    {
        var offers = GetSubscriptionOffers(sub);
        var first = offers.FirstOrDefault();
        if (first is not null)
        {
            if (!string.IsNullOrEmpty(first.DisplayPrice)) return first.DisplayPrice;
            var phase = first.PricingPhasesAndroid?.PricingPhaseList.FirstOrDefault();
            if (!string.IsNullOrEmpty(phase?.FormattedPrice)) return phase.FormattedPrice;
        }
        return sub.DisplayPrice;
    }

    private static string GetSubscriptionPeriod(ProductSubscription sub)
    {
        var first = GetSubscriptionOffers(sub).FirstOrDefault();
        if (first?.Period is { } period)
        {
            return $"{period.Value} {period.Unit.ToJson()}";
        }

        var phase = first?.PricingPhasesAndroid?.PricingPhaseList.FirstOrDefault();
        if (!string.IsNullOrEmpty(phase?.BillingPeriod)) return phase.BillingPeriod;

        if (sub is ProductSubscriptionIOS ios)
        {
            if (ios.SubscriptionPeriodUnitIOS is { } unit)
            {
                return $"{ios.SubscriptionPeriodNumberIOS ?? "1"} {unit.ToJson()}";
            }
        }

        return "Unknown";
    }

    private static string? GetIntroductoryOffer(ProductSubscription sub)
    {
        if (sub is not ProductSubscriptionIOS ios) return null;
        var offer = ios.SubscriptionOffers?
            .FirstOrDefault(candidate => candidate.Type == DiscountOfferType.Introductory);
        if (offer?.Period is not { } period || offer.PaymentMode is not { } paymentMode)
            return null;

        var unit = period.Unit.ToJson().ToLowerInvariant();
        return paymentMode switch
        {
            PaymentMode.FreeTrial => $"{offer.PeriodCount} {unit}(s) free trial",
            PaymentMode.PayAsYouGo => $"{offer.DisplayPrice} for {offer.PeriodCount} {unit}(s)",
            PaymentMode.PayUpFront => $"{offer.DisplayPrice} for first {offer.PeriodCount} {unit}(s)",
            _ => null,
        };
    }

    private static IReadOnlyList<SubscriptionOffer> GetSubscriptionOffers(ProductSubscription sub)
        => sub switch
        {
            ProductSubscriptionAndroid android => android.SubscriptionOffers,
            ProductSubscriptionIOS ios => ios.SubscriptionOffers ?? Array.Empty<SubscriptionOffer>(),
            _ => Array.Empty<SubscriptionOffer>(),
        };

    private static string DescribeOffer(SubscriptionOffer offer)
    {
        var name = offer.BasePlanIdAndroid ?? offer.Id;
        var token = string.IsNullOrEmpty(offer.OfferTokenAndroid)
            ? null
            : " token=present";
        return $"{name}: {offer.DisplayPrice}{token}";
    }

    private static string GetSubscriptionButtonText(
        bool isProcessing,
        bool isSubscribed,
        bool isCancelled,
        bool isPending,
        UpgradeInfo info)
    {
        if (isProcessing) return "Processing...";
        if (isPending) return "⏳ Scheduled";
        if (isSubscribed && !isCancelled) return "✅ Subscribed";
        if (isSubscribed && isCancelled) return "🔄 Reactivate";
        if (info.CanUpgrade) return "⬆ Upgrade";
        if (info.IsDowngrade) return "⬇ Downgrade";
        return "Subscribe";
    }

    private Color GetSubscriptionButtonColor(bool isSubscribed, bool isCancelled, bool isPending, UpgradeInfo info)
    {
        if (_isProcessing) return Color.FromArgb("#007AFF");
        if (isPending || (isSubscribed && !isCancelled)) return Color.FromArgb("#E5EAF1");
        if (isSubscribed && isCancelled) return Color.FromArgb("#FF9800");
        if (info.CanUpgrade) return Color.FromArgb("#007AFF");
        if (info.IsDowngrade) return Color.FromArgb("#6C757D");
        return Color.FromArgb("#28A745");
    }

    private bool IsPassiveButton(bool isSubscribed, bool isPending)
        => !_isProcessing && (isSubscribed || isPending);

    private string? GetDisabledReason(bool isSubscribed, bool isCancelled, bool isPending)
    {
        if (_isProcessing) return "Purchase request is in progress.";
        if (isPending) return "Subscription change is already scheduled.";
        if (isSubscribed && !isCancelled) return "Already subscribed to this product.";
        return null;
    }

    private static string FormatDate(double milliseconds)
        => DateTimeOffset.FromUnixTimeMilliseconds((long)milliseconds).LocalDateTime.ToString("d");

    private static bool IsApplePlatform
    {
        get
        {
#if IOS || MACCATALYST
            return true;
#else
            return false;
#endif
        }
    }

    private static bool IsAndroidPlatform
    {
        get
        {
#if ANDROID
            return true;
#else
            return false;
#endif
        }
    }
}
