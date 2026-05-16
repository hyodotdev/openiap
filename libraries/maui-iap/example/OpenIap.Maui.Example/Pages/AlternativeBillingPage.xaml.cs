using OpenIap;
using OpenIap.Maui;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Pages;

// Mirrors libraries/expo-iap/example/app/alternative-billing.tsx — product
// selection plus iOS External Purchase Link, Android Billing Programs, and
// Android User Choice Billing.
public partial class AlternativeBillingPage : ContentPage
{
    private enum AndroidBillingFlow { BillingPrograms, UserChoiceBilling }

    private readonly List<Product> _products = new();
    private Product? _selectedProduct;
    private Purchase? _lastPurchase;
    private BillingProgramAndroid _billingProgram = BillingProgramAndroid.ExternalOffer;
    private AndroidBillingFlow _androidBillingFlow = AndroidBillingFlow.BillingPrograms;
    private bool _isProcessing;
    private bool _isReconnecting;
    private IDisposable? _purchaseSub;
    private IDisposable? _errorSub;

    public AlternativeBillingPage()
    {
        InitializeComponent();
        ApplyPlatformContent();
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
        await IapLifecycle.EndConnectionQuietlyAsync(nameof(AlternativeBillingPage));
    }

    private async Task ConnectAndFetchAsync()
    {
        try
        {
            await IapLifecycle.InitConnectionAsync(BuildConnectionConfig());
            ConnectionLabel.Text = "✅ Connected";
            ConnectionLabel.TextColor = Color.FromArgb("#4CAF50");
            UpdateModeLabels();
            await LoadProductsAsync();
            ContentScroll.IsVisible = true;
            LoadingView.IsVisible = false;
        }
        catch (Exception ex)
        {
            LoadingView.Message = $"⚠ {ErrorUtils.ExtractErrorMessage(ex)}";
        }
    }

    private InitConnectionConfig? BuildConnectionConfig()
    {
#if ANDROID
        return new InitConnectionConfig { EnableBillingProgramAndroid = _billingProgram };
#else
        return null;
#endif
    }

    private async Task LoadProductsAsync()
    {
        try
        {
            var query = (QueryResolver)Iap.Instance;
            var result = await query.FetchProductsAsync(new ProductRequest
            {
                Skus = Constants.ConsumableProductIds,
                Type = ProductQueryType.InApp,
            });

            _products.Clear();
            if (result is FetchProductsResultProducts products && products.Value is not null)
            {
                _products.AddRange(products.Value);
            }
            RenderProducts();
        }
        catch (Exception ex)
        {
            ProductsContainer.Children.Clear();
            ProductsContainer.Children.Add(new Label
            {
                Text = $"Failed to load products: {ErrorUtils.ExtractErrorMessage(ex)}",
                FontSize = 13,
                TextColor = Color.FromArgb("#DC3545"),
            });
        }
    }

    private void RenderProducts()
    {
        ProductsContainer.Children.Clear();
        if (_products.Count == 0)
        {
            ProductsContainer.Children.Add(new Label
            {
                Text = "Loading products...",
                FontSize = 14,
                TextColor = Color.FromArgb("#777777"),
            });
            return;
        }

        foreach (var product in _products)
        {
            var common = (ProductCommon)product;
            var selected = ReferenceEquals(product, _selectedProduct) || common.Id == (_selectedProduct as ProductCommon)?.Id;
            var card = new Border
            {
                StrokeShape = new Microsoft.Maui.Controls.Shapes.RoundRectangle { CornerRadius = 8 },
                Stroke = selected ? Color.FromArgb("#007AFF") : Color.FromArgb("#E1E7EF"),
                BackgroundColor = selected ? Color.FromArgb("#E7F3FF") : Color.FromArgb("#F8F9FA"),
                Padding = new Thickness(14),
            };

            var stack = new VerticalStackLayout { Spacing = 8 };
            var header = new Grid
            {
                ColumnDefinitions = new ColumnDefinitionCollection { new(GridLength.Star), new(GridLength.Auto) },
                ColumnSpacing = 10,
            };
            header.Children.Add(new Label
            {
                Text = common.Title,
                FontAttributes = FontAttributes.Bold,
                FontSize = 16,
                TextColor = Color.FromArgb("#1A1A1A"),
            });
            var price = new Label
            {
                Text = common.DisplayPrice,
                FontAttributes = FontAttributes.Bold,
                FontSize = 16,
                TextColor = Color.FromArgb("#007AFF"),
            };
            Grid.SetColumn(price, 1);
            header.Children.Add(price);
            stack.Children.Add(header);
            stack.Children.Add(new Label
            {
                Text = common.Description,
                FontSize = 13,
                TextColor = Color.FromArgb("#666666"),
            });
            if (selected)
            {
                stack.Children.Add(new Label
                {
                    Text = "✓ Selected",
                    FontSize = 12,
                    FontAttributes = FontAttributes.Bold,
                    TextColor = Color.FromArgb("#007AFF"),
                });
            }

            card.Content = stack;
            var tap = new TapGestureRecognizer();
            tap.Tapped += (_, _) => SelectProduct(product);
            card.GestureRecognizers.Add(tap);
            ProductsContainer.Children.Add(card);
        }
    }

    private void SelectProduct(Product product)
    {
        _selectedProduct = product;
        var common = (ProductCommon)product;
        SelectedProductDetailsLabel.Text =
            $"ID: {common.Id}\nTitle: {common.Title}\nPrice: {common.DisplayPrice}\nType: {common.Type.ToJson()}";
        SelectedProductPanel.IsVisible = true;
        UpdatePurchaseButton();
        RenderProducts();
    }

    private async void OnSelectFlowClicked(object sender, EventArgs e)
    {
#if ANDROID
        var choice = await DisplayActionSheet(
            "Select Billing Flow",
            "Cancel",
            null,
            "Billing Programs API (8.2.0+)",
            "User Choice Billing (7.0+)");
        if (choice is null or "Cancel") return;

        if (choice.StartsWith("User Choice", StringComparison.Ordinal))
        {
            _androidBillingFlow = AndroidBillingFlow.UserChoiceBilling;
            _billingProgram = BillingProgramAndroid.UserChoiceBilling;
            await ReconnectWithProgramAsync(_billingProgram);
        }
        else
        {
            _androidBillingFlow = AndroidBillingFlow.BillingPrograms;
            if (_billingProgram == BillingProgramAndroid.UserChoiceBilling)
            {
                _billingProgram = BillingProgramAndroid.ExternalOffer;
            }
            await ReconnectWithProgramAsync(_billingProgram);
        }
#else
        await Task.CompletedTask;
#endif
    }

    private async void OnSelectProgramClicked(object sender, EventArgs e)
    {
#if ANDROID
        var choice = await DisplayActionSheet(
            "Select Billing Program",
            "Cancel",
            null,
            "External Offer",
            "External Payments",
            "External Content Link");
        if (choice is null or "Cancel") return;

        _billingProgram = choice switch
        {
            "External Payments" => BillingProgramAndroid.ExternalPayments,
            "External Content Link" => BillingProgramAndroid.ExternalContentLink,
            _ => BillingProgramAndroid.ExternalOffer,
        };
        _androidBillingFlow = AndroidBillingFlow.BillingPrograms;
        await ReconnectWithProgramAsync(_billingProgram);
#else
        await Task.CompletedTask;
#endif
    }

    private async Task ReconnectWithProgramAsync(BillingProgramAndroid program)
    {
        try
        {
            _isReconnecting = true;
            ReconnectBanner.IsVisible = true;
            ShowResult("Reconnecting with new billing program...");

            await IapLifecycle.EndConnectionQuietlyAsync(nameof(AlternativeBillingPage));
            await Task.Delay(500);
            await IapLifecycle.InitConnectionAsync(new InitConnectionConfig { EnableBillingProgramAndroid = program });
            ShowResult($"✅ Reconnected with {ProgramName(program)} program");
            UpdateModeLabels();
            await LoadProductsAsync();
        }
        catch (Exception ex)
        {
            ShowResult($"❌ Reconnection failed: {ErrorUtils.ExtractErrorMessage(ex)}");
        }
        finally
        {
            _isReconnecting = false;
            ReconnectBanner.IsVisible = false;
        }
    }

    private async void OnPurchaseSelectedClicked(object sender, EventArgs e)
    {
        if (_selectedProduct is null || _isProcessing) return;
        await HandlePurchaseAsync(_selectedProduct);
    }

    private async Task HandlePurchaseAsync(Product product)
    {
#if IOS || MACCATALYST
        await HandleIOSAlternativeBillingPurchaseAsync(product);
#elif ANDROID
        if (_androidBillingFlow == AndroidBillingFlow.UserChoiceBilling)
        {
            await HandleAndroidUserChoiceBillingAsync(product);
        }
        else
        {
            await HandleAndroidBillingProgramsAsync(product);
        }
#else
        ShowResult("Alternative billing is available on iOS/macCatalyst and Android only.");
        await Task.CompletedTask;
#endif
    }

    private async Task HandleIOSAlternativeBillingPurchaseAsync(Product product)
    {
        var common = (ProductCommon)product;
        var externalUrl = ExternalUrlEntry.Text?.Trim();
        if (string.IsNullOrWhiteSpace(externalUrl))
        {
            await DisplayAlert("Error", "Please enter a valid external purchase URL", "OK");
            return;
        }

        SetProcessing(true);
        ShowResult("🌐 Opening external purchase link...");
        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var result = await mutate.PresentExternalPurchaseLinkIOSAsync(externalUrl);
            if (!string.IsNullOrEmpty(result.Error))
            {
                ShowResult($"❌ Error: {result.Error}");
                await DisplayAlert("Error", result.Error, "OK");
            }
            else if (result.Success)
            {
                ShowResult($"✅ External purchase link opened successfully\n\nProduct: {common.Id}\nURL: {externalUrl}\n\nUser was redirected to external website.\n\nNote: Complete purchase on your website and implement server-side validation.");
                await DisplayAlert("Redirected", "User was redirected to your external purchase website. Complete the purchase there.", "OK");
            }
        }
        catch (Exception ex)
        {
            ShowResult($"❌ Error: {ErrorUtils.ExtractErrorMessage(ex)}");
            await DisplayAlert("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
        finally
        {
            SetProcessing(false);
        }
    }

    private async Task HandleAndroidBillingProgramsAsync(Product product)
    {
        var common = (ProductCommon)product;
        SetProcessing(true);
        ShowResult("Checking billing program availability...");

        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            var availability = await mutate.IsBillingProgramAvailableAndroidAsync(_billingProgram);
            if (!availability.IsAvailable)
            {
                ShowResult($"❌ Billing program not available\n\nProgram: {availability.BillingProgram.ToJson()}");
                await DisplayAlert("Error", $"{ProgramName(_billingProgram)} is not available for this user/device", "OK");
                return;
            }

            ShowResult("Launching external link...");
            await mutate.LaunchExternalLinkAndroidAsync(new LaunchExternalLinkParamsAndroid
            {
                BillingProgram = _billingProgram,
                LaunchMode = ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
                LinkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
                LinkUri = $"https://openiap.dev/purchase/{common.Id}",
            });

            ShowResult("Getting reporting token...");
            var details = await mutate.CreateBillingProgramReportingDetailsAndroidAsync(_billingProgram);
            var tokenStatus = string.IsNullOrEmpty(details.ExternalTransactionToken)
                ? "missing"
                : details.ExternalTransactionToken;
            ShowResult($"✅ Billing Programs API flow completed\n\nProduct: {common.Id}\nProgram: {details.BillingProgram.ToJson()}\nToken: {tokenStatus}\n\n⚠️ Important:\n1. Report token to Google Play within 24 hours\n2. Process payment on your external site");
            await DisplayAlert("Demo Complete", "Billing Programs API flow completed.\n\nIn production, report the token to Google Play backend within 24 hours.", "OK");
        }
        catch (Exception ex)
        {
            ShowResult($"❌ Error: {ErrorUtils.ExtractErrorMessage(ex)}");
            await DisplayAlert("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
        }
        finally
        {
            SetProcessing(false);
        }
    }

    private async Task HandleAndroidUserChoiceBillingAsync(Product product)
    {
        var common = (ProductCommon)product;
        SetProcessing(true);
        ShowResult("Showing user choice dialog...");

        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.RequestPurchaseAsync(new RequestPurchaseProps
            {
                RequestPurchase = new RequestPurchasePropsByPlatforms
                {
                    Google = new RequestPurchaseAndroidProps { Skus = new[] { common.Id } },
                },
                Type = ProductQueryType.InApp,
            });
            ShowResult($"🔄 User choice dialog shown\n\nProduct: {common.Id}\n\nIf user selects:\n- Google Play: PurchaseUpdated callback\n- Alternative: Manual flow required");
        }
        catch (Exception ex)
        {
            ShowResult($"❌ Error: {ErrorUtils.ExtractErrorMessage(ex)}");
            await DisplayAlert("Error", ErrorUtils.ExtractErrorMessage(ex), "OK");
            SetProcessing(false);
        }
    }

    private async void OnPurchase(Purchase purchase)
    {
        _lastPurchase = purchase;
        _isProcessing = false;
        UpdatePurchaseButton();

        var common = (PurchaseCommon)purchase;
        ShowResult($"✅ Purchase successful\nProduct: {common.ProductId}\nTransaction ID: {common.Id}\nDate: {FormatDate(common.TransactionDate)}");
        LastPurchasePanel.IsVisible = true;
        LastPurchaseLabel.Text = $"Product: {common.ProductId}\nTransaction: {common.Id}\nDate: {FormatDate(common.TransactionDate)}";

        try
        {
            var mutate = (MutationResolver)Iap.Instance;
            await mutate.FinishTransactionAsync(
                purchase: new PurchaseInput(purchase),
                isConsumable: Constants.ConsumableProductIdSet.Contains(common.ProductId));
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[AlternativeBilling] finishTransaction failed: {ex.Message}");
        }
    }

    private void OnPurchaseError(PurchaseError error)
    {
        _isProcessing = false;
        UpdatePurchaseButton();
        ShowResult($"❌ Purchase failed: {error.Message}");
        if (error.Code != ErrorCode.UserCancelled)
        {
            _ = DisplayAlert("Error", error.Message, "OK");
        }
    }

    private void OnDismissResultClicked(object sender, EventArgs e)
    {
        ResultPanel.IsVisible = false;
        ResultLabel.Text = string.Empty;
        _lastPurchase = null;
        LastPurchasePanel.IsVisible = false;
    }

    private void ApplyPlatformContent()
    {
#if IOS || MACCATALYST
        SubtitleLabel.Text = "External purchase links (iOS 16.0+)";
        InfoLabel.Text = "• Enter your external purchase URL\n• Tap Purchase on any product\n• User will be redirected to the external URL\n• Complete purchase on your website\n• No PurchaseUpdated callback\n• Implement deep link to return to app";
        WarningLabel.Text = "⚠️ iOS 16.0+ required\n⚠️ Valid external URL needed\n⚠️ useAlternativeBilling: true is set";
        AndroidFlowSection.IsVisible = false;
        BillingProgramSection.IsVisible = false;
        IosUrlSection.IsVisible = true;
#elif ANDROID
        SubtitleLabel.Text = "Google Play alternative billing";
        IosUrlSection.IsVisible = false;
        AndroidFlowSection.IsVisible = true;
        BillingProgramSection.IsVisible = true;
#else
        SubtitleLabel.Text = "Unsupported platform";
        InfoLabel.Text = "Run this example on iOS/macCatalyst or Android.";
        WarningLabel.Text = string.Empty;
        AndroidFlowSection.IsVisible = false;
        BillingProgramSection.IsVisible = false;
        IosUrlSection.IsVisible = false;
#endif
        UpdateModeLabels();
    }

    private void UpdateModeLabels()
    {
        var currentFlow = _androidBillingFlow;
#if ANDROID
        FlowButton.Text = currentFlow == AndroidBillingFlow.BillingPrograms
            ? "Billing Programs API (8.2.0+)"
            : "User Choice Billing (7.0+)";
        ProgramButton.Text = ProgramName(_billingProgram);
        BillingProgramSection.IsVisible = currentFlow == AndroidBillingFlow.BillingPrograms;
        CurrentProgramLabel.Text = $"Current program: {_billingProgram.ToJson().ToUpperInvariant().Replace("-", "_", StringComparison.Ordinal)}";
        InfoLabel.Text = currentFlow == AndroidBillingFlow.UserChoiceBilling
            ? "• User Choice Billing Mode\n• Users choose between:\n  - Google Play\n  - Your payment system\n• Google shows selection dialog\n• If Google Play: PurchaseUpdated\n• If alternative: Manual flow"
            : "• External Offer / Billing Programs Mode\n• Uses Billing Programs API (8.2.0+)\n• External link flow for purchases\n• No PurchaseUpdated callback\n• Must report to Google within 24h";
        WarningLabel.Text = "⚠️ Requires approval from Google\n⚠️ Must report tokens within 24 hours\n⚠️ Backend integration required";
#else
        CurrentProgramLabel.Text = string.Empty;
#endif
        UpdatePurchaseButton();
    }

    private void SetProcessing(bool processing)
    {
        _isProcessing = processing;
        UpdatePurchaseButton();
    }

    private void UpdatePurchaseButton()
    {
        if (_selectedProduct is null) return;
        PurchaseButton.IsEnabled = !_isProcessing && !_isReconnecting;
        PurchaseButton.Opacity = PurchaseButton.IsEnabled ? 1 : 0.5;
        PurchaseButton.Text = _isProcessing
            ? "Processing..."
            : PurchaseButtonText();
    }

    private string PurchaseButtonText()
    {
#if IOS || MACCATALYST
        return "🛒 Buy (External URL)";
#elif ANDROID
        return _androidBillingFlow == AndroidBillingFlow.BillingPrograms
            ? "🛒 Buy (Billing Programs)"
            : "🛒 Buy (User Choice Billing)";
#else
        return "Purchase";
#endif
    }

    private void ShowResult(string text)
    {
        ResultPanel.IsVisible = true;
        ResultLabel.Text = text;
    }

    private static string ProgramName(BillingProgramAndroid program) => program switch
    {
        BillingProgramAndroid.ExternalPayments => "External Payments",
        BillingProgramAndroid.ExternalContentLink => "External Content Link",
        BillingProgramAndroid.UserChoiceBilling => "User Choice Billing",
        BillingProgramAndroid.Unspecified => "Unspecified",
        _ => "External Offer",
    };

    private static string FormatDate(double timestamp)
    {
        try
        {
            return DateTimeOffset.FromUnixTimeMilliseconds((long)timestamp)
                .LocalDateTime.ToString("g");
        }
        catch
        {
            return timestamp.ToString("0");
        }
    }
}
