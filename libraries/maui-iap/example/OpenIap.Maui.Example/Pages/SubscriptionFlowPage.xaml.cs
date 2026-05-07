using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using OpenIap.Maui.Example.Components;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/subscription-flow.tsx — fetches
// subscription products, passes Android subscription offer tokens, tracks
// active subscription state, and exposes verification / management actions.
public partial class SubscriptionFlowPage : ContentPage
{
    private enum VerificationMethod { Ignore, Local, Iapkit }

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
    private VerificationMethod _verification = VerificationMethod.Ignore;
    private Purchase? _lastPurchase;
    private string? _purchaseResult;
    private bool _isProcessing;
    private bool _isCheckingStatus;
    private bool _isHandlingPurchase;
    private bool _didFetch;
    private int _tapCount;
    private readonly HashSet<string> _handledPurchaseIds = new(StringComparer.Ordinal);
    private CancellationTokenSource? _purchaseTimeoutCts;
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

    protected override async void OnDisappearing()
    {
        base.OnDisappearing();
        _purchaseTimeoutCts?.Cancel();
        _purchaseTimeoutCts?.Dispose();
        _purchaseTimeoutCts = null;
        _purchaseSub?.Dispose();
        _errorSub?.Dispose();
        _purchaseSub = _errorSub = null;
        await IapLifecycle.EndConnectionQuietlyAsync(nameof(SubscriptionFlowPage));
    }

    private async Task ConnectAndFetchAsync()
    {
        try
        {
            await IapLifecycle.InitConnectionAsync();
            ConnectionLabel.Text = "✅ Connected";
            ConnectionLabel.TextColor = Color.FromArgb("#4CAF50");

            ContentScroll.IsVisible = true;
            LoadingView.IsVisible = false;

            if (_didFetch) return;
            _didFetch = true;

            SubsCountLabel.Text = "Loading subscriptions...";
            RenderActive();

            _ = FetchSubscriptionsAsync();
            _ = RefreshActiveAsync(showAlert: false, renderSubscriptionCards: false);
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
            var query = (QueryResolver)Iap.Instance;
            var result = await query.FetchProductsAsync(new ProductRequest
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
            var query = (QueryResolver)Iap.Instance;
            var active = await query.GetActiveSubscriptionsAsync(Constants.SubscriptionProductIds)
                .WaitAsync(TimeSpan.FromSeconds(20));
            _active.Clear();
            _active.AddRange(active);
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
                await DisplayAlert("Refresh Failed", ErrorUtils.ExtractErrorMessage(ex), "OK");
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
        var common = (ProductCommon)sub;
        var isSubscribed = IsSubscribed(common.Id);
        var isPending = IsPendingUpgrade(common.Id);
        var upgradeInfo = GetUpgradeInfo(common.Id);
        var isCancelled = IsCancelled(common.Id);

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
            Text = GetSubscriptionDisplayPrice(sub),
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
        subscribeButton.Pressed += (_, _) => SetActionStatus($"Subscribe press received: {common.Id}");
        subscribeButton.Clicked += (_, _) =>
        {
            _tapCount += 1;
            SetActionStatus($"Subscribe tap #{_tapCount}: {common.Id}");
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

            if (a.WillExpireSoon == true)
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
            _isHandlingPurchase = false;
            UpdateResult($"Subscription tap failed: {ErrorUtils.ExtractErrorMessage(ex)}");
            RenderSubscriptions();
        }
    }

    private async Task HandleSubscriptionAsync(ProductSubscription sub)
    {
        var common = (ProductCommon)sub;
        SetActionStatus($"Handling subscription: {common.Id}");

        var upgradeInfo = GetUpgradeInfo(common.Id);
        var currentSubscription = GetCurrentSubscription();
        var isSubscribed = IsSubscribed(common.Id);
        var isCancelled = IsCancelled(common.Id);

        if (isSubscribed && isCancelled)
        {
            var reactivate = await DisplayAlert(
                "Reactivate Subscription",
                "This subscription is cancelled but still active until expiry. Do you want to reactivate it?",
                "Reactivate",
                "Cancel");
            if (reactivate) await StartSubscriptionRequestAsync(sub);
            else SetActionStatus($"Reactivate cancelled: {common.Id}");
            return;
        }

        if (isSubscribed && !isCancelled)
        {
            UpdateResult("You already have an active subscription to this product.");
            return;
        }

        if (upgradeInfo.IsPending)
        {
            await DisplayAlert("Upgrade Scheduled",
                upgradeInfo.Message ?? "This subscription upgrade is already scheduled.",
                "OK");
            return;
        }

        if (upgradeInfo.CanUpgrade || upgradeInfo.IsDowngrade)
        {
            var title = upgradeInfo.CanUpgrade ? "Upgrade Subscription" : "Downgrade Subscription";
            var action = upgradeInfo.CanUpgrade ? "Upgrade Now" : "Downgrade";
            var currentTitle = currentSubscription is null ? "current plan" : GetSubscriptionTitle(currentSubscription.ProductId);
            var targetTitle = common.Title;
            var detail = upgradeInfo.CanUpgrade
                ? "Takes effect immediately. Pro-rated refund may apply."
                : "Usually takes effect at the next renewal date.";
            var proceed = await DisplayAlert(title,
                $"{title.Replace(" Subscription", string.Empty)} from {currentTitle} to {targetTitle}?\n\n{detail}",
                action,
                "Cancel");
            if (proceed) await StartSubscriptionRequestAsync(sub);
            else SetActionStatus($"{title} cancelled: {common.Id}");
            return;
        }

        await StartSubscriptionRequestAsync(sub);
    }

    private async Task StartSubscriptionRequestAsync(ProductSubscription sub)
    {
        var common = (ProductCommon)sub;
        if (_isProcessing)
        {
            UpdateResult($"Subscription request already in progress for {common.Id}.");
            return;
        }

        _isProcessing = true;
        UpdateResult($"Processing subscription: {common.Id}");
        RenderSubscriptions();

        _purchaseTimeoutCts?.Cancel();
        _purchaseTimeoutCts?.Dispose();
        _purchaseTimeoutCts = new CancellationTokenSource();
        _ = ReportIfStillWaitingAsync(common.Id, _purchaseTimeoutCts.Token);
        _ = SubmitSubscriptionRequestAsync(sub, _purchaseTimeoutCts.Token);
        await Task.CompletedTask;
    }

    private async Task SubmitSubscriptionRequestAsync(ProductSubscription sub, CancellationToken cancellationToken)
    {
        var common = (ProductCommon)sub;
        try
        {
            SetActionStatus($"Dispatching StoreKit request: {common.Id}");
            var mutate = (MutationResolver)Iap.Instance;
            var requestTask = mutate.RequestPurchaseAsync(new RequestPurchaseProps
            {
                RequestSubscription = new RequestSubscriptionPropsByPlatforms
                {
                    Apple = new RequestSubscriptionIosProps { Sku = common.Id },
                    Google = new RequestSubscriptionAndroidProps
                    {
                        Skus = new[] { common.Id },
                        SubscriptionOffers = BuildAndroidSubscriptionOffers(sub),
                    },
                },
                Type = ProductQueryType.Subs,
            });

            _ = ObserveSubscriptionRequestAsync(requestTask, cancellationToken);
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                _isProcessing = false;
                UpdateResult($"Subscription failed: {ErrorUtils.ExtractErrorMessage(ex)}");
                RenderSubscriptions();
            });
        }
    }

    private async Task ObserveSubscriptionRequestAsync(
        Task<RequestPurchaseResult?> requestTask,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await requestTask;
            if (cancellationToken.IsCancellationRequested) return;
            if (result is RequestPurchaseResultPurchase { Value: { } purchase })
            {
                MainThread.BeginInvokeOnMainThread(() =>
                {
                    if (_isProcessing)
                    {
                        OnPurchase(purchase);
                    }
                });
            }
            else
            {
                MainThread.BeginInvokeOnMainThread(() =>
                {
                    if (!_isProcessing) return;
                    _isProcessing = false;
                    UpdateResult("Subscription request completed without a purchase result.");
                    RenderSubscriptions();
                });
            }
        }
        catch (OperationCanceledException)
        {
            // Navigation away or purchase completed through the event listener.
        }
        catch (Exception ex)
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                if (!_isProcessing) return;
                _isProcessing = false;
                UpdateResult($"Subscription failed: {ErrorUtils.ExtractErrorMessage(ex)}");
                RenderSubscriptions();
            });
        }
    }

    private async Task ReportIfStillWaitingAsync(string productId, CancellationToken cancellationToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
            if (cancellationToken.IsCancellationRequested) return;

            MainThread.BeginInvokeOnMainThread(() =>
            {
                if (!_isProcessing) return;
                UpdateResult($"Still waiting for App Store purchase sheet/result: {productId}");
            });
        }
        catch (OperationCanceledException)
        {
        }
    }

    private void CancelPurchaseWatchdog()
    {
        _purchaseTimeoutCts?.Cancel();
        _purchaseTimeoutCts?.Dispose();
        _purchaseTimeoutCts = null;
    }

    private async void OnPurchase(Purchase purchase)
    {
        var common = (PurchaseCommon)purchase;
        _lastPurchase = purchase;
        var purchaseId = common.Id;

        if (!string.IsNullOrEmpty(purchaseId) && !_handledPurchaseIds.Add(purchaseId))
        {
            CancelPurchaseWatchdog();
            _isProcessing = false;
            UpdateResult($"Subscription callback already handled: {common.ProductId ?? purchaseId}");
            RenderSubscriptions();
            return;
        }

        CancelPurchaseWatchdog();

        if (_isHandlingPurchase)
        {
            _isProcessing = false;
            RenderSubscriptions();
            return;
        }

        _isHandlingPurchase = true;
        _isProcessing = false;

        if (common.PurchaseState != PurchaseState.Purchased)
        {
            UpdateResult($"Subscription callback received but state is {common.PurchaseState.ToJson()}.");
            _isHandlingPurchase = false;
            RenderSubscriptions();
            return;
        }

        var isRestoration = IsRestoration(purchase);
        UpdateResult(isRestoration
            ? "Subscription restored successfully."
            : "Subscription activated successfully.");
        RenderSubscriptions();

        if (!isRestoration)
        {
            await VerifySubscriptionIfNeededAsync(purchase);
        }

        _ = FinishSubscriptionTransactionAsync(purchase);
        _ = RefreshActiveAsync(showAlert: false);
        _isHandlingPurchase = false;
        _isProcessing = false;
        RenderSubscriptions();

        if (!isRestoration)
        {
            await DisplayAlert("Success", "New subscription activated successfully!", "OK");
        }
    }

    private static async Task FinishSubscriptionTransactionAsync(Purchase purchase)
    {
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.FinishTransactionAsync(
                purchase: new PurchaseInput(purchase),
                isConsumable: false).WaitAsync(TimeSpan.FromSeconds(10));
        }
        catch (TimeoutException)
        {
            Console.WriteLine("[SubscriptionFlow] finishTransaction timed out; continuing UI flow");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[SubscriptionFlow] finishTransaction failed: {ex.Message}");
        }
    }

    private async Task VerifySubscriptionIfNeededAsync(Purchase purchase)
    {
        if (_verification == VerificationMethod.Ignore) return;

        var common = (PurchaseCommon)purchase;
        if (string.IsNullOrEmpty(common.ProductId)) return;

        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            if (_verification == VerificationMethod.Local)
            {
                var result = await mutate.VerifyPurchaseAsync(new VerifyPurchaseProps
                {
                    Apple = new VerifyPurchaseAppleOptions { Sku = common.ProductId },
                    Google = new VerifyPurchaseGoogleOptions
                    {
                        Sku = common.ProductId,
                        PackageName = "dev.hyo.martie",
                        PurchaseToken = common.PurchaseToken ?? string.Empty,
                        AccessToken = string.Empty,
                        IsSub = true,
                    },
                });
                Console.WriteLine($"[SubscriptionFlow] local verify: {result}");
            }
            else if (_verification == VerificationMethod.Iapkit)
            {
                var token = common.PurchaseToken ?? string.Empty;
                if (string.IsNullOrEmpty(token))
                {
                    await DisplayAlert("Verification Failed", "No purchase token available for IAPKit verification", "OK");
                    return;
                }

                var result = await mutate.VerifyPurchaseWithProviderAsync(new VerifyPurchaseWithProviderProps
                {
                    Provider = PurchaseVerificationProvider.Iapkit,
                    Iapkit = IapKitSettings.CreateVerifyProps(token),
                });

                if (result.Iapkit is { } ik)
                {
                    var status = ik.IsValid ? "✅" : "⚠";
                    await DisplayAlert(
                        $"{status} IAPKit Verification",
                        $"Valid: {ik.IsValid}\nState: {ik.State.ToJson()}\nStore: {ik.Store.ToJson()}",
                        "OK");
                }
            }
        }
        catch (Exception ex)
        {
            await DisplayAlert("Verification Failed",
                $"Purchase verification failed: {ErrorUtils.ExtractErrorMessage(ex)}",
                "OK");
        }
    }

    private void OnPurchaseError(PurchaseError error)
    {
        CancelPurchaseWatchdog();
        _isProcessing = false;
        _isHandlingPurchase = false;
        UpdateResult($"Subscription failed: {error.Message}");
        RenderSubscriptions();
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
            var mutate = (MutationResolver)Iap.Instance;
            if (IsApplePlatform)
            {
                try
                {
                    await mutate.ShowManageSubscriptionsIOSAsync();
                    await RefreshActiveAsync();
                    return;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SubscriptionFlow] showManageSubscriptionsIOS failed, falling back: {ex.Message}");
                }
            }

            var sku = _subscriptions.FirstOrDefault() is ProductCommon c
                ? c.Id
                : Constants.DefaultSubscriptionProductId;
            await mutate.DeepLinkToSubscriptionsAsync(IsAndroidPlatform
                ? new DeepLinkOptions { SkuAndroid = sku, PackageNameAndroid = "dev.hyo.martie" }
                : null);
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
    }

    private async void OnChangeVerificationClicked(object sender, EventArgs e)
    {
        var choice = await DisplayActionSheet(
            "Select Purchase Verification Method",
            "Cancel",
            null,
            "Ignore Verification",
            "Local Verification",
            "IAPKit Verification");

        _verification = choice switch
        {
            "Local Verification" => VerificationMethod.Local,
            "IAPKit Verification" => VerificationMethod.Iapkit,
            _ when choice != "Cancel" => VerificationMethod.Ignore,
            _ => _verification,
        };

        VerificationButton.Text = _verification switch
        {
            VerificationMethod.Local => "📱 Local (Device)",
            VerificationMethod.Iapkit => "☁️ IAPKit (Server)",
            _ => "❌ None (Skip)",
        };
    }

    private async void OnCopyResultClicked(object sender, EventArgs e)
    {
        if (string.IsNullOrEmpty(_purchaseResult)) return;
        await Clipboard.SetTextAsync(_purchaseResult);
        await DisplayAlert("Copied", "Subscription message copied to clipboard", "OK");
    }

    private void ShowDetails(ProductSubscription sub)
    {
        DetailsContent.Children.Clear();
        var c = (ProductCommon)sub;
        AppendDetail("Product ID:", c.Id);
        AppendDetail("Title:", c.Title);
        AppendDetail("Description:", c.Description);
        AppendDetail("Price:", GetSubscriptionDisplayPrice(sub));
        AppendDetail("Period:", GetSubscriptionPeriod(sub));
        AppendDetail("Currency:", c.Currency);
        AppendDetail("Type:", c.Type.ToJson());
        AppendDetail("Platform:", c.Platform.ToJson());

        if (sub is ProductSubscriptionIOS sios)
        {
            if (sios.SubscriptionInfoIOS?.IntroductoryOffer is { } intro)
            {
                AppendDetail("Introductory Offer:",
                    $"{intro.DisplayPrice} / {intro.Period.Value} {intro.Period.Unit.ToJson()} ({intro.PaymentMode.ToJson()})");
            }

            if (sios.SubscriptionInfoIOS?.PromotionalOffers is { Count: > 0 } promos)
            {
                AppendDetail($"Promotional Offers ({promos.Count}):",
                    string.Join(", ", promos.Select(x => x.Id)));
            }

            if (sios.DiscountsIOS is { Count: > 0 } discounts)
            {
                AppendDetail($"iOS Discounts ({discounts.Count}):",
                    string.Join(", ", discounts.Select(x => x.Identifier)));
            }

            if (sios.SubscriptionOffers is { Count: > 0 } offers)
            {
                AppendDetail($"Subscription Offers ({offers.Count}):",
                    string.Join(", ", offers.Select(DescribeOffer)));
            }
        }
        else if (sub is ProductSubscriptionAndroid sand)
        {
            if (sand.SubscriptionOfferDetailsAndroid is { Count: > 0 } details)
            {
                AppendDetail($"Android Offer Tokens ({details.Count}):",
                    string.Join(", ", details.Select(o => $"{o.BasePlanId}: {Mask(o.OfferToken)}")));
            }

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
        var sub = _subscriptions.FirstOrDefault(s => ((ProductCommon)s).Id == productId);
        return sub is ProductCommon c ? c.Title : productId;
    }

    private static int GetSubscriptionTier(string productId)
        => TierMap.GetValueOrDefault(productId, 0);

    private static IReadOnlyList<AndroidSubscriptionOfferInput>? BuildAndroidSubscriptionOffers(ProductSubscription sub)
    {
        if (sub is not ProductSubscriptionAndroid android) return null;

        var offers = android.SubscriptionOfferDetailsAndroid
            .Where(o => !string.IsNullOrEmpty(o.OfferToken))
            .Select(o => new AndroidSubscriptionOfferInput
            {
                Sku = android.Id,
                OfferToken = o.OfferToken,
            })
            .ToList();

        if (offers.Count > 0) return offers;

        offers = android.SubscriptionOffers
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
        var common = (ProductCommon)sub;
        var offers = GetSubscriptionOffers(sub);
        var first = offers.FirstOrDefault();
        if (first is not null)
        {
            if (!string.IsNullOrEmpty(first.DisplayPrice)) return first.DisplayPrice;
            var phase = first.PricingPhasesAndroid?.PricingPhaseList.FirstOrDefault();
            if (!string.IsNullOrEmpty(phase?.FormattedPrice)) return phase.FormattedPrice;
        }
        return common.DisplayPrice;
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
            if (ios.SubscriptionInfoIOS?.SubscriptionPeriod is { } p)
            {
                return $"{p.Value} {p.Unit.ToJson()}";
            }

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
        var offer = ios.SubscriptionInfoIOS?.IntroductoryOffer;
        if (offer is null) return null;

        var unit = offer.Period.Unit.ToJson().ToLowerInvariant();
        return offer.PaymentMode switch
        {
            PaymentModeIOS.FreeTrial => $"{offer.PeriodCount} {unit}(s) free trial",
            PaymentModeIOS.PayAsYouGo => $"{offer.DisplayPrice} for {offer.PeriodCount} {unit}(s)",
            PaymentModeIOS.PayUpFront => $"{offer.DisplayPrice} for first {offer.PeriodCount} {unit}(s)",
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
            : $" token={Mask(offer.OfferTokenAndroid)}";
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

    private static bool IsRestoration(Purchase purchase)
    {
        if (purchase is not PurchaseIOS ios) return false;
        return !string.IsNullOrEmpty(ios.OriginalTransactionIdentifierIOS)
            && ios.OriginalTransactionIdentifierIOS != ios.Id
            && !string.IsNullOrEmpty(ios.TransactionReasonIOS)
            && !string.Equals(ios.TransactionReasonIOS, "PURCHASE", StringComparison.OrdinalIgnoreCase);
    }

    private static string FormatDate(double milliseconds)
        => DateTimeOffset.FromUnixTimeMilliseconds((long)milliseconds).LocalDateTime.ToString("d");

    private static string Mask(string value)
        => value.Length <= 12 ? value : $"{value[..6]}…{value[^4..]}";

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
