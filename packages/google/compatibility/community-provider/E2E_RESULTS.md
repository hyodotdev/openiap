# Common store provider device results

The October 7–8, 2026 run attempted all **30 hardware cells**: seven apps each
on Apple, Play, Amazon and Horizon, plus React Native and Expo on VegaOS.
**22 cells passed a real sandbox purchase, local verification and transaction
completion. Eight purchase cells are blocked**: all seven Horizon checkouts
require real payment, and Vega Expo is blocked by the tester service.
Expo Onside passed its separate build-only check.

## Executed sources and devices

The Apple/Android native packages and compiled local IAPKit server used
`02e91ef4`. Example and Godot Apple bridge repairs were built and exercised
during the run and are committed through
`6421df5e`. The native package and IAPKit implementations did not change in those
repair commits. Each private row records its executed source patch, artifact SHA-256,
correlation id, checkout and lifecycle evidence. Later builds and supplemental
lifecycle checks are recorded separately from the original purchase artifact.
The RN Vega adapter's duplicate success return was later simplified at
`097d5868`; its existing adapter tests, typecheck and lint passed. This
behavior-preserving cleanup is unit-verified separately from the device run.

The devices were a physical iPhone 13 mini (iOS 27), Pixel, Fire tablet,
Quest 3 and Vega device. The private manifest records each serial/UDID.
All thirty cells passed their platform-specific build, installation,
launch and catalog checks. Vega also passed debug and release builds.

Every passing purchase used the locally compiled IAPKit server against the
**development** backend. Apple and Amazon returned `READY_TO_CONSUME`; Play
returned `PENDING_ACKNOWLEDGMENT`. The app then finished or fulfilled the
transaction. Play purchases showed a test payment instrument and their
provider responses contained `testPurchaseContext`; Apple and Amazon used
sandbox/tester receipts.

## Hardware matrix

`PASS` below means purchase, valid local verification and completion.
`BLOCKED` rows still passed the runtime checks described under limits.
Artifact hashes are shortened here; full hashes and device evidence remain
in the private run manifest.

| App          | Store/device    | Purchase | Server correlation id                  | Artifact SHA-256 |
| ------------ | --------------- | -------- | -------------------------------------- | ---------------- |
| Native       | Apple / iPhone  | PASS     | `769bd46e-d81c-4c94-9928-59c94296b20d` | `0b93f413a027`   |
| React Native | Apple / iPhone  | PASS     | `68261615-af01-43ec-8fb9-f9c9f9a708f9` | `d720db09aec0`   |
| Expo         | Apple / iPhone  | PASS     | `b953caaa-5c0d-4d5f-a232-8692fdf270eb` | `e842b9058c7a`   |
| Flutter      | Apple / iPhone  | PASS     | `a7e70b22-96d1-4e4c-9d5e-2310cadac14e` | `f3329ce1063f`   |
| KMP          | Apple / iPhone  | PASS     | `75b10d1b-4dc2-439c-9098-586a1b8d077b` | `de359c56538c`   |
| MAUI         | Apple / iPhone  | PASS     | `98b29c2b-d5de-4994-86cb-cd74ee7fc34b` | `c117bbff3c32`   |
| Godot        | Apple / iPhone  | PASS     | `783f4978-0d45-46a6-85ec-bd201e1a7b39` | `a2cdb1b265aa`   |
| Native       | Play / Pixel    | PASS     | `7f20c591-723b-4a30-b389-da1c6ce04f69` | `f778da856e07`   |
| React Native | Play / Pixel    | PASS     | `d36fb137-00d5-4870-8bcb-a4399cfce75b` | `232cb0aa1a28`   |
| Expo         | Play / Pixel    | PASS     | `d6cb0912-022a-4dd0-9ca3-6899d2ef6652` | `c607a11c2cca`   |
| Flutter      | Play / Pixel    | PASS     | `0912e7b6-0bee-47fe-9fe9-0223f472304e` | `5c62f10b8050`   |
| KMP          | Play / Pixel    | PASS     | `c74070df-57ac-4c6e-83c2-15580dea03d3` | `921714d371e2`   |
| MAUI         | Play / Pixel    | PASS     | `12cfa1fa-f7ed-4a85-8166-41abd3056a87` | `701fc58c5b51`   |
| Godot        | Play / Pixel    | PASS     | `a5cd8b2d-ebb7-4940-9ebe-5a9460e1d60b` | `d1f37722d80e`   |
| Native       | Amazon / Fire   | PASS     | `faae2f41-6586-4f95-9d84-ea40262498cb` | `42d0fc3e7d7f`   |
| React Native | Amazon / Fire   | PASS     | `c0c2b054-47b1-4756-9e11-769280dda782` | `9688bb0759d7`   |
| Expo         | Amazon / Fire   | PASS     | `5924e841-bc02-4f7a-9e23-c90a5cc49bd0` | `d244fe7fb263`   |
| Flutter      | Amazon / Fire   | PASS     | `7dfe279e-eff2-4e37-8a43-1b1114b78c90` | `5fff163f64a3`   |
| KMP          | Amazon / Fire   | PASS     | `c4cdb659-c35a-4712-a0b5-47e9516e6260` | `05e50320c836`   |
| MAUI         | Amazon / Fire   | PASS     | `bfe6e869-5a08-40fe-ad88-0d3ed8deb093` | `ebff9d11b1c7`   |
| Godot        | Amazon / Fire   | PASS     | `8f5a0129-2f15-4f32-8466-c08ec3b5432f` | `3b94164fcbbf`   |
| Native       | Horizon / Quest | BLOCKED  | —                                      | `6992284596d3`   |
| React Native | Horizon / Quest | BLOCKED  | —                                      | `6a2b6f6fa23a`   |
| Expo         | Horizon / Quest | BLOCKED  | —                                      | `adbfe2f4ccf5`   |
| Flutter      | Horizon / Quest | BLOCKED  | —                                      | `9a54d867995b`   |
| KMP          | Horizon / Quest | BLOCKED  | —                                      | `fce5072c38c0`   |
| MAUI         | Horizon / Quest | BLOCKED  | —                                      | `5ae741e1ecc2`   |
| Godot        | Horizon / Quest | BLOCKED  | —                                      | `bd5d44b8385f`   |
| React Native | Amazon / VegaOS | PASS     | `51ad7378-ee91-491c-90ea-d9f00dc74760` | `d75d9e237205`   |
| Expo         | Amazon / VegaOS | BLOCKED  | —                                      | `c6fb8ee304e5`   |

## Supplemental receipts

These checks supplement the matrix without changing its executed sources or
22 passing cells. Both used the same local development IAPKit server.

| App and source          | Channel                          | Result                                     | Server correlation id                  | Artifact SHA-256 |
| ----------------------- | -------------------------------- | ------------------------------------------ | -------------------------------------- | ---------------- |
| Native Play, `a77e4ed3` | Pixel license tester             | Purchase, verification and completion PASS | `c67b8a4e-5498-43b6-b62a-45128be4bc5b` | `b10155ee21d5`   |
| Expo, October 3 LAT93   | Appstore-installed Test2 on Fire | Receipt recovery and completion PASS       | `aaabae46-397e-4700-8001-7f8592ce0ecb` | `0b7a8a7dc403`   |

Native Play displayed a free test order, inserted one valid canonical receipt,
consumed the item and restored only the existing non-consumable. The restore
did not add a row or advance statistics. This checks the merged Play purchase
path; it does not exercise the User Choice external-billing UI.

LAT93's first verification failed while the local server and USB route were
unavailable. Restoring that route and refreshing purchases verified and
finished the same receipt without another checkout. A second user-initiated
purchase also verified and finished (`eaecf3e8-97f5-4f55-a72e-4cf07def695c`).
Each receipt added exactly one canonical row; subscriptions stayed unchanged.
These are old Appstore-distributed source results, not current-source LAT
coverage. The current Fire account remains enrolled, and a backup account's
Test2 invitation was delivered.

## Lifecycle and recovery

- Apple, Play and Fire rows retained the known non-consumable entitlement on
  refreshed and cold-start ownership reads; the finished consumable was absent.
  Empty UI before loading was not counted as an ownership result.
  Supplemental Native and KMP Play/Fire checks captured force-stop and new
  process ids; Native also invoked Restore. All four development snapshots
  were unchanged. KMP's final v4 cold-start builds retain separate artifact
  hashes from its earlier purchase runs.
- Actual purchase-sheet cancellation was exercised. Apple and Play emitted
  their canonical cancellation errors. Horizon checkout was dismissed in all
  seven apps; KMP and MAUI lack a separately captured cancellation callback.
  Amazon App Tester reported its canonical `PurchaseError`; it was not relabeled
  `UserCancelled`.
- The native Apple example left a controlled offline purchase unfinished,
  preserved it across a cold launch, and verified and finished the same
  transaction only after a manual retry. KMP Apple also recovered the same
  unfinished transaction after local-network permission was granted.
- Flutter and MAUI now leave pending purchases and failed local verification
  unfinished. Native-event tests reproduced the previous Flutter failures and
  passed after the repair. Godot's native-event test rejects an invalid local
  result, permits a valid retry of the same id, and never verifies or finishes
  a pending purchase.
- Godot Apple local verification initially decoded the Swift tagged union as
  a flat result and left a valid purchase unfinished. Actual Swift codec tests
  reproduced that loss of validity and receipt fields. The bridge now encodes
  the concrete Apple result. The rebuilt app recovered
  and completed the same unfinished purchase through Local (Device), without
  another IAPKit matrix cell or backend row.
- KMP Play's controlled Local (Device) check rejected that unsupported mode and
  left the purchase unfinished with no new backend row. Cold launch did not
  reemit it, and a later cross-framework attempt did not recover the same token.
  Automatic retry is therefore unverified on that path. The order disappeared
  after the test acknowledgement window; Google's documented
  [three-minute test refund rule](https://developer.android.com/google/play/billing/test#test-consumable-products)
  is a possible explanation, not proof that this order was refunded.

## Limits

- **Horizon:** all seven apps connected, fetched products, reached checkout,
  cancelled it and read owned purchases. Each checkout displayed KRW14 and a
  payment card without a sandbox marker. Confirm was withheld; no Horizon
  receipt verification or completion is claimed. Godot was driven successfully
  on the headset's main display.
- **VegaOS:** React Native purchased, verified, fulfilled and cold-launched.
  A documented notification-state reset made the tester transaction list
  visible; the corresponding user/app/item/time and receipt anchors matched
  a `FULFILLED` record. The original receipt hash is retained separately from
  OCR comparisons. Tester transactions and API response settings were preserved.
  Its additional ownership/restore reads and Expo's purchase attempt were
  blocked by Amazon App Tester `responseCode=3`,
  `ERROR_REL_DB_QUERY_EXEC_STEP_FAILED` (`sqlite3_step: another row available`).
  Reinstalling the same tester version and resetting notification state did not
  fix those SDK calls. Empty history is not a successful restore.
- **Amazon channel:** the seven Fire purchases used App Tester. Registration
  preceded Activity resume in saved logs for all seven Fire apps; each passed
  the corrected registration-order script.
  Script fixtures separately reject late registration; no late-registration
  device failure was induced.
  Separately, Appstore-installed LAT version 93 opened the live foreground
  purchase Activity and cancelled without a verification call or backend change.
  Its later receipt checks passed as recorded above. An initial account-mismatch
  diagnosis incorrectly compared the device's Kindle address with the retail
  account; the actual retail account matched the delivered tester.
  LAT purchases are
  [free for enrolled testers](https://developer.amazon.com/docs/app-testing/live-app-testing-faq.html);
  the displayed price alone is not a blocker. LAT uses production receipt
  services, so that receipt-environment label does not establish a paid order.
  Current-source live-channel coverage still requires distributing its new
  candidate through LAT.
- **Onside:** Expo's unsigned device build embedded OnsideKit 0.7.5, the `onside`
  query scheme and `dev.hyo.martie.onside-auth` callback scheme. This is a
  build-only result, with no Onside runtime purchase claim.
- **Godot Play UI:** the overlay lost some drawing after checkout returned,
  although verification and completion callbacks succeeded. Cold relaunch
  restored the full view before cancellation and owned checks. This observed
  renderer issue remains separate from the successful purchase lifecycle.
- **Subscriptions:** no subscription checkout or controlled renewal scenario
  was initiated. Godot restore incidentally replayed an existing Apple Sandbox
  renewal; it was verified locally and finished without an IAPKit call.
  Development subscription rows and statistical values were unchanged. This replay and
  provider capability/mapper tests do not certify the renewal lifecycle.

## Evidence and independent providers

Matching local `verify_request` records and before/after development snapshots
were checked for each passing row. Canonical identities are unique, validation
and counting flags are true, and statistics agree with newly inserted rows.
Existing-entitlement replays were identified as idempotent updates and excluded
from fresh-purchase counts. Extra recovery/replacement runs are recorded
separately from the thirty-cell matrix.

The private run directory is `/tmp/openiap-e2e-02e91ef4-20261007/`.
`matrix-manifest.json` links each row's screenshots, logs and hashed identities;
`server/sanitized-verifications.json` and `backend/matrix-reconciliation.json`
match all 22 passing correlations to unique new canonical receipts. The full
ledger grew from 270 to 296 rows: 22 matrix purchases and four additional runs.
`backend/evidence-audit.json` covers all 26 additions. Subscription rows and
statistical values stayed unchanged; only the statistics refresh timestamp
advanced, consistent with the existing daily recomputation. Raw receipts, backend
rows, credentials and account details are not committed.

Earlier hardware runs at `63b54bc0`, `c751be8b` and `a45fc4e6` retain their
original private evidence. This table supersedes their matrix status. Failed
initial probes remain in the private history: the discarded native Apple retry
candidate finished an unverified transaction, and a misconfigured Flutter
candidate could not reach the local server. Neither probe is counted as a pass.

Independent fixture checks remain separate from real-store hardware purchases:
see [VERIFICATION.md](VERIFICATION.md) and the fixture [README](README.md).
The [external Amazon example](https://github.com/hyodotdev/openiap-google-amazon-community/blob/aa5736843bf0b8b2e9ea1d13153a25ff7db2a2ce/VERIFICATION.md)
records its six Fire acceptance checks, cancellation and deferred recovery
with `amazon_example`. Its earlier executed input is recorded there; it is not
another cell in this run.
