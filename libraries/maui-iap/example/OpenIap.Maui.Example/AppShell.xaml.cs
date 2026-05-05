using OpenIap.Maui.Example.Pages;

namespace OpenIap.Maui.Example;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();

        Routing.RegisterRoute("all-products", typeof(AllProductsPage));
        Routing.RegisterRoute("purchase-flow", typeof(PurchaseFlowPage));
        Routing.RegisterRoute("subscription-flow", typeof(SubscriptionFlowPage));
        Routing.RegisterRoute("available-purchases", typeof(AvailablePurchasesPage));
        Routing.RegisterRoute("offer-code", typeof(OfferCodePage));
        Routing.RegisterRoute("alternative-billing", typeof(AlternativeBillingPage));
        Routing.RegisterRoute("webhook-stream", typeof(WebhookStreamPage));
    }
}
