using Hyo.OpenIap;
using OpenIap.Maui.Example.Utils;

namespace OpenIap.Maui.Example.Components;

public partial class PurchaseDetailsView : ContentView
{
    public static readonly BindableProperty PurchaseProperty = BindableProperty.Create(
        nameof(Purchase), typeof(Purchase), typeof(PurchaseDetailsView),
        propertyChanged: OnPurchaseChanged);

    public Purchase? Purchase
    {
        get => (Purchase?)GetValue(PurchaseProperty);
        set => SetValue(PurchaseProperty, value);
    }

    public PurchaseDetailsView()
    {
        InitializeComponent();
    }

    private static void OnPurchaseChanged(BindableObject bindable, object oldValue, object newValue)
    {
        if (bindable is not PurchaseDetailsView view) return;
        view.RowsContainer.Children.Clear();
        if (newValue is not Purchase purchase) return;

        foreach (var row in BuildPurchaseRows.From(purchase))
        {
            var stack = new VerticalStackLayout
            {
                Spacing = 4,
                Padding = new Thickness(0, 6),
            };
            stack.Children.Add(new Label
            {
                Text = row.Label,
                FontSize = 12,
                FontAttributes = FontAttributes.Bold,
                TextColor = Color.FromArgb("#4A4A4A"),
            });
            stack.Children.Add(new Label
            {
                Text = row.Value,
                FontSize = 13,
                TextColor = Color.FromArgb("#1F1F1F"),
            });
            stack.Children.Add(new BoxView
            {
                HeightRequest = 1,
                Color = Color.FromArgb("#E1E7EF"),
            });
            view.RowsContainer.Children.Add(stack);
        }
    }
}
