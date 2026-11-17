// An exception escaping PurchaseEvents.Deliver ends the process on iOS.

using System.Text.Json.Nodes;
using OpenIap;
using Xunit;

namespace OpenIap.Maui.Tests;

public class PurchaseEventsTests
{
    private static JsonNode? PurchaseNode() => JsonNode.Parse("""
        {
          "__typename": "PurchaseIOS",
          "id": "transaction-1",
          "isAutoRenewing": false,
          "productId": "premium",
          "purchaseState": "purchased",
          "quantity": 1,
          "store": "apple",
          "storeId": "apple",
          "transactionDate": 1720000000000,
          "transactionId": "transaction-1"
        }
        """);

    [Fact]
    public void Deliver_HandsTheDecodedPurchaseToTheListener()
    {
        var delivered = new List<Purchase>();

        PurchaseEvents.Deliver(PurchaseNode, delivered.Add, "purchaseUpdated");

        Assert.Equal("transaction-1", Assert.IsType<PurchaseIOS>(Assert.Single(delivered)).Id);
    }

    [Fact]
    public void Deliver_ContainsAThrowingListener()
    {
        var calls = 0;

        PurchaseEvents.Deliver(
            PurchaseNode,
            _ =>
            {
                calls++;
                throw new InvalidOperationException("bad listener");
            },
            "purchaseUpdated");

        Assert.Equal(1, calls);
    }

    [Fact]
    public void Deliver_DropsAnEventItCannotDecode()
    {
        var delivered = new List<Purchase>();

        PurchaseEvents.Deliver(() => JsonNode.Parse("""{"id":"no-typename"}"""), delivered.Add, "purchaseUpdated");
        PurchaseEvents.Deliver(() => throw new InvalidOperationException("bridge failed"), delivered.Add, "purchaseUpdated");
        PurchaseEvents.Deliver(() => null, delivered.Add, "purchaseUpdated");

        Assert.Empty(delivered);
    }
}
