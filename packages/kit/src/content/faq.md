# Receipt Validation FAQ

## When should I perform receipt validation?

Run validation immediately after your client receives a purchase receipt and again at any time the purchase state matters—unlocking premium content, restoring purchases on a new device, or reconciling renewals. IAPKit is designed to handle both real-time checks and scheduled re-validations so you can catch subscriptions that lapse, refunds, or revoked purchases without waiting for user reports.

## Why should I perform receipt validation?

Receipts are the only authoritative source for whether a customer actually paid. Validating every transaction server-side protects revenue by detecting refunded, duplicated, or jailbroken transactions before you grant access. It also gives you consistent purchase metadata for analytics, entitlement systems, and customer support because each validation returns normalized data across Apple and Google.

## What is receipt validation?

Receipt validation is the process of sending a store-issued purchase token (Apple receipt, Google purchase token, Play Billing signature, etc.) to a trusted server so it can verify the signature with Apple or Google, confirm product identifiers, amounts, and expiration, and return a definitive truth about the purchase. IAPKit abstracts the App Store and Play billing APIs behind a single REST endpoint and webhooks so your backend can treat every purchase in the same way.

## Doesn't App Store or Google Play perform this securely already?

Apple and Google guarantee that receipts they issue are cryptographically signed, but they expect developers to validate those receipts on their own infrastructure. Relying on the client alone leaves you exposed to replayed receipts, tampered sandbox environments, and revoked subscriptions that the device hasn’t synced yet. Server-side validation through IAPKit closes that gap by calling the official StoreKit and Google Play APIs, applying fraud heuristics, and giving you auditable logs if the stores ever dispute a transaction.

## Will this prevent tools like Lucky Patcher?

Lucky Patcher-style tools only work when the purchase flow is trusted on-device. Because IAPKit never trusts the client, every transaction is verified directly with Apple and Google before entitlements are granted. A patched app can fake UI states, but it cannot forge the signed receipts that the stores return, so the validation step fails and the fraudulent purchase is rejected. Combine this with periodic revalidation or webhook-driven revocation to catch any attempts that slip through while the client is offline.

## Do you track consumption state of consumable IAPs?

No, we don't. Our API will treat an authentic consumable IAP purchase as valid because it cannot determine whether it has been consumed or not. If you're interested support for tracking consumable status, let us know and we'll put it on our roadmap.
