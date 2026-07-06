---
name: iapkit-e2e-petgu
description: Use for IAPKit product sync E2E testing in packages/kit with the Petgu React Native app, localhost dashboard, App Store Connect, and Google Play Console. Triggers when verifying kit product/entitlement create, update, delete, pull, push, or store sync behavior with Petgu.
---

# IAPKit Petgu E2E

Use this skill when the user asks to E2E test IAPKit product sync, especially
create/update/delete behavior between `packages/kit`, App Store Connect, and
Google Play Console.

## Default Targets

- OpenIAP repo: `$OPENIAP_REPO` (current checkout; this repo)
- Kit package: `$OPENIAP_REPO/packages/kit`
- Petgu app: `$PETGU_REPO`
- Local dashboard: `$IAPKIT_LOCAL_URL`, default
  `http://127.0.0.1:5174/hyo-dev/project/petgu/products`
- IAPKit project: organization `hyo-dev`, project `petgu`
- iOS app: App Store Connect app `6755113628`
- Android app: Play Console app `4975127121389308944`, package
  `dev.hyo.petgu.app`
- Google service account:
  `iap2-22@martie-c0b27.iam.gserviceaccount.com`

## Safety Rules

- Do not delete real Petgu store product IDs after a sync test unless the user
  explicitly confirms they accept permanent loss of those IDs.
- Apple product IDs cannot be reused in the same app after an IAP is created,
  even if the IAP is deleted. Treat deletion of real iOS products as
  irreversible.
- For cleanup, create temporary SKUs and delete only those temporary SKUs after
  verification. Prefer IDs under `dev.hyo.petgu.codex.*`.
- Keep the final store catalog clean: no temporary SKUs should remain in
  App Store Connect, Play Console, or IAPKit.
- Do not run real purchase flows unless the user explicitly asks. Product
  loading/sync verification is normally enough.

## Standard Workflow

1. Read repository rules before changing code:
   - `$OPENIAP_REPO/AGENTS.md`
   - `$OPENIAP_REPO/packages/kit/CONVENTION.md`
2. Start or use the local kit dashboard on `127.0.0.1:5174`.
3. Use Petgu as the React Native fixture app for product IDs and native billing
   capability checks.
4. Verify store credentials before sync:
   - iOS App Store Connect API key can list/push products.
   - Android Play service account has Petgu app permissions and the app bundle
     includes `com.android.vending.BILLING`.
5. Run kit product sync jobs through Convex for Petgu:
   - dry-run push
   - actual push
   - actual pull
   - create/update/delete using a temporary SKU
6. Check the stores directly:
   - Use Chrome for already-open logged-in Play Console/App Store Connect tabs.
   - Use Play Developer API/App Store Connect API for precise state checks.
7. Cleanup:
   - Delete all temporary test SKUs from IAPKit and upstream stores.
   - Re-run pull to confirm temporary SKUs are gone.
   - Leave real Petgu SKUs intact unless the user confirms irreversible deletion.
8. Run focused verification:
   - `cd $OPENIAP_REPO/packages/kit`
   - `bun run typecheck`
   - `bun run test -- convex/products`
   - `bun run lint:eslint`
   - `cd $PETGU_REPO`
   - `bun install --frozen-lockfile`
   - `bun run type-check`

## Known Good Petgu Products

Use these as the real Petgu catalog baseline:

- `dev.hyo.petgu.lifetime`: non-consumable lifetime unlock
- `dev.hyo.petgu.treats100`: consumable
- `dev.hyo.petgu.premium.monthly`: subscription, `P1M`
- `dev.hyo.petgu.premium.yearly`: subscription, `P1Y`

## Expected Store Behavior

- Android one-time products must have an active `buy` purchase option. Creating
  the product alone is not enough.
- Android pull should preserve a kit-authored `Consumable` type because Play
  does not round-trip the consumable/non-consumable distinction.
- iOS products may remain `Missing Metadata` / kit `Draft` until screenshots,
  review metadata, and version submission requirements are satisfied. This can
  still mean product sync itself succeeded.
- App Store Connect's first IAP/subscription submission must be attached to a
  new app version before it can move past missing metadata.

## Reporting

In the final report, include:

- Convex job IDs and counts for push/pull/delete.
- Whether Chrome/App Store/Play Console showed the expected SKUs.
- Whether temporary SKUs were deleted from both IAPKit and the stores.
- Any permanent store-policy limitation that prevented deletion or recreation.
