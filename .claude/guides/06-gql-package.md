# GQL Package Guide

Location: `packages/gql/`

## Overview

Central GraphQL schema generating types for all platforms.

## Directory Structure

```text
packages/gql/
├── src/
│   ├── api.graphql              # Main API schema
│   ├── api-ios.graphql          # iOS-specific extensions
│   ├── api-android.graphql      # Android-specific extensions
│   └── generated/
│       ├── types.ts             # TypeScript
│       ├── Types.swift          # Swift
│       ├── Types.kt             # Kotlin
│       └── types.dart           # Dart
└── package.json
```

## Type Generation

```bash
cd packages/gql

bun run generate        # All types
bun run generate:swift  # Swift only
bun run generate:kotlin # Kotlin only
bun run sync            # Copy to packages
```

## Deprecation in GraphQL

```graphql
validateReceipt(options: ReceiptValidationProps!): ReceiptValidationResult!
  @deprecated(reason: "Use verifyPurchase")
```

Generates appropriate annotations for each platform.
