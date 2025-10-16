# OpenIAP Monorepo - Agent Guidelines

This document consolidates guidelines for AI agents working across the OpenIAP monorepo. Different packages may have specific conventions - always check package-specific guidelines.

## Monorepo Structure

```
openiap/
├── packages/
│   ├── docs/          # Documentation site (React/Vite/Vercel)
│   ├── gql/           # GraphQL schema & type generation
│   ├── google/        # Android library
│   └── apple/         # iOS/macOS library
├── scripts/           # Monorepo-wide automation
└── .github/workflows/ # CI/CD workflows
```

## Required Pre-Work

- Before writing or editing anything, load and review the relevant `CONVENTION.md` file in the specific package directory
- For cross-package changes, review conventions for all affected packages

---

# Documentation Site (`packages/docs`)

## API Naming Conventions (expo-iap/react-native-iap)

### Platform-Specific Function Naming

This project follows the expo-iap naming conventions for clarity and consistency:

#### 1. iOS-Specific Functions (IOS suffix)

All iOS-only functions must end with `IOS`:

- `clearTransactionIOS`
- `clearProductsIOS`
- `getStorefrontIOS`
- `getPromotedProductIOS`
- `requestPurchaseOnPromotedProductIOS`
- `getPendingTransactionsIOS`
- `isEligibleForIntroOfferIOS`
- `subscriptionStatusIOS`
- `currentEntitlementIOS`
- `latestTransactionIOS`
- `showManageSubscriptionsIOS`
- `beginRefundRequestIOS`
- `isTransactionVerifiedIOS`
- `getTransactionJwsIOS`
- `getReceiptDataIOS`
- `syncIOS`
- `presentCodeRedemptionSheetIOS`
- `getAppTransactionIOS`

#### 2. Android-Specific Functions (Android suffix)

All Android-only functions must end with `Android`:

- `acknowledgePurchaseAndroid`
- `consumePurchaseAndroid`
- `getPackageNameAndroid`

#### 3. Cross-Platform Functions (No suffix)

Functions available on both platforms have no suffix:

- `fetchProducts` - Get product information
- `requestPurchase` - Initiate purchase
- `getAvailablePurchases` - Get user's purchases
- `finishTransaction` - Complete transaction
- `validateReceipt` - Validate purchase receipt
- `initConnection` - Initialize store connection
- `endConnection` - Close store connection
- `getActiveSubscriptions` - Get active subscriptions
- `hasActiveSubscriptions` - Check subscription status
- `deepLinkToSubscriptions` - Open subscription management
- `getStorefront` - Get storefront metadata

### Naming Rules

1. **Platform Suffixes**:
   - iOS only: `functionNameIOS`
   - Android only: `functionNameAndroid`
   - Cross-platform: no suffix

2. **Action Prefixes**:
   - `get` - Retrieve data (e.g., `getPromotedProductIOS`)
   - `request` - Async operations/requests (e.g., `requestPurchase`)
   - `clear` - Remove/reset (e.g., `clearTransactionIOS`)
   - `is/has` - Boolean checks (e.g., `isEligibleForIntroOfferIOS`)
   - `show/present` - Display UI (e.g., `showManageSubscriptionsIOS`)
   - `begin` - Start a process (e.g., `beginRefundRequestIOS`)
   - `finish/end` - Complete a process (e.g., `finishTransaction`)

3. **URL Anchors**: Use kebab-case for all URL anchors:
   - Function: `fetchProducts` → Anchor: `#fetch-products`
   - Function: `getAppTransactionIOS` → Anchor: `#get-app-transaction-ios`

4. **Search IDs**: Use kebab-case for search modal IDs:
   - Correct: `id: 'request-products'`
   - Incorrect: `id: 'requestproducts'`

### Deprecated Functions

- `buy-promoted-product-ios` → Use `requestPurchaseOnPromotedProductIOS`
- `requestProducts` → Use `fetchProducts`
- `get-storefront-ios` → Use `getStorefront`

## Modal Pattern with Preact Signals

### Global Modal Management

**IMPORTANT**: Modals should be defined once at the app root level and managed via global state using Preact Signals.

#### 1. Signal Definition (`src/lib/signals.ts`)

```typescript
import { signal } from '@preact/signals-react';

// Modal state signal
export const authModalSignal = signal({
  isOpen: false,
});

// Helper functions
export const openAuthModal = () => {
  authModalSignal.value = { isOpen: true };
};

export const closeAuthModal = () => {
  authModalSignal.value = { isOpen: false };
};
```

#### 2. Root Level Setup (`src/App.tsx`)

```typescript
import { AuthModal } from "./components/AuthModal";
import { authModalSignal, closeAuthModal } from "./lib/signals";

export default function App() {
  return (
    <>
      {/* Single modal instance at root */}
      <AuthModal
        isOpen={authModalSignal.value.isOpen}
        onClose={closeAuthModal}
      />
      {/* Rest of your app */}
    </>
  );
}
```

#### 3. Usage in Pages/Components

```typescript
import { openAuthModal } from '../lib/signals';

// In component
<button onClick={openAuthModal}>
  Sign In
</button>
```

## React Component Organization Rules

### 1. Component Structure

#### Shared Components (`src/components/`)

- Place reusable components that are used across multiple pages/features
- If a component is only used in one place, it should be co-located with its parent

#### Scoped Component Pattern

When a component has sub-components that are only used within it, create a folder structure:

```text
// For a component with internal sub-components
src/components/AuthModal/
  ├── index.tsx        // Main AuthModal component
  └── Modal.tsx        // Modal used only within AuthModal

// If Modal is used elsewhere too
src/components/
  ├── AuthModal.tsx    // Main component
  └── Modal.tsx        // Shared modal component
```

### 2. Code Quality Guidelines

#### Component Layout Rules - CRITICAL

**IMPORTANT**: All components must respect parent boundaries. Children must NEVER overflow outside parent containers.

1. **Overflow Prevention**:
   - ALL components must fit within parent boundaries
   - Use `overflow-hidden` on parent containers when necessary
   - Apply `break-words` for text content that might be long
   - Use `whitespace-nowrap` for navigation items to prevent wrapping

2. **Clean Code Practices**:
   - Delete unused components, functions, and imports immediately
   - Don't keep commented-out code
   - Remove unused variables and parameters

### 3. ESLint and TypeScript Guidelines

#### Promise-Returning Functions in Event Handlers

**CRITICAL RULE**: ANY function that returns a Promise must be wrapped with `void` operator when used where a void return is expected.

**✅ Correct Usage**:

```typescript
// ALWAYS use void operator for any promise-returning function
<button onClick={() => void handleClick()}>Click</button>
<button onClick={() => void navigate("/path")}>Navigate</button>
<button onClick={() => void deleteThing({ id })}>Delete</button>
```

**❌ Incorrect Usage**:

```typescript
// DON'T DO THIS - Direct async function
<button onClick={handleClick}>Click</button>
<button onClick={() => navigate("/path")}>Go</button>
```

## Code Formatting

### Pre-commit Checklist

Before committing any changes:

1. Run `npx prettier --write` to format all files
2. **ALWAYS run `npm run lint`** to check for linting issues
3. **ALWAYS run `bun run tsc` or `npm run typecheck`** to check for TypeScript errors
4. Run `npm run build` to ensure no build errors

## Git Commit Message Convention

### Commit Message Format Rules

1. **With Tag Prefix (feat:, fix:, docs:, etc.)**:
   - Everything after the tag MUST be lowercase
   - Example: `feat: add user authentication system`

2. **Without Tag Prefix**:
   - First letter MUST be uppercase
   - Example: `Add user authentication system`

### Common Tags

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

---

# Android Library (`packages/google`)

## Project Layout

- `openiap/`: Android library sources
- `Example/`: Sample application consuming the library
- `scripts/`: Automation (code generation, tooling)
- `CONVENTION.md`: Authoritative engineering conventions

## How To Work Here

1. Start every session by reading `CONVENTION.md`
2. **DO NOT edit generated files**: `openiap/src/main/Types.kt` is auto-generated
3. Put reusable Kotlin helpers in `openiap/src/main/java/dev/hyo/openiap/utils/`
4. Run `./scripts/generate-types.sh` to regenerate types
5. Compile to verify: `./gradlew :openiap:compileDebugKotlin`

## Updating openiap-gql Version

1. Edit `openiap-versions.json` and update the `gql` field
2. Run `./scripts/generate-types.sh` to download and regenerate Types.kt
3. Compile to verify: `./gradlew :openiap:compileDebugKotlin`

## Function Naming Conventions

- **Android-specific functions MUST have `Android` suffix**
- **Cross-platform functions have NO suffix**

### Examples

**✅ Correct**:
```kotlin
// Android-specific
fun acknowledgePurchaseAndroid()
fun consumePurchaseAndroid()
fun getPackageNameAndroid()

// Cross-platform
fun initConnection()
fun fetchProducts()
fun requestPurchase()
```

**❌ Incorrect**:
```kotlin
// Missing Android suffix
fun acknowledgePurchase()  // Should be acknowledgePurchaseAndroid()
```

---

# iOS Library (`packages/apple`)

## Function Naming Conventions

### Platform-Specific Functions

- **iOS-specific functions MUST have `IOS` suffix**
- **Cross-platform functions have NO suffix**

### Examples

**✅ Correct**:

```swift
// iOS-specific functions
func presentCodeRedemptionSheetIOS()
func showManageSubscriptionsIOS()
func deepLinkToSubscriptionsIOS()
func syncIOS()

// Cross-platform functions
func initConnection()
func fetchProducts()
func requestPurchase()
func finishTransaction()
```

**❌ Incorrect**:

```swift
// Missing IOS suffix for iOS-specific
func presentCodeRedemptionSheet()  // Should be presentCodeRedemptionSheetIOS()
```

## Swift Naming Conventions for Acronyms

### General Rule

- **Acronyms should be ALL CAPS only when they appear as a suffix**
- **When acronyms appear at the beginning or middle, use Pascal case**

### Examples

**✅ Correct**:
- `OpenIAP` (Package name: Open at beginning, IAP as suffix)
- `IapManager` (IAP at beginning)
- `IapPurchase` (IAP at beginning)
- `ProductIAP` (IAP as suffix)

**❌ Incorrect**:
- `OpenIap` (should be `OpenIAP` - IAP is suffix)
- `IAPManager` (should be `IapManager`)

## Type Generation

The `Types.swift` file in `Sources/Models/` is **auto-generated** from the OpenIAP GraphQL schema. **DO NOT edit this file directly**.

### Updating Types

```bash
# Generate types using version from openiap-versions.json
./scripts/generate-types.sh

# Or override with environment variable
OPENIAP_GQL_VERSION=1.0.9 ./scripts/generate-types.sh
```

### Version Management

Version is managed in `openiap-versions.json`:

```json
{
  "apple": "1.2.5",
  "gql": "1.0.10"
}
```

**To update GQL types:**
1. Edit `openiap-versions.json` - change `"gql"` version
2. Run `./scripts/generate-types.sh`
3. Run `swift test` to verify compatibility

**To bump Apple package version:**
```bash
./scripts/bump-version.sh [major|minor|patch|x.x.x]
```

## File Organization

### Directory Structure

- **Sources/Models/**: OpenIAP official types matching [openiap.dev/docs/types](https://www.openiap.dev/docs/types)
  - `Product.swift` - ProductIOS and related types
  - `Purchase.swift` - PurchaseIOS and related types
  - `ActiveSubscription.swift`
  - etc.

- **Sources/Helpers/**: Internal helper classes (NOT in OpenIAP official types)
  - `ProductManager.swift` - Thread-safe product caching
  - `IapStatus.swift` - UI status management for SwiftUI

- **Sources/**: Main module files
  - `OpenIapModule.swift` - Core implementation
  - `OpenIapStore.swift` - SwiftUI-friendly store
  - `OpenIapProtocol.swift` - API interface definitions

## Testing

- Run tests: `swift test`
- Build: `swift build`

---

# GraphQL Types Package (`packages/gql`)

## Type Generation

This package generates types for all platforms from the GraphQL schema.

### Generating Types

```bash
cd packages/gql
bun run generate
```

This will generate:
- TypeScript types: `src/generated/types.ts`
- Swift types: `dist/swift/Types.swift`
- Kotlin types: `dist/kotlin/Types.kt`
- Dart types: `dist/dart/types.dart`

### Scripts

- `generate:ts` - Generate TypeScript types
- `generate:swift` - Generate Swift types
- `generate:kotlin` - Generate Kotlin types
- `generate:dart` - Generate Dart types
- `sync` - Sync generated types to platform packages

---

# Deployment

## Deploying to Production

```bash
# From monorepo root
npm run deploy 1.2.0
```

This will:
1. Build and deploy documentation to Vercel (locally)
2. Trigger GitHub Actions workflow to:
   - Regenerate types for all platforms
   - Create release artifacts (TypeScript, Dart, Kotlin, Swift)
   - Create Git tag `v1.2.0`
   - Create GitHub Release with artifacts

## Artifacts for Other Projects

The release artifacts can be used in:
- react-native-iap
- expo-iap
- Any other project needing OpenIAP types

Download artifacts from: https://github.com/hyodotdev/openiap/releases

---

# Universal Conventions

## Commit Message Format

Follow conventional commits:
- **Type must be lowercase**: `feat:`, `fix:`, `docs:`, `refactor:`
- **Description starts lowercase** after colon: `feat: add new feature`

## Pre-commit Requirements

1. Format code with Prettier/formatter
2. Run linter
3. Run type checker
4. Ensure build succeeds
