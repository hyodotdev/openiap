# Receipt Validation FAQ

## When should I perform receipt validation?

Run validation immediately after your app receives a purchase receipt and again at any time the purchase state matters - unlocking premium content, restoring purchases on a new device, or reconciling renewals. A Purchases row records the store state observed by its latest verification; it is not a live subscription watcher. Apple App Store Server Notifications and Google Play RTDN flow into IAPKit and keep its subscription snapshot current; read that snapshot from the entitlement endpoints, and revalidate when you need a fresh purchase state. On Android, verify the purchase, finish it, then verify the token again when the Purchases log must reflect the completed acknowledgment.

## Why should I perform receipt validation?

Receipts are the only authoritative source for whether a customer actually paid. Validating every transaction with a trusted server protects revenue by detecting refunded, duplicated, or jailbroken transactions before your app unlocks local access or your backend serves paid resources. It also gives you consistent purchase metadata for analytics, entitlement systems, and customer support because each validation returns normalized data across Apple, Google, Meta Horizon, and Amazon.

## What is receipt validation?

Receipt validation is the process of sending a store-issued purchase token (Apple receipt, Google purchase token, Horizon entitlement data, Amazon receipt ID, etc.) to a trusted server so it can verify the signature or entitlement with the source store, confirm product identifiers, amounts, and expiration, and return a definitive truth about the purchase. IAPKit abstracts supported store APIs behind a single REST endpoint and webhooks so your app can treat every purchase in the same way.

## Doesn't App Store or Google Play perform this securely already?

Store providers guarantee receipts or entitlement responses according to their own platform rules, but validation still needs trusted server infrastructure instead of the device alone. Relying on local client state leaves you exposed to replayed receipts, tampered sandbox environments, and revoked subscriptions that the device hasn’t synced yet. Managed validation through IAPKit closes that gap by calling the official store APIs and giving you auditable logs if a store ever disputes a transaction.

## Will this prevent tools like Lucky Patcher?

Lucky Patcher-style tools only work when the purchase flow is trusted on-device. Because IAPKit never trusts local client state, every transaction is verified directly with the source store before your app unlocks access or your backend grants an entitlement. A patched app can fake UI states, but it cannot forge store-issued receipts or entitlement responses, so the validation step fails and the fraudulent purchase is rejected. Combine this with periodic revalidation to catch any attempts that slip through while the client is offline.

## Do you track consumption state of consumable IAPs?

Partly, and it depends on the store. Google Play reports consumption state, so a consumed Google consumable comes back with state `CONSUMED` and `isValid: false`. Apple and Amazon do not report consumption after purchase, so their consumables stay `READY_TO_CONSUME` with `isValid: true` and your app has to record fulfillment itself.
