# Audit Code Against Knowledge Rules

Automated workflow to check and fix code based on knowledge rules and latest platform APIs.

## Workflow

```
1. Compile knowledge (re-index)
         ↓
2. Fetch latest API docs (WebSearch)
         ↓
3. Analyze code for rule violations
         ↓
4. Identify missing features
         ↓
5. Fix issues found
         ↓
6. Verify fixes
```

## Steps

### 1. Re-compile Knowledge

First, re-index the knowledge base to ensure latest rules are applied:

```bash
cd scripts/agent && bun run compile:ai
```

### 2. Fetch Latest API Documentation

Use WebSearch to get the latest platform API information:

**Google Play Billing Library:**
- Search: "Google Play Billing Library release notes site:developer.android.com"
- Check for new features in latest version (currently 8.x)
- Key areas: one-time products, subscription offers, billing programs

**Apple StoreKit 2:**
- Search: "StoreKit 2 updates site:developer.apple.com"
- Check WWDC announcements for new features
- Key areas: win-back offers, advanced commerce, offer codes

### 3. Analyze Codebase

Check each package against internal rules AND latest API capabilities:

**Packages to analyze:**
- `packages/apple/Sources/` - iOS/macOS Swift code
- `packages/google/openiap/src/main/` - Android Kotlin code
- `packages/gql/src/` - GraphQL schema (API definitions)

**Rules to check (from knowledge/internal/):**
- `01-naming-conventions.md` - Function naming (IOS suffix, no Android suffix in google package)
- `02-architecture.md` - Code organization, file structure
- `03-coding-style.md` - Explicit return types, error handling
- `04-platform-packages.md` - Package-specific rules

### 4. Feature Gap Analysis

Compare current implementation against latest platform APIs:

**Google Play Billing (check packages/gql/src/api-android.graphql):**

| Feature | Version | Check |
|---------|---------|-------|
| One-time products with multiple offers | 8.0 | Is it in schema? |
| Product-level status codes | 8.0 | Returned in fetchProducts? |
| Suspended subscriptions (isSuspended) | 8.1 | Purchase type has it? |
| includeSuspended parameter | 8.1 | getAvailablePurchases supports it? |
| Billing Programs API | 8.2 | isBillingProgramAvailable implemented? |

**StoreKit 2 (check packages/gql/src/api-ios.graphql):**

| Feature | Version | Check |
|---------|---------|-------|
| Win-back offers | iOS 18 | Supported in schema? |
| Consumable transaction history | iOS 18 | getPendingTransactionsIOS returns them? |
| Billing issue messages | iOS 18 | Event listener exists? |
| Advanced Commerce API | iOS 18.4 | AdvancedCommerceProduct type? |
| appTransactionID | iOS 18.4 | In AppTransaction type? |
| Expanded offer codes | iOS 18.4 | For consumables/non-consumables? |

### 5. Analysis Checklist

**Internal Rules Compliance:**

packages/apple (Swift):
- [ ] iOS-specific functions end with `IOS` suffix
- [ ] Cross-platform functions have NO suffix
- [ ] Acronyms follow Swift conventions (IapManager, not IAPManager)
- [ ] Types match OpenIAP specification

packages/google (Kotlin):
- [ ] Functions do NOT have `Android` suffix (it's Android-only package)
- [ ] Cross-platform functions have NO suffix
- [ ] Types.kt is not manually edited (auto-generated)

packages/gql (GraphQL):
- [ ] Async operations have `# Future` comment
- [ ] Generated types are not manually edited
- [ ] Platform-specific APIs have correct suffix

**Latest API Coverage:**
- [ ] Google Play Billing 8.x features implemented
- [ ] StoreKit 2 iOS 18+ features implemented
- [ ] External API docs updated with new features

### 6. Fix Issues

After identifying issues:
1. Read the relevant knowledge file for the rule
2. Read the violating code file
3. Fix the code to comply with the rule
4. For missing features: add to roadmap or implement

### 7. Update External Docs

If new API features are found, update knowledge/external/:
- `google-billing-api.md` - Add new Google Play Billing features
- `storekit2-api.md` - Add new StoreKit 2 features

### 8. Final Verification

```bash
# Type check all packages
cd packages/apple && swift build
cd packages/google && ./gradlew :openiap:compilePlayDebugKotlin && ./gradlew :openiap:compileHorizonDebugKotlin
cd packages/gql && bun run typecheck
```

**Important**: Always test BOTH Google flavors (Play and Horizon).

## Quick Commands

```bash
# Full audit (compile + analyze + report)
cd scripts/agent && bun run compile:ai
```

Then ask Claude to:
- "Search for latest Google Play Billing Library features and compare with our implementation"
- "Search for latest StoreKit 2 iOS 18 features and identify gaps"
- "Analyze packages/apple for naming convention violations and fix them"
- "Check all packages against internal knowledge rules and create fixes"

## Example Usage

Ask Claude Code:

> "Run /audit-code with latest API check"

> "Audit the codebase including latest Google Play Billing 8.x features"

> "Check implementation against latest StoreKit 2 iOS 18.4 APIs"

## Output

After running audit, you should have:

1. **Rule Violations Report** - List of internal rule violations found and fixed
2. **Feature Gap Report** - Missing platform features with implementation status
3. **Updated External Docs** - knowledge/external/ updated with latest API info
4. **Roadmap Items** - New features to implement (if any)
