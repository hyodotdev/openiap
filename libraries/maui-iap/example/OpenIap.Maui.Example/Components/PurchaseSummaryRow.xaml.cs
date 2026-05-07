using Hyo.OpenIap;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Components;

public partial class PurchaseSummaryRow : ContentView
{
    public static readonly BindableProperty PurchaseProperty = BindableProperty.Create(
        nameof(Purchase), typeof(Purchase), typeof(PurchaseSummaryRow),
        propertyChanged: OnPurchaseChanged);

    public Purchase? Purchase
    {
        get => (Purchase?)GetValue(PurchaseProperty);
        set => SetValue(PurchaseProperty, value);
    }

    public event EventHandler? Tapped;

    public PurchaseSummaryRow()
    {
        InitializeComponent();
    }

    private static void OnPurchaseChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is not PurchaseSummaryRow row || newValue is not Purchase purchase) return;

        // Common fields live on the PurchaseCommon interface that both
        // PurchaseIOS and PurchaseAndroid implement.
        var common = (PurchaseCommon)purchase;
        row.ProductIdLabel.Text = common.ProductId;
        var transactionId = BuildPurchaseRows.ResolveTransactionId(purchase);
        row.TransactionIdLabel.Text = $"Transaction: {(string.IsNullOrEmpty(transactionId) ? "N/A" : transactionId)}";

        var platform = common.Platform.ToJson().ToLowerInvariant();
        row.PlatformLabel.Text = platform.ToUpperInvariant();
        row.BadgeBorder.BackgroundColor = platform switch
        {
            "ios" => Color.FromArgb("#007AFF"),
            "android" => Color.FromArgb("#3DDC84"),
            _ => Color.FromArgb("#9E9E9E"),
        };
    }

    private void OnTapped(object? sender, TappedEventArgs e)
    {
        Tapped?.Invoke(this, EventArgs.Empty);
    }
}
