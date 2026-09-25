# Amazon Appstore SDK IAP Reference

> Reference for the Fire OS `amazon` flavor in `packages/google`.
> Source: [Amazon Appstore SDK release notes](https://developer.amazon.com/docs/appstore-sdk/release-notes.html)

## Version Compatibility

| Component              | Version   | Notes                                                          |
| ---------------------- | --------- | -------------------------------------------------------------- |
| Amazon Appstore SDK    | **3.0.9** | Current official release (May 20, 2026)                        |
| OpenIAP Android flavor | `amazon`  | Uses the native Appstore SDK, not Google Billing Compatibility |

Appstore SDK 3.0.9 adds `EXISTING_PURCHASE` and `NOT_ELIGIBLE`
fulfillment results and add-on subscription support. Add-on subscriptions are
available only to selected partners and require activation in Amazon Developer
Console.

## OpenIAP Mapping

| OpenIAP API                         | Amazon Appstore SDK                                   |
| ----------------------------------- | ----------------------------------------------------- |
| `initConnection()`                  | Register `PurchasingListener`, then request user data |
| `fetchProducts()`                   | `PurchasingService.getProductData()`                  |
| `requestPurchase()`                 | `PurchasingService.purchase()`                        |
| `getAvailablePurchases()` / restore | `PurchasingService.getPurchaseUpdates()`              |
| `finishTransaction()`               | `PurchasingService.notifyFulfillment(..., FULFILLED)` |

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

| Result              | Use                                                        |
| ------------------- | ---------------------------------------------------------- |
| `FULFILLED`         | The purchase was granted successfully                      |
| `EXISTING_PURCHASE` | The customer already has the relevant account/subscription |
| `NOT_ELIGIBLE`      | The customer can't use the purchased service               |
| `UNAVAILABLE`       | The content couldn't be delivered                          |

Amazon immediately cancels and refunds the purchase when fulfillment is
reported as `EXISTING_PURCHASE`, `NOT_ELIGIBLE`, or `UNAVAILABLE`; callers must
not use these results as informational statuses.

OpenIAP currently maps successful `finishTransaction()` calls to `FULFILLED`.
The other 3.0.9 results need a deliberate cross-platform API contract before
they can be selected by callers.

Reference: [Implement Appstore SDK IAP](https://developer.amazon.com/docs/in-app-purchasing/iap-implement-iap.html)

## Subscription Periods and Free Trials

`Product` carries no structured pricing: `getPrice()` is a formatted string
only, with no numeric amount and no currency code. OpenIAP passes it through as
`displayPrice`, derives `price` from it on a best-effort basis with
`AmazonPriceParser`, and leaves `currency` empty; paywalls render `displayPrice`.

`getSubscriptionPeriod()` and `getFreeTrialPeriod()` are duration words:
`Weekly`, `BiWeekly`, `Monthly`, `BiMonthly`, `Quarterly`, `SemiAnnual`,
`Annual`. Amazon's product data field table ("Implement getProductData method"
section of the page linked below) states: "Free trial period of the subscription
term. Returned only if a free trial is configured and the customer is eligible."
Its presence is therefore the eligibility signal. The `Product` javadoc says
only that the value may be null and does not mention eligibility. OpenIAP maps
both to `SubscriptionPeriod` and emits the trial as a second `SubscriptionOffer`
with `paymentMode: free-trial`, `periodCount: 1`, `price: 0`, and `id: ""`
(Amazon names no offer, matching the iOS introductory offer, so it stays
distinct from the base offer whose `id` is the SKU). Like every Play and
Horizon offer, the trial offer sets `basePlanIdAndroid` to the SKU; it leaves
the remaining Play-only fields (offer token, tags, pricing phases) null
because Amazon reports none. The base offer keeps its earlier shape:
`basePlanIdAndroid` is the SKU, `offerTokenAndroid` is `""`, and
`pricingPhasesAndroid` holds one synthetic recurring phase.

After purchase the RVS receipt reports `freeTrialEndDate` while the
subscription is in its trial.

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

## Server-to-Server Surfaces

Amazon's server side is three separate things. IAPKit uses only the first.

**Receipt Verification Service** validates a receipt and returns its current
state: `receiptId`, `productId`, `productType`, `purchaseDate`, `quantity`,
`countryCode`, and for subscriptions `autoRenewing`, `renewalDate`, `cancelDate`,
`cancelReason`, `term`, `termSku`, `freeTrialEndDate`, `gracePeriodEndDate`,
`deferredDate`/`deferredSku`, `baseReceipts`, `promotions`, `fulfillmentDate`,
`fulfillmentResult`, `betaProduct`, `testTransaction`. It carries no price or
currency, and it reports state rather than the transition that produced it.

**Real-Time Notifications** push purchase state changes to an HTTPS endpoint
registered in the developer console. Sixteen types: `CONSUMABLE_PURCHASED`,
`CONSUMABLE_CANCELLED`, `ENTITLEMENT_PURCHASED`, `ENTITLEMENT_CANCELLED`,
`SUBSCRIPTION_PURCHASED`, `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_CANCELLED`,
`SUBSCRIPTION_EXPIRED`, `SUBSCRIPTION_IN_GRACE_PERIOD`,
`SUBSCRIPTION_OUT_OF_GRACE_PERIOD`, `SUBSCRIPTION_AUTO_RENEWAL_ON`,
`SUBSCRIPTION_AUTO_RENEWAL_OFF`, `SUBSCRIPTION_SCHEDULED_TO_END`,
`SUBSCRIPTION_MODIFIED_IMMEDIATE`, `SUBSCRIPTION_MODIFIED_DEFERRED`,
`SUBSCRIPTION_CONVERTED_FREE_TRIAL_TO_PAID`. The payload is `receiptId`,
`relatedReceipts`, `appUserId`, `notificationType`, `appPackageName`,
`timestamp`, `betaProductTransaction` — no amount, and no field separating a
refund from a cancellation.

**Reporting API** downloads sales, earnings and subscription reports through a
pre-signed S3 URL, authenticated with Login with Amazon. Sales reports are
per-transaction from 2018 onward, with `Receipt ID`, `Transaction Id`,
`Transaction Type` (Charge, Refund, Chargeback, Chargeback reversal),
`Sales Price`, `Estimated Earnings` and `Marketplace Currency`. This is the only
Amazon surface that reports an amount, and it is a batch export.

Vega OS shares this server side. One app listing covers Fire OS and Vega, using
the same Receipt Verification Service host and the same notification channel, so
Vega is not a separate store.

> **OpenIAP Note**: which of these the specification treats as available, and
> how each is delivered, is stated in
> `specs/commerce-protocol/examples/store-facts.json`.

References:
[Understanding Real-Time Notifications](https://developer.amazon.com/docs/in-app-purchasing/real-time-notifications.html),
[RVS for Android apps](https://developer.amazon.com/docs/in-app-purchasing/iap-rvs-for-android-apps.html),
[Reporting API](https://developer.amazon.com/docs/reports-promo/reporting-API.html),
[Sales reports](https://developer.amazon.com/docs/reports-promo/sales-reports.html)
