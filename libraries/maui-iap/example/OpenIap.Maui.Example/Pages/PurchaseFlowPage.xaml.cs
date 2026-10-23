using OpenIap;
using OpenIap.Maui;
using OpenIap.Maui.Example.Components;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// One-time purchases through the app's purchase flow, which confirms each one before finishing it.
public partial class PurchaseFlowPage : ContentPage
{
    private readonly List<Product> _products = new();
    private readonly List<Purchase> _availablePurchases = new();
    private string? _purchaseResult;
    private Purchase? _lastPurchase;
    private bool _isProcessing;
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
                ProductsCountLabel.Text = "Loading products...";
                RenderPurchases();
                _ = RefreshStorefrontAsync(showAlert: false);
                _ = LoadProductsAsync();
                _ = RefreshAvailablePurchasesAsync(showAlert: false);
            }
            await RecoverPurchasesAsync();
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
            var result = await OpenIapClient.Query.FetchProductsAsync(new ProductRequest
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
            var storefront = await OpenIapClient.Query.GetStorefrontAsync().WaitAsync(TimeSpan.FromSeconds(10));
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
                await DisplayAlertAsync("Storefront", ErrorUtils.ExtractErrorMessage(ex), "OK");
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
            var purchases = await OpenIapClient.Query.GetAvailablePurchasesAsync(new PurchaseOptions
            {
                OnlyIncludeActiveItemsIOS = true,
            }).WaitAsync(TimeSpan.FromSeconds(20));
            _availablePurchases.Clear();
            // Deduplicate by productId, keeping the most recent transaction.
            var deduped = purchases
                .GroupBy(p => p.ProductId)
                .Select(g => g.OrderByDescending(p => p.TransactionDate).First());
            _availablePurchases.AddRange(deduped);
            RenderPurchases();
            RenderProducts();
        }
        catch (Exception ex)
        {
            PurchasesCountLabel.Text = "Could not refresh purchases";
            if (showAlert)
            {
                await DisplayAlertAsync("Refresh Failed", ErrorUtils.ExtractErrorMessage(ex), "OK");
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
            .Select(p => p.ProductId)
            .Where(Constants.NonConsumableProductIdSet.Contains)
            .ToHashSet();
        var visible = _products
            .Where(p => !(Constants.NonConsumableProductIdSet.Contains(p.Id) && owned.Contains(p.Id)))
            .ToList();

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
        var titleRow = new Grid
        {
            ColumnDefinitions = new ColumnDefinitionCollection { new(GridLength.Star), new(GridLength.Auto) },
            ColumnSpacing = 8,
        };
        var titleLabel = new Label
        {
            Text = product.Title,
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#1A1A1A"),
        };
        Grid.SetColumn(titleLabel, 0);
        titleRow.Children.Add(titleLabel);

        var priceLabel = new Label
        {
            Text = product.DisplayPrice,
            FontSize = 16,
            FontAttributes = FontAttributes.Bold,
            TextColor = Color.FromArgb("#007AFF"),
        };
        Grid.SetColumn(priceLabel, 1);
        titleRow.Children.Add(priceLabel);

        var description = new Label
        {
            Text = product.Description,
            FontSize = 13,
            TextColor = Color.FromArgb("#5F6470"),
        };

        var badgeText = Constants.ConsumableProductIdSet.Contains(product.Id) ? "Consumable product"
            : Constants.NonConsumableProductIdSet.Contains(product.Id) ? "Non-consumable product"
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
        purchaseButton.Clicked += async (_, _) => await HandlePurchaseAsync(product.Id);
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
            // The flow confirms the delivered purchase and reports it to OnOutcome.
            var result = await OpenIapClient.Mutation.RequestPurchaseAsync(new RequestPurchaseProps
            {
                RequestPurchase = new RequestPurchasePropsByPlatforms
                {
                    Apple = new RequestPurchaseIosProps { Sku = sku, Quantity = 1 },
                    Google = new RequestPurchaseAndroidProps { Skus = new[] { sku } },
                },
                Type = ProductQueryType.InApp,
            });
            if (result is null) UpdateResult("Purchase request completed without a purchase result.");
        }
        catch (Exception ex)
        {
            UpdateResult(ErrorUtils.FormatPurchaseFailure(ex));
        }
        finally
        {
            _isProcessing = false;
            RenderProducts();
        }
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

    private void OnOutcome(object? sender, PurchaseFlowOutcome outcome)
    {
        var (purchase, status) = outcome;
        if (!Constants.ProductIds.Contains(purchase.ProductId)) return;
        _lastPurchase = purchase;
        var credited = Constants.ConsumableProductIdSet.Contains(purchase.ProductId) && status is PurchaseFlowStatus.Entitled;
        UpdateResult(IapLifecycle.Describe(outcome, "Purchase") + (credited ? $"\nBulbs: {IapLifecycle.Bulbs}" : ""));
        RenderProducts();
        if (status is not PurchaseFlowStatus.Entitled) return;

        _ = RefreshAvailablePurchasesAsync(showAlert: false);
        _ = status is PurchaseFlowStatus.Entitled { FinishError: { } finishError }
            ? DisplayAlertAsync("Finish Failed", finishError.Message, "OK")
            : DisplayAlertAsync("Success", "Purchase completed successfully!", "OK");
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
        await DisplayAlertAsync("Copied", "Purchase result copied to clipboard", "OK");
    }

    private async void OnCheckAppOwnershipClicked(object sender, EventArgs e)
    {
        var projectNumber = OwnershipCloudProjectNumberEntry.Text?.Trim() ?? string.Empty;
        var requestHash = OwnershipRequestHashEntry.Text?.Trim() ?? string.Empty;
        OwnershipResultLabel.IsVisible = true;
        if (string.IsNullOrEmpty(projectNumber) != string.IsNullOrEmpty(requestHash))
        {
            OwnershipResultLabel.Text = $"Error: {ErrorCode.DeveloperError.ToJson()}\nEnter both Google Cloud project number and Request hash, or leave both empty.";
            return;
        }
        var google = string.IsNullOrEmpty(projectNumber) ? null : new PlayIntegrityParamsAndroid
        {
            CloudProjectNumber = projectNumber,
            RequestHash = requestHash,
        };
        OwnershipCheckButton.IsEnabled = false;
        OwnershipCloudProjectNumberEntry.IsEnabled = false;
        OwnershipRequestHashEntry.IsEnabled = false;
        OwnershipCheckButton.Text = "Checking...";
        OwnershipResultLabel.Text = string.Empty;
        try
        {
            var result = await OpenIapClient.Query.VerifyAppOwnershipAsync(new VerifyAppOwnershipProps { Google = google });
            OwnershipResultLabel.Text =
                $"Status: {result.Status.ToJson()}\n" +
                $"Store ID: {result.StoreId}\n" +
                $"Reason: {result.Reason?.ToJson() ?? "none"}\n" +
                $"Signed AppTransaction length: {result.SignedAppTransactionIOS?.Length ?? 0}\n" +
                $"Integrity token length: {result.IntegrityTokenAndroid?.Length ?? 0}";
        }
        catch (OpenIapException error)
        {
            OwnershipResultLabel.Text = $"Error: {error.Error.Code.ToJson()}\n{ErrorUtils.ExtractErrorMessage(error)}";
        }
        catch (Exception error)
        {
            OwnershipResultLabel.Text = $"App ownership failed: {ErrorUtils.ExtractErrorMessage(error)}";
        }
        finally
        {
            OwnershipCheckButton.IsEnabled = true;
            OwnershipCloudProjectNumberEntry.IsEnabled = true;
            OwnershipRequestHashEntry.IsEnabled = true;
            OwnershipCheckButton.Text = "Check app ownership";
        }
    }

    private async void OnCheckAppTransactionClicked(object sender, EventArgs e)
    {
#if IOS || MACCATALYST
        try
        {
            var t = await OpenIapClient.Query.GetAppTransactionIOSAsync();
            if (t is null)
            {
                await DisplayAlertAsync("App Transaction", "No app transaction found", "OK");
                return;
            }
            await DisplayAlertAsync(
                "App Transaction",
                $"Original App Version: {t.OriginalAppVersion}\n" +
                $"Purchase Date: {DateTimeOffset.FromUnixTimeMilliseconds((long)t.OriginalPurchaseDate).UtcDateTime:d}\n" +
                $"Device Verification: {t.DeviceVerification}\n" +
                $"Environment: {t.Environment}",
                "OK");
        }
        catch (Exception ex)
        {
            await DisplayAlertAsync("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
#else
        await DisplayAlertAsync("App Transaction", "App Transaction is iOS / macCatalyst only.", "OK");
#endif
    }

    private void ShowProductDetails(Product product)
    {
        ProductDetailsContent.Children.Clear();
        AppendDetail("Product ID:", product.Id);
        AppendDetail("Title:", product.Title);
        AppendDetail("Description:", product.Description);
        AppendDetail("Price:", product.DisplayPrice);
        AppendDetail("Currency:", product.Currency ?? "N/A");
        AppendDetail("Type:", product.Type.ToJson());
        AppendDetail("Platform:", product.Platform.ToJson());
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
