# Apple Package Conventions

This file captures package-local rules for `packages/apple`. The root
`AGENTS.md` and `knowledge/internal/` files remain the source of truth.

## Naming

- iOS-specific public APIs must end with `IOS`.
- Cross-platform APIs must not add a platform suffix.
- Keep Swift acronyms in repo style: `OpenIAP` for the package name, but
  `OpenIapModule`, `OpenIapStore`, and `Iap*` when the acronym appears at the
  beginning or middle of a symbol.

## Generated Types

- Do not edit `Sources/Models/Types.swift` directly.
- Change GraphQL schema in `specs/client/src`, run generation, then sync the
  generated output through the documented monorepo scripts.

## Public API Changes

- When `Sources/OpenIapModule.swift` adds or changes a public async API, update
  `Sources/OpenIapModule+ObjC.swift` in the same change.
- Keep `Sources/OpenIapProtocol.swift`, `OpenIapModule`, `OpenIapStore`, and
  generated handler wiring consistent for any exposed operation.
- Prefer StoreKit 2 async/await APIs and put conversion logic in
  `Sources/Helpers/StoreKitTypesBridge.swift` rather than duplicating mapping
  code in call sites.

## Verification

Run these checks after Apple package changes:

```bash
cd packages/apple
swift build
swift test --filter OpenIapTests
```

## Store Providers

Apple reaches the selected store only through the `OpenIapModule` facade over `OpenIapProvider` Info.plist discovery; the contract, identity rules, and parity checklist live in [02-architecture.md](../../knowledge/internal/02-architecture.md#store-providers) and [04-platform-packages.md](../../knowledge/internal/04-platform-packages.md#provider-identity-and-selection).
