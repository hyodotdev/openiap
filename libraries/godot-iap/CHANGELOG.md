# Changelog

All notable changes to godot-iap will be documented in this file.

## [Unreleased]

### Added

- **ProductStatusAndroid enum** (Android 8.0+): Individual product fetch status codes
  - `OK`: Product was successfully fetched
  - `NOT_FOUND`: Product SKU doesn't exist in Play Console
  - `NO_OFFERS_AVAILABLE`: Product exists but user is not eligible for any offers
  - `UNKNOWN`: Unknown error occurred while fetching

- **SubResponseCodeAndroid enum** (Android 8.0+): Granular purchase error information
  - `NO_APPLICABLE_SUB_RESPONSE_CODE`: No specific sub-response code applies
  - `PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS`: User's payment method has insufficient funds
  - `USER_INELIGIBLE`: User doesn't meet subscription offer eligibility requirements

- **BillingResultAndroid class** (Android 8.0+): Extended billing result with sub-response code

- **SubscriptionOfferTypeIOS.WIN_BACK** (iOS 18+): New offer type for win-back offers to re-engage churned subscribers

- **WinBackOfferInputIOS class** (iOS 18+): Input type for win-back offers (requires native code update to use)

- **PromotionalOfferJWSInputIOS class** (iOS 15+, WWDC 2025): JWS format promotional offers (requires native code update to use)

- **RequestSubscriptionIosProps** new fields:
  - `win_back_offer`: Win-back offer to apply (iOS 18+)
  - `promotional_offer_jws`: JWS promotional offer (iOS 15+, WWDC 2025)
  - `introductory_offer_eligibility`: Override introductory offer eligibility (iOS 15+)

- **RequestActiveSubscriptionsAndroidProps** new field:
  - `include_suspended_android`: Include suspended subscriptions in the result (Android 8.1+)

- **ProductAndroid** new field:
  - `product_status_android`: Product-level status code indicating fetch result (Android 8.0+)

### OpenIAP Version Updates

| Package | Version |
|---------|---------|
| openiap-gql | 1.3.14 |
| openiap-apple | 1.3.12 |
| openiap-google | 1.3.25 |

### Notes

- The new iOS subscription features (win-back offers, JWS promotional offers) are type-only updates. Using them requires native GDExtension updates which will be added in a future release.
- The new Android enums (`ProductStatusAndroid`, `SubResponseCodeAndroid`) are returned automatically by OpenIAP when available.

For detailed changes, see the [OpenIAP Release Notes](https://openiap.dev/docs/updates/notes#1314---standardized-offer-types).
