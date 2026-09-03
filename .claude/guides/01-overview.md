# OpenIAP Project Overview

OpenIAP is an open specification that standardizes in-app purchase implementations across platforms.

## Monorepo Structure

```text
openiap/
├── packages/
│   ├── apple/         # iOS/macOS library (Swift, StoreKit 2)
│   ├── google/        # Android library (Kotlin, Play Billing)
│   ├── docs/          # Documentation site (React/Vite)
│   └── kit/           # Hosted receipt-validation SaaS (kit.openiap.dev)
├── specs/
│   ├── client/             # Client GraphQL contract & type generation
│   └── commerce-protocol/  # Server-side Commerce Protocol
├── scripts/           # Monorepo-wide automation
├── .github/workflows/ # CI/CD workflows
├── AGENTS.md          # Canonical shared agent guidelines
└── openiap-versions.json  # Version management
```

## Directory Responsibilities

| Directory                         | Purpose                                                           | Language         | Output                                                           |
| --------------------------------- | ----------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------- |
| `packages/apple`                  | iOS/macOS IAP implementation                                      | Swift            | CocoaPods, SPM                                                   |
| `packages/google`                 | Android IAP implementation                                        | Kotlin           | Maven Central                                                    |
| `specs/client`            | Client contract and generated types                               | GraphQL          | Swift, Kotlin, Dart, TS types; package name `@hyodotdev/openiap` |
| `specs/commerce-protocol` | Server-side Commerce Protocol contract, bindings, and conformance | GraphQL          | Package name `openiap-commerce-protocol`                         |
| `packages/docs`                   | Documentation website                                             | React/TypeScript | Vercel deployment                                                |
| `packages/kit`                    | Hosted receipt-validation SaaS (free, MIT, self-hostable)         | TypeScript       | Fly.io app (`openiap-kit`)                                       |

## Version Management

All versions are tracked in `openiap-versions.json`:

```json
{
  "apple": "1.2.x",
  "google": "1.2.x",
  "spec": "1.2.x"
}
```

## Key Principles

1. **Unified API**: Same function names across all platforms
2. **Platform suffixes**: `IOS` for iOS-only, `Android` for Android-only
3. **Type safety**: Generated types from GraphQL schema
4. **Deprecation over removal**: Keep deprecated APIs, add new ones
