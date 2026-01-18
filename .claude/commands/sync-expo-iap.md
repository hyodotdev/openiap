# Sync Changes to expo-iap

Synchronize OpenIAP changes to the [expo-iap](https://github.com/hyochan/expo-iap) repository.

**Target Repository:** `$IAP_REPOS_HOME/expo-iap`

> **Note:** Set `IAP_REPOS_HOME` environment variable (see [sync-all-platforms.md](./sync-all-platforms.md#environment-setup))

## Project Overview

- **Package Manager:** Bun
- **Framework:** Expo Module (React Native)
- **Current Version:** Check `package.json`
- **OpenIAP Version Tracking:** `openiap-versions.json`

## Key Files

| File | Purpose | Auto-Generated |
|------|---------|----------------|
| `src/types.ts` | TypeScript types from OpenIAP | YES |
| `src/index.ts` | Main API exports | NO |
| `src/useIAP.ts` | React Hook for IAP | NO |
| `src/modules/ios.ts` | iOS-specific functions | NO |
| `src/modules/android.ts` | Android-specific functions | NO |
| `openiap-versions.json` | Version tracking | NO |

## Sync Steps

### 0. Pull Latest (REQUIRED)

**Always pull the latest code before starting any sync work:**

```bash
cd $IAP_REPOS_HOME/expo-iap
git pull
```

### 1. Sync openiap-versions.json (REQUIRED)

**IMPORTANT:** Before generating types, sync version numbers from openiap monorepo.

```bash
cd $IAP_REPOS_HOME/expo-iap

# Check current versions in openiap monorepo
cat $OPENIAP_HOME/openiap/openiap-versions.json

# Update expo-iap's openiap-versions.json to match:
# - "gql": should match openiap's "gql" version
# - "apple": should match openiap's "apple" version
# - "google": should match openiap's "google" version
```

**Version fields to sync:**
| Field | Source | Purpose |
|-------|--------|---------|
| `gql` | `$OPENIAP_HOME/openiap/openiap-versions.json` | TypeScript types version |
| `apple` | `$OPENIAP_HOME/openiap/openiap-versions.json` | iOS native SDK version |
| `google` | `$OPENIAP_HOME/openiap/openiap-versions.json` | Android native SDK version |

### 2. Type Synchronization

```bash
cd $IAP_REPOS_HOME/expo-iap

# Download and regenerate types (uses versions from openiap-versions.json)
bun run generate:types

# Verify types
bun run typecheck
```

### 3. Native Code Modifications

#### iOS Native Code

**Location:** `ios/`

Key files to update:
- `ios/ExpoIapModule.swift` - Main Expo module implementation
- `ios/ExpoIap.podspec` - CocoaPods spec (update `apple` version dependency)

**When to modify:**
- New iOS-specific API methods added to OpenIAP
- Type conversion changes needed
- StoreKit 2 API changes

**Update workflow:**
```bash
cd $IAP_REPOS_HOME/expo-iap

# 1. Update apple version in openiap-versions.json
# 2. Review openiap/packages/apple/Sources/ for changes
# 3. Update ios/ExpoIapModule.swift accordingly

# Install updated pod
cd example/ios && pod install --repo-update
```

#### Android Native Code

**Location:** `android/src/main/java/`

Key files to update:
- `ExpoIapModule.kt` - Main Expo module implementation
- `build.gradle` - Dependencies (auto-reads `google` version)

**When to modify:**
- New Android-specific API methods added to OpenIAP
- Type conversion changes needed
- Play Billing API changes

**Update workflow:**
```bash
cd $IAP_REPOS_HOME/expo-iap

# 1. Update google version in openiap-versions.json
# 2. Review openiap/packages/google/openiap/src/main/ for changes
# 3. Update android/src/main/java/ accordingly

# Gradle auto-syncs on build
```

### 4. Build & Test Native Code

#### iOS Build Test

```bash
cd $IAP_REPOS_HOME/expo-iap/example

# Clean and prebuild
npx expo prebuild --clean --platform ios

# Install pods
cd ios && pod install --repo-update && cd ..

# Build for simulator
npx expo run:ios --device "iPhone 15 Pro"

# Or build via Xcode
open ios/expoiapexample.xcworkspace
# Build: Cmd+B, Run: Cmd+R
```

#### Android Build Test

```bash
cd $IAP_REPOS_HOME/expo-iap/example

# Clean and prebuild
npx expo prebuild --clean --platform android

# Build debug APK
npx expo run:android

# Or build via Android Studio
# Open android/ folder in Android Studio
# Build > Make Project
```

#### Android Horizon Build (Meta Quest)

```bash
cd $IAP_REPOS_HOME/expo-iap/example

# Enable Horizon flavor in gradle.properties
echo "horizonEnabled=true" >> android/gradle.properties

# Prebuild and build with Horizon
npx expo prebuild --clean --platform android
npx expo run:android

# Revert for Play Store builds
sed -i '' '/horizonEnabled=true/d' android/gradle.properties
```

#### Full Build Matrix

```bash
cd $IAP_REPOS_HOME/expo-iap

# TypeScript build
bun run build

# iOS build
cd example && npx expo run:ios

# Android build (Play Store)
cd example && npx expo run:android

# Android build (Horizon)
cd example && echo "horizonEnabled=true" >> android/gradle.properties && npx expo run:android

# All tests
bun run test
cd example && bun run test
```

### 5. Local OpenIAP Testing (Pre-Deployment)

**IMPORTANT:** expo-iap supports testing local openiap changes before deployment.

#### Enable Local Development

In `example/app.config.ts`:

```typescript
const LOCAL_OPENIAP_PATHS = {
  ios: '<path-to-openiap>/packages/apple',
  android: '<path-to-openiap>/packages/google',
} as const;

export default ({config}: ConfigContext): ExpoConfig => {
  // ...
  const pluginEntries: NonNullable<ExpoConfig['plugins']> = [
    [
      '../app.plugin.js',
      {
        iapkitApiKey: process.env.EXPO_PUBLIC_IAPKIT_API_KEY,
        enableLocalDev: true,  // <-- Enable local openiap
        localPath: {
          ios: LOCAL_OPENIAP_PATHS.ios,
          android: LOCAL_OPENIAP_PATHS.android,
        },
      },
    ],
  ];
  // ...
};
```

#### Local Dev Workflow

```bash
# 1. Make changes in openiap monorepo
cd $OPENIAP_HOME/openiap/packages/apple  # or packages/google

# 2. Enable local dev in expo-iap
cd $IAP_REPOS_HOME/expo-iap/example
# Edit app.config.ts: set enableLocalDev: true

# 3. Prebuild with local sources
npx expo prebuild --clean

# 4. Build and test
npx expo run:ios   # iOS with local openiap-apple
npx expo run:android  # Android with local openiap-google

# 5. After testing, disable local dev before committing
# Edit app.config.ts: set enableLocalDev: false
```

**When to use local dev:**
- Testing new openiap features before release
- Debugging native code issues
- Verifying type generation changes
- Testing breaking changes

### 6. Update Example Code (REQUIRED)

**Location:** `example/app/`

Key example screens:
- `index.tsx` - Home/Overview
- `purchase-flow.tsx` - Purchase flow demo
- `subscription-flow.tsx` - Subscription demo
- `alternative-billing.tsx` - Android alt billing
- `offer-code.tsx` - Promo code redemption

**Example Code Guidelines:**
- Demonstrate ALL new API features with working code
- Show both success and error handling
- Include comments explaining the feature
- Use realistic SKU names and user flows

**Example for new iOS feature (e.g., Win-Back Offer):**

```tsx
// In subscription-flow.tsx
const handleWinBackOffer = async () => {
  try {
    const result = await requestSubscription({
      sku: 'premium_monthly',
      winBackOffer: { offerId: 'winback_50_off' }  // iOS 18+
    });
    console.log('Win-back applied:', result);
  } catch (error) {
    console.error('Win-back failed:', error);
  }
};
```

**Example for new Android feature (e.g., Product Status):**

```tsx
// In purchase-flow.tsx
products.forEach((product) => {
  if (product.productStatusAndroid) {
    switch (product.productStatusAndroid) {
      case 'OK': // Show product
        break;
      case 'NOT_FOUND': // Show error
        break;
      case 'NO_OFFERS_AVAILABLE': // Show ineligible message
        break;
    }
  }
});
```

### 7. Update Tests

**Library Tests:** `src/__tests__/`
**Example Tests:** `example/__tests__/`

```bash
# Run all tests
bun run test

# Run example tests
cd example && bun run test
```

### 8. Update Documentation (REQUIRED)

**Location:** `docs/`
- `docs/docs/api/` - API reference
- `docs/docs/types/` - Type definitions
- `docs/docs/guides/` - Usage guides
- `docs/docs/examples/` - Code examples

**Documentation Checklist:**

For each new feature synced from openiap:

- [ ] **CHANGELOG.md** - Add entry for new version
- [ ] **API docs** - Function added with signature, params, return type
- [ ] **Type docs** - New types documented with all fields explained
- [ ] **Example code** - Working examples in documentation
- [ ] **Platform notes** - Version requirements (e.g., "iOS 18+", "Billing 8.0+")
- [ ] **Migration notes** - Breaking changes documented

**Example Documentation Entry:**

```mdx
## requestSubscription

### Win-Back Offers (iOS 18+)

Win-back offers re-engage churned subscribers:

~~~typescript
await requestSubscription({
  sku: 'premium_monthly',
  winBackOffer: { offerId: 'winback_50_off' }  // iOS 18+
});
~~~
```

### 9. Update llms.txt Files

**Location:** `docs/static/`

Update AI-friendly documentation files when APIs or types change:

- `docs/static/llms.txt` - Quick reference for AI assistants
- `docs/static/llms-full.txt` - Detailed AI reference

**When to update:**
- New API functions added
- Function signatures changed
- New types or enums added
- Usage patterns updated
- Error codes changed

**Content to sync:**
1. Installation commands
2. Core API reference (useIAP hook, direct functions)
3. Key types (Product, Purchase, ErrorCode)
4. Common usage patterns
5. Platform-specific APIs (iOS/Android suffixes)
6. Error handling examples

### 10. Pre-commit Checklist

```bash
bun run lint           # ESLint
bun run typecheck      # TypeScript
bun run test           # Jest
cd example && bun run test  # Example app tests
```

**Full Sync Checklist:**

- [ ] openiap-versions.json synced
- [ ] Types regenerated (`bun run generate:types`)
- [ ] Native code updated (iOS/Android)
- [ ] Example code demonstrates new features
- [ ] Tests pass
- [ ] Documentation updated
- [ ] llms.txt files updated
- [ ] Local dev disabled (`enableLocalDev: false`)

### 11. Commit and Push

After completing all sync steps, create a branch and commit the changes:

```bash
cd $IAP_REPOS_HOME/expo-iap

# Create feature branch with version number
git checkout -b feat/openiap-sync-<gql-version>

# Example: feat/openiap-sync-1.3.12

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: sync with openiap v<gql-version>

- Update openiap-versions.json (gql: <version>, apple: <version>, google: <version>)
- Regenerate TypeScript types
- Update example code for new types
- Update documentation and llms.txt
- Add/update tests for new features

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push to remote
git push -u origin feat/openiap-sync-<gql-version>
```

**Branch naming conventions:**
- Feature sync: `feat/openiap-sync-<version>` (e.g., `feat/openiap-sync-1.3.12`)
- Specific feature: `feat/<feature-name>` (e.g., `feat/discount-offer-types`)
- Bug fix: `fix/<issue-description>` (e.g., `fix/subscription-offer-parsing`)

## Naming Conventions

- **iOS-only:** `functionNameIOS` (e.g., `syncIOS`, `getPromotedProductIOS`)
- **Android-only:** `functionNameAndroid` (e.g., `validateReceiptAndroid`)
- **Cross-platform:** No suffix (e.g., `fetchProducts`, `requestPurchase`)
- **Error codes:** kebab-case (e.g., `'user-cancelled'`)

## Deprecation Check

Search for deprecated patterns:
```bash
cd $IAP_REPOS_HOME/expo-iap
grep -r "@deprecated" src/
grep -r "DEPRECATED" src/
```

Known deprecated functions:
- `requestProducts` -> Use `fetchProducts`
- `validateReceipt` -> Use `verifyPurchase`
- `validateReceiptIOS` -> Use `verifyPurchase`

## Commit Message Format

```text
feat: add discount offer support
fix: resolve iOS purchase verification
docs: update subscription flow guide
```

## References

- **CLAUDE.md:** `$IAP_REPOS_HOME/expo-iap/CLAUDE.md`
- **OpenIAP Docs:** [openiap.dev/docs](https://openiap.dev/docs)
- **expo-iap Docs:** [expo-iap.vercel.app](https://expo-iap.vercel.app)
