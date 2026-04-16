---
title: Sandbox E2E — subscriptionBillingIssue
audience: contributors, release QA
---

# Sandbox E2E: `subscriptionBillingIssue`

The `subscriptionBillingIssue` event requires live store signals that cannot be produced from a unit-test JVM. This document captures the exact sandbox procedure for both platforms so any reviewer can reproduce.

All code paths verified by local compile + Horizon Robolectric unit test:

```bash
cd packages/google
./gradlew :openiap:compilePlayDebugKotlin
./gradlew :openiap:compileHorizonDebugKotlin
./gradlew :openiap:testHorizonDebugUnitTest   # Robolectric no-op assertion

cd ../apple
swift build && swift test                     # 87 tests

cd ../../libraries/kmp-iap
./gradlew :library:compileDebugKotlinAndroid

cd ../react-native-iap && yarn typecheck
cd ../expo-iap && bun run tsc --noEmit
cd ../flutter_inapp_purchase && flutter analyze
```

---

## iOS (StoreKit 2 sandbox)

**Prereqs**

- Physical iOS device running **iOS 18.0 or later** (the `Message.Reason.billingIssue` API is iOS 18+ / Mac Catalyst 18+; the iOS Simulator does not deliver StoreKit Messages).
- A sandbox Apple ID enrolled in App Store Connect → Users and Access → Sandbox Testers.
- An auto-renewable subscription product configured on App Store Connect, and the Example project's `subscriptionIds` list pointing at it (`dev.hyo.martie.premium` by default).

**Step-by-step**

1. Sign the device out of its production Apple ID. Sign the sandbox tester into **Settings → App Store → Sandbox Account**.
2. Open the Example app:
   - `packages/apple/Example/OpenIapExample.xcodeproj` — run the `OpenIapExample` scheme.
3. In-app: navigate to the **Subscription Flow** screen and subscribe to `dev.hyo.martie.premium`.
4. Force a billing issue on the **device** (requires iOS 16+ / iPadOS 16+):
   - Go to **Settings → Developer → Sandbox Account → Manage → Account Settings**.
   - Disable the **Allow Purchases & Renewals** setting.
   - This causes all in-app purchases to fail and auto-renewable subscriptions to stop renewing.
   - The setting applies to all devices the sandbox account signs in to.
   - Reference: <https://developer.apple.com/documentation/storekit/testing-failing-subscription-renewals-and-in-app-purchases#Configure-the-sandbox-environment-to-simulate-billing-issues>.
5. Wait for the next renewal cycle (Renewal Rate = 5 minutes → wait ~5 min). The renewal fails, and StoreKit delivers `Message.Reason.billingIssue` when the app is in the foreground.
6. To simulate the user fixing the issue, re-enable **Allow Purchases & Renewals**.
7. Expected UI: the orange "Subscription needs attention" banner appears at the top of the Subscription Flow screen. Tapping **Fix payment method** opens `SKPaymentQueue` / `showManageSubscriptions`.

**What success looks like**

- Console logs:

  ```text
  🔔 [MessageListener] billingIssue received
  Emitting subscriptionBillingIssue: dev.hyo.martie.premium
  ```

- Banner visible on `SubscriptionFlowScreen`.
- `Transaction.currentEntitlements` shows the affected subscription in `.inBillingRetryPeriod` or `.inGracePeriod`.

**If nothing fires**

- iOS < 18 — silent no-op by design (confirm with `#available` trace in logs).
- tvOS / watchOS / macOS / visionOS build — silent no-op by design (StoreKit.Message API is iOS-only).
- App not foregrounded when the message is posted — StoreKit delivers on next `Message.messages` await; bring the app to foreground.

---

## Android (Play Billing 8.1+ sandbox)

**Prereqs**

- Physical Android device (or emulator with Play Store) running the Play flavor of the Example app:
  `packages/google/Example` → run with product flavor **play**.
- A Play Console sandbox tester account on the device.
- A subscription product configured in the Play Console, matching `subscriptionSkus` in `SubscriptionFlowScreen.kt`.

**Step-by-step**

1. Install the Example APK (`./gradlew :Example:installPlayDebug`).
2. Sign in with the sandbox tester account in the Play Store app.
3. Subscribe to a test subscription in the Example app.
4. Force a suspension:
   - In the **Google Play Store → Payment methods**, remove all payment methods for the sandbox account, OR
   - Use Play Console → **Subscriptions → Test suspensions** (requires appropriate Play Console role). Reference: <https://developer.android.com/google/play/billing/subscriptions#suspended>.
5. Wait for Play's renewal cycle. When Play suspends the subscription, the next `getAvailablePurchases` or `onPurchasesUpdated` will include the purchase with `isSuspended == true`.
6. Return to the Example app. The banner fires once per session per affected purchase (deduped by `purchaseToken`).

**What success looks like**

- `logcat` shows:

  ```text
  D OpenIapModule: onPurchasesUpdated isSuspended=true ...
  D Example: subscriptionBillingIssue fired for sku=...
  ```

- Banner visible on `SubscriptionFlowScreen`.
- Tapping **Fix payment method** launches `deepLinkToSubscriptions` which routes to Play's subscription center.

**Horizon flavor (do NOT attempt)**

- The Horizon flavor's `addSubscriptionBillingIssueListener` is a documented no-op. Verified by
  `SubscriptionBillingIssueHorizonNoOpTest` (Robolectric, runs on CI). There is no sandbox path on Horizon because the Billing Compatibility SDK 1.1.1 targets Play Billing 7.0 which does not expose `Purchase.isSuspended`.

---

## Cross-library smoke (optional)

Use `libraries-versions.jsonc` to point example apps at the local monorepo sources (already `"local"` by default), then verify each downstream library surfaces the event:

| Library | Check |
|---------|-------|
| react-native-iap | `useIAP({ onSubscriptionBillingIssue: p => console.log(p) })` fires the callback. `subscriptionBillingIssueListener()` also fires independently. |
| expo-iap | `subscriptionBillingIssueListener((p) => console.log(p))` fires via expo event emitter. |
| flutter_inapp_purchase | `iap.subscriptionBillingIssueListener.listen(...)` emits the Purchase. |
| godot-iap | `godot_iap.subscription_billing_issue.connect(...)` emits the Dictionary payload. |
| kmp-iap | `kmpIapInstance.subscriptionBillingIssueListener.collect {...}` emits in the Flow. |

---

## Automated coverage matrix

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Horizon no-op guarantee | Robolectric unit test (`SubscriptionBillingIssueHorizonNoOpTest`) | Runs on CI |
| Play-flavor compile of listener surface | `compilePlayDebugKotlin` | Runs on CI |
| Apple Swift test fakes implement protocol | `swift test` | Runs on CI |
| Downstream types synced | Gen check by each library's typecheck task | Runs on CI |
| Live sandbox behavior (iOS 18 message + Play suspended) | Manual, this document | Release QA |
