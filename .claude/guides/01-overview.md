# OpenIAP Project Overview

OpenIAP is an open specification that standardizes in-app purchase implementations across platforms.

## Monorepo Structure

```text
openiap/
├── packages/
│   ├── apple/         # iOS/macOS library (Swift, StoreKit 2)
│   ├── google/        # Android library (Kotlin, Play Billing)
│   ├── gql/           # GraphQL schema & type generation
│   └── docs/          # Documentation site (React/Vite)
├── scripts/           # Monorepo-wide automation
├── .github/workflows/ # CI/CD workflows
├── CLAUDE.md          # Main agent guidelines
└── openiap-versions.json  # Version management
```

## Package Responsibilities

| Package  | Purpose                       | Language         | Output                        |
| -------- | ----------------------------- | ---------------- | ----------------------------- |
| `apple`  | iOS/macOS IAP implementation  | Swift            | CocoaPods, SPM                |
| `google` | Android IAP implementation    | Kotlin           | Maven Central                 |
| `gql`    | Type definitions & generation | TypeScript       | Swift, Kotlin, Dart, TS types |
| `docs`   | Documentation website         | React/TypeScript | Vercel deployment             |

## Version Management

All versions are tracked in `openiap-versions.json`:

```json
{
  "apple": "1.2.x",
  "google": "1.2.x",
  "gql": "1.2.x"
}
```

## Key Principles

1. **Unified API**: Same function names across all platforms
2. **Platform suffixes**: `IOS` for iOS-only, `Android` for Android-only
3. **Type safety**: Generated types from GraphQL schema
4. **Deprecation over removal**: Keep deprecated APIs, add new ones
