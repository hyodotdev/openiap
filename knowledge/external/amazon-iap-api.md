# Amazon Appstore SDK IAP Reference

> Reference for the Fire OS `amazon` flavor in `packages/google`.
> Source: [Amazon Appstore SDK release notes](https://developer.amazon.com/docs/appstore-sdk/release-notes.html)

## Version Compatibility

| Component | Version | Notes |
| --- | --- | --- |
| Amazon Appstore SDK | **3.0.9** | Current official release (May 20, 2026) |
| OpenIAP Android flavor | `amazon` | Uses the native Appstore SDK, not Google Billing Compatibility |

Appstore SDK 3.0.9 adds `EXISTING_PURCHASE` and `NOT_ELIGIBLE`
fulfillment results and add-on subscription support. Add-on subscriptions are
available only to selected partners and require activation in Amazon Developer
Console.

## OpenIAP Mapping

| OpenIAP API | Amazon Appstore SDK |
| --- | --- |
| `initConnection()` | Register `PurchasingListener`, then request user data |
| `fetchProducts()` | `PurchasingService.getProductData()` |
| `requestPurchase()` | `PurchasingService.purchase()` |
| `getAvailablePurchases()` / restore | `PurchasingService.getPurchaseUpdates()` |
| `finishTransaction()` | `PurchasingService.notifyFulfillment(..., FULFILLED)` |

The Amazon flavor is isolated under
`packages/google/openiap/src/amazon/`. Google Play Billing APIs such as Billing
Programs, Billing Choice, suspended subscriptions, and in-app messages are not
available on this flavor.

## Pending Purchases

Amazon Kids can leave consumable or entitlement purchases waiting for parent
approval. Call `PurchasingService.enablePendingPurchases()` before initiating a
purchase; otherwise the app doesn't receive `PurchaseResponse.RequestStatus.PENDING`.
Do not grant an entitlement for a pending response. Poll purchase updates or use
Amazon Real-Time Notifications to learn when the parent approves it.

Pending purchases do not apply to subscriptions.

Reference: [Implement Pending Purchases](https://developer.amazon.com/docs/in-app-purchasing/implement-pending-purchases.html)

## Fulfillment

Always report the result after deciding whether the customer can access the
content:

| Result | Use |
| --- | --- |
| `FULFILLED` | The purchase was granted successfully |
| `EXISTING_PURCHASE` | The customer already has the relevant account/subscription |
| `NOT_ELIGIBLE` | The customer can't use the purchased service |
| `UNAVAILABLE` | The content couldn't be delivered |

Amazon immediately cancels and refunds the purchase when fulfillment is
reported as `EXISTING_PURCHASE`, `NOT_ELIGIBLE`, or `UNAVAILABLE`; callers must
not use these results as informational statuses.

OpenIAP currently maps successful `finishTransaction()` calls to `FULFILLED`.
The other 3.0.9 results need a deliberate cross-platform API contract before
they can be selected by callers.

Reference: [Implement Appstore SDK IAP](https://developer.amazon.com/docs/in-app-purchasing/iap-implement-iap.html)

## Add-On Subscriptions

Add-on subscriptions use the existing `getProductData`, `purchase`, purchase
updates, and fulfillment calls, but require Appstore SDK 3.0.9+, partner
activation, compatible base-subscription configuration, and server verification
of the RVS `baseReceipts` relationship. Treat them as unavailable unless Amazon
has enabled the feature for the app. In-app add-on purchases are currently
supported only on Fire TV; Fire tablets and Amazon's retail website do not offer
this purchase flow.

An add-on purchase requires an active base subscription. Amazon reports
`PurchaseResponse.RequestStatus.INACTIVE_BASE_SUBSCRIPTION` when that condition
is not met; OpenIAP surfaces it as `item-unavailable` and does not grant the
add-on.

Reference: [Set Up Add-On Subscriptions](https://developer.amazon.com/docs/in-app-purchasing/set-up-add-on-subscriptions.html)
