# Commit Changes

Complete workflow: branch → commit → push → PR

## Usage

```
/commit [options]
```

**Options:**
- `--push` or `-p`: Push to remote after commit
- `--pr`: Create PR after push
- `--all` or `-a`: Commit all changes at once
- `<path>`: Commit only specific path (e.g., `packages/gql`)

## Examples

```bash
# Full workflow: commit gql spec, push, create PR
/commit packages/gql/src/*.graphql --pr

# Commit all and create PR
/commit --all --pr

# Just commit specific path
/commit packages/apple
```

## Complete Workflow

### 1. Check Branch

```bash
# Check current branch
git branch --show-current
```

**If on `main`** → Create a feature branch first:
```bash
git checkout -b feat/<feature-name>
```

**If NOT on `main`** → Proceed with commits directly.

**Branch naming conventions:**
- `feat/<feature-name>` - New features
- `fix/<bug-description>` - Bug fixes
- `docs/<doc-update>` - Documentation only
- `chore/<task>` - Maintenance tasks

### 2. Check Current Status

```bash
git status
git diff --name-only
```

### 3. Stage Changes

**GQL schema only (FIRST COMMIT):**
```bash
git add packages/gql/src/*.graphql
```

**Generated types (SECOND COMMIT):**
```bash
git add packages/gql/src/generated/
```

**Specific path:**
```bash
git add <path>
```

**All changes:**
```bash
git add .
```

### 4. Review Staged Changes

```bash
git diff --cached --stat
git diff --cached --name-only
```

### 5. Create Commit

Follow conventional commit format:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<body - what changed and why>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Commit Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code refactoring |
| `chore` | Maintenance tasks |
| `test` | Adding/updating tests |

**Scope Examples:**
- `gql` - GraphQL schema changes
- `apple` - iOS/macOS package
- `google` - Android package
- `docs` - Documentation site
- `skills` - Claude skills/commands

### 6. Push to Remote

```bash
git push -u origin <branch-name>
```

### 7. Create Pull Request

```bash
gh pr create --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
## Summary

<1-3 bullet points describing changes>

## Changes

### <Category 1>
- Change 1
- Change 2

### <Category 2>
- Change 1

## Test plan

- [ ] Type check passes
- [ ] Tests pass
- [ ] Build succeeds

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

---

## Commit Order (CRITICAL)

When making cross-package changes, commit in this order:

| Order | Path | Description |
|-------|------|-------------|
| 1 | `packages/gql/src/*.graphql` | GraphQL schema ONLY (no generated types) |
| 2 | `packages/gql/src/generated/` | Generated types (after schema review) |
| 3 | `packages/apple/` | iOS implementation |
| 4 | `packages/google/` | Android implementation |
| 5 | `packages/docs/` | Documentation updates |
| 6 | `.claude/commands/` | Skill/workflow updates |
| 7 | `knowledge/` | Knowledge base updates |

**IMPORTANT - First Commit Must Be GQL Spec Only:**
```bash
# Stage ONLY .graphql files (not generated/)
git add packages/gql/src/*.graphql

# Verify - should only show .graphql files
git diff --cached --name-only
# packages/gql/src/type-android.graphql
# packages/gql/src/type-ios.graphql
# packages/gql/src/type.graphql

# Commit schema changes
git commit -m "feat(gql): add new types..."
```

This order allows:
- API schema to be reviewed first before any implementation
- Generated types committed after schema approval
- Platform implementations to follow the approved schema
- Documentation to reflect final implementation

---

## Example Commit Messages

**GQL schema update:**
```
feat(gql): add win-back offer and product status types

iOS (StoreKit 2):
- WinBackOfferInputIOS for iOS 18+ win-back offers
- PromotionalOfferJWSInputIOS for WWDC 2025 JWS format
- SubscriptionOfferTypeIOS.WinBack enum value

Android (Billing 8.0+):
- ProductStatusAndroid enum (OK, NOT_FOUND, NO_OFFERS_AVAILABLE)
- productStatusAndroid field on ProductAndroid

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Generated types:**
```
chore(gql): regenerate types for all platforms

Regenerate TypeScript, Swift, Kotlin, Dart, GDScript types
from updated GraphQL schema.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**iOS implementation:**
```
feat(apple): implement win-back offers and JWS promotional offers

- Add winBackOffer support in requestPurchase/requestSubscription
- Add promotionalOfferJWS for new signature format (iOS 15+)
- Add introductoryOfferEligibility override option
- Update StoreKitTypesBridge for new offer types

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Documentation update:**
```
docs: add release notes and type documentation

- Add release notes for gql 1.3.13, google 1.3.24, apple 1.3.11
- Document ProductStatusAndroid enum in product.tsx
- Document WinBack offer type in offer.tsx
- Update llms.txt with new API information

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Skills update:**
```
chore(skills): enhance sync and audit workflows

- Add documentation checklist to all sync-*.md files
- Add example code requirements to audit-code.md
- Add local dev testing section to sync-expo-iap.md
- Create commit skill for structured commits

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Example PR Body

```markdown
## Summary

- Add Win-Back offers support for iOS 18+
- Add ProductStatusAndroid for Billing 8.0+ status codes
- Add JWS promotional offers for WWDC 2025

## Changes

### GraphQL Schema (packages/gql)
- `WinBackOfferInputIOS` - Win-back offer input type
- `ProductStatusAndroid` - Product fetch status enum
- `PromotionalOfferJWSInputIOS` - JWS format promo offers

### iOS (packages/apple)
- Implement win-back offer handling in purchase flow
- Add JWS promotional offer support (back-deployed to iOS 15)
- Add introductory offer eligibility override

### Android (packages/google)
- Map ProductStatusAndroid from BillingResult
- Return status in fetchProducts response

### Documentation (packages/docs)
- Release notes for v1.3.13
- Type documentation updates
- Example code updates

## Test plan

- [x] `swift build` passes
- [x] `./gradlew :openiap:compilePlayDebugKotlin` passes
- [x] `./gradlew :openiap:compileHorizonDebugKotlin` passes
- [x] `bun run typecheck` passes (docs)

🤖 Generated with [Claude Code](https://claude.ai/code)
```

---

## Quick Reference

```bash
# Full workflow from main
git checkout -b feat/my-feature
git add packages/gql/src/*.graphql
git commit -m "feat(gql): add new types"
git add packages/gql/src/generated/
git commit -m "chore(gql): regenerate types"
git add packages/apple/
git commit -m "feat(apple): implement new types"
git add packages/google/
git commit -m "feat(google): implement new types"
git add packages/docs/
git commit -m "docs: update documentation"
git add .
git commit -m "chore: update skills and knowledge"
git push -u origin feat/my-feature
gh pr create --title "feat: add new feature" --body "..."
```
