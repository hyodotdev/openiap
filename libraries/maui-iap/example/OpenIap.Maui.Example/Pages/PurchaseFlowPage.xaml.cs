using Hyo.OpenIap;
using Hyo.OpenIap.Maui;
using OpenIap.Maui.Example.Components;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/purchase-flow.tsx — full purchase
// flow demo including verification picker, storefront probe, products list,
// available-purchases list, latest-result panel, and the iOS-only
// App Transaction probe.
public partial class PurchaseFlowPage : ContentPage
{
    private enum VerificationMethod { Ignore, Local, Iapkit }

    private readonly List<Product> _products = new();
    private readonly List<Purchase> _availablePurchases = new();
    private VerificationMethod _verification = VerificationMethod.Ignore;
    private string? _purchaseResult;
    private Purchase? _lastPurchase;
    private bool _isProcessing;
    private IDisposable? _purchaseSub;
    private IDisposable? _errorSub;
    private bool _refreshingPurchases;
    private bool _storefrontLoading;
    private bool _didFetch;

    public PurchaseFlowPage()
    {
        InitializeComponent();
#if IOS || MACCATALYST
        AppTransactionButton.IsVisible = true;
#endif
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
        _purchaseSub?.Dispose();
        _errorSub?.Dispose();
        _purchaseSub = _errorSub = null;
        await IapLifecycle.EndConnectionQuietlyAsync(nameof(PurchaseFlowPage));
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

            ProductsCountLabel.Text = "Loading products...";
            RenderPurchases();

            _ = RefreshStorefrontAsync(showAlert: false);
            _ = LoadProductsAsync();
            _ = RefreshAvailablePurchasesAsync(showAlert: false);
        }
        catch (Exception ex)
        {
            LoadingView.Message = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private async Task LoadProductsAsync()
    {
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var result = await query.FetchProductsAsync(new ProductRequest
            {
                Skus = Constants.ProductIds,
                Type = ProductQueryType.InApp,
            }).WaitAsync(TimeSpan.FromSeconds(20));
            _products.Clear();
            if (result is FetchProductsResultProducts r && r.Value is not null)
            {
                _products.AddRange(r.Value);
            }

            RenderProducts();
        }
        catch (Exception ex)
        {
            ProductsCountLabel.Text = $"Failed to load products: {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private async Task RefreshStorefrontAsync(bool showAlert = true)
    {
        if (_storefrontLoading) return;
        _storefrontLoading = true;
        StorefrontRefreshButton.IsEnabled = false;
        StorefrontRefreshButton.Text = "Refreshing storefront...";
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var storefront = await query.GetStorefrontAsync().WaitAsync(TimeSpan.FromSeconds(10));
            StorefrontValueLabel.Text = string.IsNullOrEmpty(storefront) ? "Not available" : storefront;
            StorefrontErrorLabel.IsVisible = false;
        }
        catch (Exception ex)
        {
            StorefrontValueLabel.Text = "Unavailable";
            StorefrontErrorLabel.Text = ErrorUtils.ExtractErrorMessage(ex);
            StorefrontErrorLabel.IsVisible = true;
            if (showAlert)
            {
                await DisplayAlert("Storefront", ErrorUtils.ExtractErrorMessage(ex), "OK");
            }
        }
        finally
        {
            _storefrontLoading = false;
            StorefrontRefreshButton.IsEnabled = true;
            StorefrontRefreshButton.Text = "Refresh storefront";
        }
    }

    private async Task RefreshAvailablePurchasesAsync(bool showAlert = true)
    {
        if (_refreshingPurchases) return;
        _refreshingPurchases = true;
        RefreshPurchasesButton.IsEnabled = false;
        RefreshPurchasesButton.Text = "Refreshing purchases...";
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var purchases = await query.GetAvailablePurchasesAsync(new PurchaseOptions
            {
                OnlyIncludeActiveItemsIOS = true,
            }).WaitAsync(TimeSpan.FromSeconds(20));
            _availablePurchases.Clear();
            // Deduplicate by productId, keeping the most recent transaction.
            var deduped = purchases
                .GroupBy(p => ((PurchaseCommon)p).ProductId)
                .Select(g => g.OrderByDescending(p => ((PurchaseCommon)p).TransactionDate).First());
            _availablePurchases.AddRange(deduped);
            RenderPurchases();
            RenderProducts();
        }
        catch (Exception ex)
        {
            PurchasesCountLabel.Text = "Could not refresh purchases";
            if (showAlert)
            {
                await DisplayAlert("Refresh Failed", ErrorUtils.ExtractErrorMessage(ex), "OK");
            }
        }
        finally
        {
            _refreshingPurchases = false;
            RefreshPurchasesButton.IsEnabled = true;
            RefreshPurchasesButton.Text = "Refresh available purchases";
        }
    }

    private void RenderProducts()
    {
        ProductsContainer.Children.Clear();

        // Hide non-consumables that are already in the available-purchases list,
        // matching the visibleProducts logic in the expo example.
        var owned = _availablePurchases
            .Select(p => ((PurchaseCommon)p).ProductId)
            .Where(Constants.NonConsumableProductIdSet.Contains)
            .ToHashSet();
        var visible = _products.Where(p =>
        {
            var id = ((ProductCommon)p).Id;
            return !(Constants.NonConsumableProductIdSet.Contains(id) && owned.Contains(id));
        }).ToList();

        ProductsCountLabel.Text = visible.Count > 0
            ? $"{visible.Count} product(s) available"
            : (_products.Count > visible.Count
                ? "All non-consumable products already purchased"
                : "Loading products...");

        foreach (var product in visible)
        {
            ProductsContainer.Children.Add(BuildProductCard(product));
        }
    }

    private View BuildProductCard(Product product)
    {
        var common = (ProductCommon)product;
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
            TextColor = Color.FromArgb("#007AFF"),
        };
        Grid.SetColumn(priceLabel, 1);
        titleRow.Children.Add(priceLabel);

        var description = new Label
        {
            Text = common.Description,
            FontSize = 13,
            TextColor = Color.FromArgb("#5F6470"),
        };

        var badgeText = Constants.ConsumableProductIdSet.Contains(common.Id) ? "Consumable product"
            : Constants.NonConsumableProductIdSet.Contains(common.Id) ? "Non-consumable product"
            : "In-app product";
        var badge = new Label
        {
            Text = badgeText,
            FontSize = 11,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#1A1A1A"),
        };

        var actionsRow = new HorizontalStackLayout { Spacing = 8 };
        var purchaseButton = new Button
        {
            Text = _isProcessing ? "Processing..." : "Purchase",
            BackgroundColor = Color.FromArgb("#007AFF"),
            TextColor = Colors.White,
            CornerRadius = 8,
            Padding = new Thickness(16, 8),
            IsEnabled = !_isProcessing,
        };
        purchaseButton.Clicked += async (_, _) => await HandlePurchaseAsync(common.Id);
        var detailsButton = new Button
        {
            Text = "Details",
            BackgroundColor = Color.FromArgb("#E5EAF1"),
            TextColor = Color.FromArgb("#1A1A1A"),
            CornerRadius = 8,
            Padding = new Thickness(14, 8),
        };
        detailsButton.Clicked += (_, _) => ShowProductDetails(product);
        actionsRow.Children.Add(purchaseButton);
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
        stack.Children.Add(badge);
        stack.Children.Add(actionsRow);
        card.Content = stack;
        return card;
    }

    private void RenderPurchases()
    {
        PurchasesContainer.Children.Clear();
        PurchasesCountLabel.Text = _availablePurchases.Count > 0
            ? $"{_availablePurchases.Count} stored purchase(s)"
            : "Purchase a non-consumable to view it here";

        foreach (var purchase in _availablePurchases)
        {
            var row = new PurchaseSummaryRow { Purchase = purchase };
            row.Tapped += (_, _) => ShowPurchaseDetails(purchase);
            PurchasesContainer.Children.Add(row);
        }

        if (_availablePurchases.Count == 0)
        {
            PurchasesContainer.Children.Add(new Label
            {
                Text = "No saved purchases yet. Complete a non-consumable purchase to see it listed here.",
                FontSize = 13,
                TextColor = Color.FromArgb("#5F6470"),
                Padding = new Thickness(0, 12),
            });
        }
    }

    private async Task HandlePurchaseAsync(string sku)
    {
        if (_isProcessing) return;

        _isProcessing = true;
        UpdateResult("Processing purchase...");
        RenderProducts();
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var requestTask = mutate.RequestPurchaseAsync(new RequestPurchaseProps
            {
                RequestPurchase = new RequestPurchasePropsByPlatforms
                {
                    Apple = new RequestPurchaseIosProps { Sku = sku, Quantity = 1 },
                    Google = new RequestPurchaseAndroidProps { Skus = new[] { sku } },
                },
                Type = ProductQueryType.InApp,
            });
            _ = ObservePurchaseRequestAsync(requestTask);
            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _isProcessing = false;
            UpdateResult($"Purchase failed: {ErrorUtils.ExtractErrorMessage(ex)}");
            RenderProducts();
        }
    }

    private async Task ObservePurchaseRequestAsync(Task<RequestPurchaseResult?> requestTask)
    {
        try
        {
            var result = await requestTask;
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
                    UpdateResult("Purchase request completed without a purchase result.");
                    RenderProducts();
                });
            }
        }
        catch (Exception ex)
        {
            MainThread.BeginInvokeOnMainThread(() =>
            {
                if (!_isProcessing) return;
                _isProcessing = false;
                UpdateResult($"Purchase failed: {ErrorUtils.ExtractErrorMessage(ex)}");
                RenderProducts();
            });
        }
    }

    // Called on the main thread; subscribes already marshal to UI.
    private async void OnPurchase(Purchase purchase)
    {
        var common = (PurchaseCommon)purchase;
        _lastPurchase = purchase;
        _isProcessing = false;
        UpdateResult($"Purchase completed successfully (state: {common.PurchaseState.ToJson()}).");
        RenderProducts();

        // Step 4: verify purchase (3 methods).
        if (_verification != VerificationMethod.Ignore && !string.IsNullOrEmpty(common.ProductId))
        {
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
                        },
                    });
                    Console.WriteLine($"[PurchaseFlow] local verify: {result}");
                }
                else if (_verification == VerificationMethod.Iapkit)
                {
                    var token = common.PurchaseToken ?? string.Empty;
                    if (string.IsNullOrEmpty(token))
                    {
                        await DisplayAlert("Verification Failed", "No purchase token available for IAPKit verification", "OK");
                    }
                    else
                    {
                        var result = await mutate.VerifyPurchaseWithProviderAsync(new VerifyPurchaseWithProviderProps
                        {
                            Provider = PurchaseVerificationProvider.Iapkit,
                            Iapkit = new RequestVerifyPurchaseWithIapkitProps
                            {
                                Apple = new RequestVerifyPurchaseWithIapkitAppleProps { Jws = token },
                                Google = new RequestVerifyPurchaseWithIapkitGoogleProps { PurchaseToken = token },
                            },
                        });
                        if (result.Iapkit is { } ik)
                        {
                            var emoji = ik.IsValid ? "✅" : "⚠️";
                            await DisplayAlert(
                                $"{emoji} IAPKit Verification",
                                $"Valid: {ik.IsValid}\nState: {ik.State.ToJson()}\nStore: {ik.Store.ToJson()}",
                                "OK");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                await DisplayAlert("Verification Failed",
                    $"Purchase verification failed: {ErrorUtils.ExtractErrorMessage(ex)}", "OK");
            }
        }

        var consumable = Constants.ConsumableProductIdSet.Contains(common.ProductId);
        _ = FinishPurchaseTransactionAsync(purchase, consumable);

        // Step 5: refresh available purchases to update the UI without blocking
        // the success path on slow StoreKit Transaction.all enumeration.
        _ = RefreshAvailablePurchasesAsync(showAlert: false);
        RenderProducts();
        await DisplayAlert("Success", "Purchase completed successfully!", "OK");
    }

    private static async Task FinishPurchaseTransactionAsync(Purchase purchase, bool isConsumable)
    {
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.FinishTransactionAsync(
                purchase: new PurchaseInput(purchase),
                isConsumable: isConsumable).WaitAsync(TimeSpan.FromSeconds(10));
        }
        catch (TimeoutException)
        {
            Console.WriteLine("[PurchaseFlow] finishTransaction timed out; continuing UI flow");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[PurchaseFlow] finishTransaction failed: {ex.Message}");
        }
    }

    private void OnPurchaseError(PurchaseError error)
    {
        _isProcessing = false;
        UpdateResult($"Purchase failed: {error.Message}");
        RenderProducts();
    }

    private void UpdateResult(string text)
    {
        _purchaseResult = text;
        ResultLabel.Text = text;
        ResultPanel.IsVisible = true;
        if (_lastPurchase is not null)
        {
            LatestPurchaseHeader.IsVisible = true;
            LatestPurchaseRow.IsVisible = true;
            LatestPurchaseRow.Purchase = _lastPurchase;
        }
    }

    private async void OnRefreshStorefrontClicked(object sender, EventArgs e)
        => await RefreshStorefrontAsync();

    private async void OnRefreshPurchasesClicked(object sender, EventArgs e)
    {
        await RefreshAvailablePurchasesAsync();
        RenderProducts();
    }

    private void OnChangeVerificationClicked(object sender, EventArgs e)
    {
        _verification = _verification switch
        {
            VerificationMethod.Ignore => VerificationMethod.Local,
            VerificationMethod.Local => VerificationMethod.Iapkit,
            _ => VerificationMethod.Ignore,
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
        await DisplayAlert("Copied", "Purchase result copied to clipboard", "OK");
    }

    private async void OnCheckAppTransactionClicked(object sender, EventArgs e)
    {
#if IOS || MACCATALYST
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var t = await query.GetAppTransactionIOSAsync();
            if (t is null)
            {
                await DisplayAlert("App Transaction", "No app transaction found", "OK");
                return;
            }
            await DisplayAlert(
                "App Transaction",
                $"Original App Version: {t.OriginalAppVersion}\n" +
                $"Purchase Date: {DateTimeOffset.FromUnixTimeMilliseconds((long)t.OriginalPurchaseDate).UtcDateTime:d}\n" +
                $"Device Verification: {t.DeviceVerification}\n" +
                $"Environment: {t.Environment}",
                "OK");
        }
        catch (Exception ex)
        {
            await DisplayAlert("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
#else
        await DisplayAlert("App Transaction", "App Transaction is iOS / macCatalyst only.", "OK");
#endif
    }

    private void ShowProductDetails(Product product)
    {
        ProductDetailsContent.Children.Clear();
        var c = (ProductCommon)product;
        AppendDetail("Product ID:", c.Id);
        AppendDetail("Title:", c.Title);
        AppendDetail("Description:", c.Description);
        AppendDetail("Price:", c.DisplayPrice);
        AppendDetail("Currency:", c.Currency ?? "N/A");
        AppendDetail("Type:", c.Type.ToJson());
        AppendDetail("Platform:", c.Platform.ToJson());
        if (product is ProductIOS pios)
        {
            AppendDetail("Is Family Shareable:", pios.IsFamilyShareableIOS == true ? "Yes" : "No");
        }
        else if (product is ProductAndroid pand)
        {
            AppendDetail("Name (Android):", pand.NameAndroid);
        }
        ProductDetailsOverlay.IsVisible = true;
    }

    private void AppendDetail(string label, string? value)
    {
        ProductDetailsContent.Children.Add(new Label
        {
            Text = label,
            FontSize = 12,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#4A4A4A"),
            Margin = new Thickness(0, 8, 0, 0),
        });
        ProductDetailsContent.Children.Add(new Label
        {
            Text = string.IsNullOrEmpty(value) ? "N/A" : value,
            FontSize = 13,
            TextColor = Color.FromArgb("#1F1F1F"),
        });
    }

    private void ShowPurchaseDetails(Purchase purchase)
    {
        PurchaseDetailsView.Purchase = purchase;
        PurchaseDetailsOverlay.IsVisible = true;
    }

    private void OnCloseProductDetailsClicked(object sender, EventArgs e)
        => ProductDetailsOverlay.IsVisible = false;

    private void OnClosePurchaseDetailsClicked(object sender, EventArgs e)
        => PurchaseDetailsOverlay.IsVisible = false;
}
