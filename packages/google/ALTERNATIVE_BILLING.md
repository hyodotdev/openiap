# External Offer Billing Program Guide

This guide shows the current OpenIAP flow for sending a Google Play user to an
external digital-content offer. Use the Billing Programs APIs shown below.

## Requirements

- Google Play Console enrollment in the applicable Billing Program
- Google approval and country/region eligibility
- A supported Google Play Billing Library version (OpenIAP currently uses
  9.1.0)
- A backend that verifies checkout completion and reports the external
  transaction to Google Play within 24 hours
- An approved external offer URL

## Initialize the Billing Program

Construct the store and enable the program on the connection configuration:

```kotlin
val iapStore = OpenIapStore(applicationContext)

val connected = iapStore.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)

if (!connected) {
    // Handle an unavailable Play Billing connection.
    return
}
```

The same rule applies when using `OpenIapModule` directly:

```kotlin
val openIapModule = OpenIapModule(applicationContext)

openIapModule.initConnection(
    InitConnectionConfig(
        enableBillingProgramAndroid = BillingProgramAndroid.ExternalOffer
    )
)
```

Register purchase and billing listeners with the corresponding `add...Listener`
and `remove...Listener` APIs.

## Complete External Offer Flow

Do not treat a successful link launch as a completed purchase. Create the
reporting details immediately before the launch, let Google Play present the
required disclosure and destination, then wait for independently verified
checkout completion before reporting the transaction.

```kotlin
suspend fun startExternalOffer(
    activity: Activity,
    productId: String,
    checkoutUrl: String,
) {
    // 1. Confirm that the enabled program is available for this user.
    val availability = iapStore.isBillingProgramAvailable(
        BillingProgramAndroid.ExternalOffer
    )
    if (!availability.isAvailable) {
        showErrorMessage("External offers are unavailable")
        return
    }

    // 2. Create fresh reporting details immediately before this launch.
    // Never cache or reuse the external transaction token.
    val reportingDetails = iapStore.createBillingProgramReportingDetails(
        BillingProgramAndroid.ExternalOffer
    )

    // 3. Let Google Play disclose and launch the external destination.
    val launched = iapStore.launchExternalLink(
        activity,
        LaunchExternalLinkParamsAndroid(
            billingProgram = BillingProgramAndroid.ExternalOffer,
            launchMode =
                ExternalLinkLaunchModeAndroid.LaunchInExternalBrowserOrApp,
            linkType = ExternalLinkTypeAndroid.LinkToDigitalContentOffer,
            linkUri = checkoutUrl,
        )
    )
    if (!launched) {
        showErrorMessage("External offer could not be opened")
        return
    }

    // 4. A launch is not a purchase. Verify the checkout through your
    // return/deep-link and backend before reporting it to Google.
    val checkout = YourBackend.waitForVerifiedCheckoutCompletion(productId)
    if (!checkout.success) return

    YourBackend.reportExternalTransaction(
        externalTransactionToken =
            reportingDetails.externalTransactionToken,
        productId = productId,
        externalTransactionId = checkout.transactionId,
    )
}
```

External payments do not produce a Google Play purchase, so the standard
purchase update and purchase error listeners are not payment-success callbacks
for this flow. Your external payment provider and backend remain the authority
for checkout completion.

## Migration from the OpenIAP 2.x Compatibility Surface

| OpenIAP 2.x compatibility API                       | Current API                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `OpenIapStore(context, AlternativeBillingMode...)`  | `OpenIapStore(context)` and `InitConnectionConfig.enableBillingProgramAndroid`  |
| `OpenIapModule(context, AlternativeBillingMode...)` | `OpenIapModule(context)` and `InitConnectionConfig.enableBillingProgramAndroid` |
| constructor listener arguments                      | `add...Listener` / `remove...Listener`                                          |
| `checkAlternativeBillingAvailability()`             | `isBillingProgramAvailable(BillingProgramAndroid.ExternalOffer)`                |
| `showAlternativeBillingInformationDialog()`         | `launchExternalLink(activity, params)`                                          |
| `createAlternativeBillingReportingToken()`          | `createBillingProgramReportingDetails(BillingProgramAndroid.ExternalOffer)`     |

These compatibility APIs still work in OpenIAP 2.x. Do not remove them from a
2.x application without migrating the complete flow, but do migrate before
OpenIAP 3.0.

## Backend Reporting

Your backend must report a verified external transaction to the Google Play
Developer API within 24 hours. Keep OAuth credentials and reporting logic on
the server, associate each fresh external transaction token with one checkout,
and make reporting idempotent.

```http
POST https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{packageName}/externalTransactions
Authorization: Bearer {oauth_token}
Content-Type: application/json

{
  "externalTransactionToken": "token_from_reporting_details",
  "productId": "your_product_id",
  "externalTransactionId": "your_transaction_id",
  "transactionTime": "2026-07-24T12:00:00Z"
}
```

## Testing Checklist

1. Enroll the app and target countries in Play Console.
2. Add license-test accounts and publish a signed build to an internal track.
3. Confirm connection setup enables `ExternalOffer`.
4. Test unavailable, user-cancelled, failed-checkout, and verified-checkout
   paths.
5. Confirm that link launch alone grants no entitlement.
6. Confirm that each verified checkout is reported once within 24 hours.

Do not use a demo flow that skips real payment verification as release
evidence.

## Resources

- [OpenIAP external purchase guide](https://openiap.dev/docs/features/external-purchase)
- [OpenIAP deprecation schedule](https://openiap.dev/docs/updates/migration)
- [Google Play alternative billing documentation](https://developer.android.com/google/play/billing/alternative)
- [Google Play external transaction reporting](https://developer.android.com/google/play/billing/alternative/reporting)
