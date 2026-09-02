# OpenIAP Architecture Principles

> **Priority: MANDATORY**
> Follow these architectural principles in all code.

## Monorepo Structure

```
openiap/
├── packages/
│   ├── conformance/   # Behavioral conformance spec, runner, and reports
│   ├── docs/          # Documentation (React/Vite/Vercel)
│   ├── google/        # Android library (Kotlin)
│   ├── apple/         # iOS/macOS library (Swift)
│   ├── kit/           # Purchase validation + entitlement infrastructure (Fly.io app)
│   └── mcp-server/    # IAPKit MCP server (hosted at kit.openiap.dev/mcp)
├── specs/             # Publishable specifications; never deployed services
│   └── openiap/
│       ├── client/             # Client GraphQL contract + multiplatform code generation
│       └── commerce-protocol/  # Vendor-neutral server-side commerce contract
├── plugins/
│   └── openiap/       # Codex + Claude Code plugin (skills + MCP config)
├── libraries/         # Framework SDK implementations
│   ├── react-native-iap/  # React Native (npm, Yarn 3, Nitro Modules)
│   ├── expo-iap/          # Expo (npm, Bun, Expo Modules)
│   ├── flutter_inapp_purchase/  # Flutter (pub.dev, Dart)
│   ├── godot-iap/         # Godot 4.x (GitHub Release, GDScript)
│   ├── kmp-iap/           # Kotlin Multiplatform (Maven Central)
│   └── maui-iap/          # .NET MAUI / C# (NuGet)
├── knowledge/         # Shared knowledge base (SSOT)
│   ├── internal/      # Project philosophy (HIGHEST PRIORITY)
│   ├── external/      # External API reference
│   ├── _agent-context/   # Compiled context shared by AI assistants
│   └── _claude-context/  # Compatibility link to _agent-context
├── scripts/
│   └── agent/         # RAG Agent scripts
└── .github/workflows/ # CI/CD workflows
```

Libraries reference local `packages/apple` and `packages/google` source directly (not published CocoaPods/Maven artifacts), enabling immediate development without waiting for native releases.

## Directory Ownership Guardrail

Keep each project surface under its canonical owner:

| Content                                          | Canonical location      |
| ------------------------------------------------ | ----------------------- |
| Deployable packages and native implementations   | `packages/<name>/`      |
| Framework SDKs                                   | `libraries/<name>/`     |
| Agent integrations distributed to users          | `plugins/<name>/`       |
| Behavioral conformance spec, runner, and reports | `packages/conformance/` |
| Specifications, generators, and conformance data | `specs/openiap/<name>/` |
| Repository knowledge                             | `knowledge/`            |
| Repository-wide automation                       | `scripts/`              |
| Shared editor settings                           | `.vscode/`              |

- Never create a root directory that duplicates a child of `packages/`,
  `libraries/`, or `plugins/`. For example, use `packages/docs/` and
  `specs/openiap/client/`, never root `docs/` or `gql/`.
- Before adding a top-level directory, search for an existing owner and extend
  it. Add a new root only when no canonical owner fits, and document that owner
  in this section in the same change.
- Keep shared editor settings in root `.vscode/`. Package-specific settings are
  allowed only when they apply exclusively to that package's toolchain.
- Run `bun run audit:layout` after directory changes. Pre-commit and CI enforce
  the same audit; do not weaken it to permit a duplicate owner.

### Specification Distribution Boundary

`specs/` owns contracts and the tools and fixtures that derive portable
artifacts from them. A specification may publish an npm package so consumers
can install its types, schemas, or conformance runner. Publishing that artifact
is distribution, not a service deployment.

Nothing under `specs/` is a hosted runtime. Keep Docker, Fly.io, Vercel, and
other service deployment configuration with the implementation under
`packages/` or `libraries/`. A specification must not read production secrets,
own production data, or run a production migration. `bun run audit:layout`
rejects legacy schema ownership under `packages/gql` and service deployment
manifests under `specs/`.

## Package Responsibilities

### specs/openiap/client

**Purpose:** Authored OpenIAP client API contract and multiplatform type
generation. The publishable package name is `@hyodotdev/openiap`.

- Contains the GraphQL SDL defining the client API and its types
- Generates types for: TypeScript, Swift, Kotlin, Dart, GDScript, C#
- **RULE:** `Types.swift` / `Types.kt` are AUTO-GENERATED. Never edit directly.

```bash
# Regenerate all types
cd specs/openiap/client && bun run generate
```

Generated files:

- TypeScript: `src/generated/types.ts`
- Swift: `src/generated/Types.swift`
- Kotlin: `src/generated/Types.kt`
- Dart: `src/generated/types.dart`
- GDScript: `src/generated/types.gd`
- C#: `src/generated/Types.cs`

### specs/openiap/commerce-protocol

**Purpose:** OpenIAP Commerce Protocol — the vendor-neutral server-side
commerce contract: portable operations (verify, status, entitlements, bind,
erase, capabilities) over REST and GraphQL bindings, plus the normalized event
and webhook contract.

```text
schema/*.graphql                # authored contract layers — edit these
        ↓ assemble-schema.mjs
generated/commerce-protocol.graphql # generated single-file assembly
        ↓ build-json-schemas.mjs / build-bundle.mjs / build-operations.mjs
generated/schemas/*             # JSON Schema validators + offline bundle
generated/bindings/*            # HTTP manifest, executable GraphQL projection
generated/openapi/*             # OpenAPI 3.1 document
generated/vectors/*             # lifecycle + operation conformance vectors
conformance/                    # portable runner + IAPKit-free mock provider
```

The authored source is the `schema/` layers; `commerce-protocol.graphql` is
their generated assembly and is never hand-edited. The SDL uses custom
directives for JSON-only constraints and defines `Query` and `Mutation`
operation roots for the portable server surface, but no `Subscription` root —
the operation surface is bounded request/response, and the compiler rejects a
stream. The client SDK API and server-side commerce contract are siblings under
the OpenIAP specification owner, but they keep independent schema inventories
and generation targets. Never edit files under `generated/` directly.

### packages/apple

**Purpose:** iOS/macOS StoreKit 2 implementation.

Directory structure:

```
Sources/
├── Models/           # Official OpenIAP types (matches openiap.dev/docs/types)
│   ├── Product.swift
│   ├── Purchase.swift
│   ├── ActiveSubscription.swift
│   └── Types.swift   # AUTO-GENERATED - DO NOT EDIT
├── Helpers/          # Internal implementation (NOT public API)
│   ├── ProductManager.swift
│   └── IapStatus.swift
├── OpenIapModule.swift    # Core implementation
├── OpenIapStore.swift     # SwiftUI-friendly store
└── OpenIapProtocol.swift  # API interface definitions
```

### packages/google

**Purpose:** Android billing implementations for Google Play, Meta Horizon, and
Amazon Appstore. Vega OS is a separate JavaScript/Kepler runtime adapter, not an
Android Gradle flavor.

Directory structure:

```
openiap/src/
├── main/java/dev/hyo/openiap/       # Shared contracts and store facade
│   ├── OpenIapProtocol.kt
│   ├── Types.kt                     # AUTO-GENERATED - DO NOT EDIT
│   ├── helpers/
│   ├── listener/
│   └── store/
├── play/java/dev/hyo/openiap/       # Google Play Billing implementation
├── horizon/java/dev/hyo/openiap/    # Meta Horizon implementation
└── amazon/java/dev/hyo/openiap/     # Amazon Appstore implementation
```

### packages/docs

**Purpose:** Documentation site for openiap.dev.

- Built with React + Vite
- Deployed to Vercel
- Contains API reference and guides

## Dependency Flow

### IAPKit webhook boundary

The supported directions are server-to-server only:

```text
Apple ASN v2 / Google RTDN ──► IAPKit state ──► developer backend HTTPS endpoint
```

Outbound commerce delivery runs asynchronously in the bounded Convex worker,
not on the Fly request path. A project owner registers each destination and
chooses its event filter; IAPKit signs normalized payloads and applies bounded
retries and circuit breaking.

IAPKit must not expose a server-to-mobile webhook stream, SSE endpoint,
WebSocket, push relay, or long-poll lifecycle feed. Mobile packages and
framework libraries use bounded request/response verification and scoped reads.
If an app needs immediate push delivery, its authenticated backend owns that
policy and transport.

```
┌──────────────┐
│   specs/     │
│openiap/client│ ──── Generates Types ────┐
└──────────────┘                           │
                                          ▼
                          ┌──────────────────────────┐
                          │                          │
                    ┌─────┴─────┐            ┌───────┴──────┐
                    │ packages/ │            │  packages/   │
                    │   apple   │            │    google    │
                    └───────────┘            └──────────────┘
```

## Module Pattern

### iOS Module (Swift)

```swift
// OpenIapModule.swift
public final class OpenIapModule: NSObject, OpenIapModuleProtocol {
    public static let shared = OpenIapModule()

    private override init() {
        super.init()
    }

    public func fetchProducts(
        _ params: ProductRequest
    ) async throws -> FetchProductsResult
}
```

### Android Module (Kotlin)

```kotlin
// OpenIapModule.kt
class OpenIapModule(
    private val context: Context
) : OpenIapProtocol {
    override val fetchProducts: QueryFetchProductsHandler = { params ->
        when (params.type ?: ProductQueryType.InApp) {
            ProductQueryType.InApp -> FetchProductsResultProducts(emptyList())
            ProductQueryType.Subs -> FetchProductsResultSubscriptions(emptyList())
            ProductQueryType.All -> FetchProductsResultAll(emptyList())
        }
    }
}
```

## Error Handling Pattern

### Swift

```swift
public func fetchProducts(
    _ params: ProductRequest
) async throws -> FetchProductsResult {
    guard !params.skus.isEmpty else {
        let error = makePurchaseError(code: .emptySkuList)
        emitPurchaseError(error)
        throw error
    }
    // ...
}
```

### Kotlin

```kotlin
if (!billingClient.isReady) throw OpenIapError.NotPrepared
if (params.skus.isEmpty()) throw OpenIapError.EmptySkuList

// Preserve the native diagnostic for wrapper SDKs.
throw OpenIapError.PurchaseFailed(debugMessage = billingResult.debugMessage)
```

## Async Pattern

### Swift (async/await)

```swift
// CORRECT - Use async/await
public func fetchProducts(_ params: ProductRequest) async throws -> FetchProductsResult

// INCORRECT - Don't use completion handlers
public func fetchProducts(
    _ params: ProductRequest,
    completion: @escaping (Result<FetchProductsResult, Error>) -> Void
)
```

### Kotlin (Coroutines)

```kotlin
// CORRECT - Use suspend functions
suspend fun fetchProducts(params: ProductRequest): FetchProductsResult

// INCORRECT - Don't use callbacks
fun fetchProducts(
    params: ProductRequest,
    callback: (Result<FetchProductsResult>) -> Unit
)
```

## GraphQL Promise/Future Convention

**CRITICAL**: All async/Promise-returning operations in the GraphQL schema MUST include `# Future` comment above the field definition.

The `# Future` comment tells the type generator to wrap the return type appropriately:

- TypeScript: `Promise<T>`
- Swift: `async`
- Kotlin: `suspend`

```graphql
"""
Check if a billing program is available for the current user
Returns availability result with isAvailable flag
"""
# Future
isBillingProgramAvailableAndroid(program: BillingProgramAndroid!): BillingProgramAvailabilityResultAndroid!
```

**Rule**: If the operation makes network calls, accesses native APIs, or returns data asynchronously, it MUST have `# Future` comment.
