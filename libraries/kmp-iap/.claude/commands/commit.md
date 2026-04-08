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
- `<path>`: Commit only specific path (e.g., `library/src/commonMain`)

## Examples

```bash
# Full workflow: commit library changes, push, create PR
/commit library/ --pr

# Commit all and create PR
/commit --all --pr

# Just commit specific path
/commit library/src/iosMain
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

**Common code (FIRST COMMIT when changing shared API):**
```bash
git add library/src/commonMain/
```

**iOS implementation (SECOND COMMIT):**
```bash
git add library/src/iosMain/
```

**Android implementation (THIRD COMMIT):**
```bash
git add library/src/androidMain/
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
- `common` - Common/shared code changes
- `ios` - iOS implementation
- `android` - Android implementation
- `example` - Example app changes
- `deps` - Dependency updates
- `docs` - Documentation

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

- [ ] `./gradlew :library:build` passes
- [ ] `./gradlew :library:test` passes

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

### 8. Auto-Label PR

After creating the PR, **automatically add a label** based on commit type:

```bash
gh pr edit <number> --add-label "<label>"
```

| Commit Type | Label |
|-------------|-------|
| `feat` | `:tea: integration` |
| `fix` | `⌚️ regression` |
| `chore` (deps/version) | `:package: update packages` |
| `chore` (other) | `✨ configuration` |
| `docs` | `:earth_americas: web` |
| `refactor` | `፦ refactor` |
| `test` | `testing` |

Choose the most appropriate label. If multiple apply, add all relevant ones.

---

## Commit Order (CRITICAL)

When making cross-platform changes, commit in this order:

| Order | Path | Description |
|-------|------|-------------|
| 1 | `library/src/commonMain/` | Common/shared API (expect interfaces) |
| 2 | `library/src/iosMain/` | iOS implementation |
| 3 | `library/src/androidMain/` | Android implementation |
| 4 | `example/` | Example app updates |
| 5 | `docs/` | Documentation updates |
| 6 | `.claude/` | Skills/workflow updates |

**IMPORTANT - First Commit Must Be Common API Only:**
```bash
# Stage ONLY commonMain files
git add library/src/commonMain/

# Verify - should only show commonMain files
git diff --cached --name-only
# library/src/commonMain/kotlin/io/github/hyochan/kmpiap/KmpIAP.kt
# library/src/commonMain/kotlin/io/github/hyochan/kmpiap/types/...

# Commit common API changes
git commit -m "feat(common): add new purchase types..."
```

This order allows:
- API contract to be reviewed first before any implementation
- iOS implementation follows the approved API
- Android implementation follows the approved API
- Example app demonstrates the final implementation

---

## Example Commit Messages

**Common API update:**
```
feat(common): add subscription offer types

- Add SubscriptionOffer data class
- Add PromotionalOffer and IntroductoryOffer types
- Update ProductDetails to include offer information

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**iOS implementation:**
```
feat(ios): implement subscription offers

- Map StoreKit 2 subscription offers to common types
- Add win-back offer support for iOS 18+
- Handle promotional offer signing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Android implementation:**
```
feat(android): implement subscription offers

- Map Google Play Billing subscription offers
- Add base plan and offer token handling
- Support multiple pricing phases

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Dependency update:**
```
chore(deps): update openiap-apple to 1.3.11

Sync with OpenIAP Apple 1.3.11 release:
- Win-back offers support
- JWS promotional offers
- Bug fixes

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Documentation update:**
```
docs: update installation guide

- Add CocoaPods setup instructions
- Fix Gradle configuration examples
- Add troubleshooting section

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Example PR Body

```markdown
## Summary

- Add subscription offer types to common API
- Implement StoreKit 2 offer mapping for iOS
- Implement Google Play Billing offer mapping for Android

## Changes

### Common (library/src/commonMain)
- `SubscriptionOffer` - Common offer representation
- `PromotionalOffer` - Promotional offer details
- `IntroductoryOffer` - Introductory offer details

### iOS (library/src/iosMain)
- Map StoreKit 2 offers to common types
- Support iOS 18+ win-back offers
- Handle promotional offer signing

### Android (library/src/androidMain)
- Map Google Play Billing offers
- Support multi-phase pricing
- Handle offer tokens

## Test plan

- [x] `./gradlew :library:build` passes
- [x] `./gradlew :library:test` passes
- [x] Example app builds and runs on iOS simulator
- [x] Example app builds and runs on Android emulator

🤖 Generated with [Claude Code](https://claude.ai/code)
```

---

## Quick Reference

```bash
# Full workflow from main
git checkout -b feat/my-feature
git add library/src/commonMain/
git commit -m "feat(common): add new types"
git add library/src/iosMain/
git commit -m "feat(ios): implement new types"
git add library/src/androidMain/
git commit -m "feat(android): implement new types"
git add example/
git commit -m "chore(example): update example app"
git add docs/
git commit -m "docs: update documentation"
git add .
git commit -m "chore: update remaining files"
git push -u origin feat/my-feature
gh pr create --title "feat: add new feature" --body "..."
```
