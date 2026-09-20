# Real-store subscription verification

Apple and Google test purchases reached IAPKit and unlocked access through the
example project's actual paywall handler. Apple subscription notifications also
reached its receiver over public HTTPS. **Google notification delivery remains
unverified.** This is a development/sandbox run recorded on September 13, 2026.

Read the [redacted requests, results and delivery records](./store-sandbox-verification.json).
Credentials, receipts and store account identities are excluded.

## What ran

```text
Expo app on iPhone / Pixel
  → real sandbox checkout
  → local IAPKit → Apple / Google verification → DEV database

Actual device receipt, passed on the server
  → example paywall.mjs → IAPKit verify → bind → entitlements

Apple Sandbox notification
  → public HTTPS ingress → IAPKit → DEV outbound worker
  → public HTTPS ingress → example delivery.mjs → SQLite / attribution.mjs
```

The example's [paywall handler](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/b41facb1bf648d6c0aeea80745371dcc25482f8c/paywall.mjs),
[receiver](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/b41facb1bf648d6c0aeea80745371dcc25482f8c/delivery.mjs)
and [attribution code](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/b41facb1bf648d6c0aeea80745371dcc25482f8c/attribution.mjs)
were used unchanged. A local operator harness supplied the real receipt, DEV
credentials and provider URL. Native checkout happened in Expo; the example's
browser purchase buttons still use fixtures. Expo finished the native purchase
before the server harness replayed its receipt. This verifies the example's
backend connection, not a single integrated native-checkout-to-fulfillment flow.

## Observed results

| Action                                     | Observed result                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buy on iPhone 13 mini                      | Apple Sandbox purchase verified as `ENTITLED`; native transaction finished.                                                                                                                             |
| Buy on Pixel 2                             | Selected the `premium-year` automatic renewal plan. Google confirmed a test purchase; verification moved from `PENDING_ACKNOWLEDGMENT` to `ENTITLED` after native acknowledgement.                      |
| Send each real receipt through the example | `POST /commerce/v1/purchases/verify`, `POST /commerce/v1/purchases/bind` and `GET /commerce/v1/entitlements` each returned HTTP 200. The paywall handler returned `fulfilled`.                          |
| Verify the same purchase again             | One canonical row per purchase. Apple counter: 16 → 17 → 17. Google counter: 19 → 20 → 20.                                                                                                              |
| Apple renews                               | Real `DID_RENEW` notification produced `subscription.renewed` and `entitlement.granted` events.                                                                                                         |
| Lose the receiver's acknowledgement        | The receiver saved the renewal, then returned 503. IAPKit's scheduled worker retried the same body; the receiver returned 202 without another row or amount.                                            |
| Cancel Apple renewal                       | Real `AUTO_RENEW_DISABLED` notification produced `subscription.canceled`. Paid access remained available until expiry.                                                                                  |
| Apple subscription expires                 | Real `EXPIRED` notification produced `subscription.expired` and `entitlement.revoked`. The example's access read returned false.                                                                        |
| Resubscribe on Apple                       | Real `SUBSCRIBED / RESUBSCRIBE` notification produced `subscription.recovered` and a new entitlement grant. Access returned, then ended after another cancellation and expiry.                          |
| Restart the receiver                       | All seven then-saved events and the attribution report survived the process restart unchanged. Later deliveries continued.                                                                              |
| Cancel Google renewal                      | Google reported `SUBSCRIPTION_STATE_CANCELED`; paid access remained available. Notification synchronization was not connected.                                                                          |
| Google subscription expires                | Google reported `SUBSCRIPTION_STATE_EXPIRED`. The protocol returned no entitlements and the example's access read returned false. This checked expiry-time access filtering, not notification delivery. |

The final Apple report contained ten lifecycle events. Its known gross amount
was KRW 14,000 from one renewal. The resubscription was marked **reconcile with
store**, so it was not silently counted as another known charge. This report is
not a complete revenue ledger, MRR or ARPU calculation.

## Apply this check to your implementation

1. Run the [example's reproducible checks](./paywall-provider-reproduction.md)
   first. Those checks use fixture store responses; report them separately.
2. Configure your own development purchase backend, sandbox app and event
   receiver. Use a server credential for bind/access requests and a separate
   signing secret for the receiver. Keep both off the device.
3. Buy through the native SDK. On your server, pass the actual receipt and
   authenticated test user to the protocol's verify, bind and entitlement APIs.
   Record successful fulfillment before the host app finishes or acknowledges
   the purchase. Require the backend's access decision to unlock your app.
4. Register the store's sandbox notification URL and your backend's outbound
   receiver. Cancel, renew and expire test subscriptions. Match each store
   notification to the normalized event, receiver row and access decision.
5. Return 503 once after saving an event. Let the real delivery worker retry,
   then restart your receiver. Require one saved event and one amount.
6. Revoke temporary credentials and remove temporary notification routes.
   Passing the example alone does not verify your app's login or fulfillment.

## Limits of this run

- Google Pub/Sub setup stopped at operator reauthentication. No Google RTDN,
  Google outbound lifecycle delivery or authentication bypass was used. Without
  notifications, the backend's renewal metadata had not yet reflected the
  cancellation. Access ended at the saved expiry time; Google lifecycle events
  still need a connected notification path.
- The first Apple `INITIAL_BUY` notification was not captured; the later
  `RESUBSCRIBE` notification was captured. A test notification only checked
  delivery configuration and is not purchase evidence.
- Refunds, chargebacks, production purchases, a third-party analytics product
  and revenue reconciliation were not exercised.
- The operator used a configured DEV account. This does not test customer
  onboarding, production identity, migration or load.

The run also exposed incorrect plan/price selection in the Expo example. The
[fix and regression tests](https://github.com/hyodotdev/openiap/commit/10ae84dc0498f9e226c33e44fa4e6852ca124a27)
select one Google offer, show the regular Apple price and display the Apple
billing period. The Google plan picker was exercised on Pixel; the corrected
Apple price and period were checked in a rebuilt iPhone app.

After the run, the temporary server key was revoked, the outbound destination
disabled, and the Apple sandbox notification settings restored. The public
tunnel and local test servers were stopped. Production notification settings
were unchanged.
