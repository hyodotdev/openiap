---
name: commit
description: Branch, commit, push, and optionally open a pull request for the current changes. Use when the user asks to commit, push, or create a PR, including forms like `/commit --all --pr`.
---

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
- `<path>`: Commit only specific path (e.g., `specs/openiap/client`)

## Examples

```bash
# Full workflow: commit gql spec, push, create PR
/commit specs/openiap/client/src/*.graphql --pr

# Commit all and create PR
/commit --all --pr

# Just commit specific path
/commit packages/apple
```

## Complete Workflow

### Public GitHub Language Guard

Before creating or editing commits or a pull request, apply the English-only
public communication policy in
`knowledge/internal/06-git-deployment.md#public-github-communication-language`.
Inspect the complete commit message, PR title, and PR body before sending them.

### Internal Workflow Guard

If the staged changes only touch internal agent/workflow files, do not push or
create a PR unless the user explicitly asked to publish, PR, or merge them.
Internal workflow files include `.claude/commands/`, `.claude/skills/`,
`.codex/skills/`, `.cursor/rules/`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and
agent automation notes.

For those internal-only changes, prefer a local commit or local working-tree
change and report the files changed. If the user explicitly asks to open or
merge a PR anyway, add appropriate labels before merging.

### 1. Check Branch

```bash
# Check current branch
git branch --show-current
```

**If on `main` or `next`** → Create a feature branch first:

```bash
git checkout -b feat/<feature-name>
```

**If on another semantic feature branch** → Proceed with commits directly.

**Branch naming conventions:**

- **Do not use generic agent/tool prefixes** such as `codex/`, `claude/`, or
  `agent/` for OpenIAP branches, even if the local tool suggests one.
- **Use a semantic prefix** that describes the change type: `feat/`, `fix/`,
  `ci/`, `docs/`, `test/`, `chore/`, or `refactor/`.
- **Always include the target library/package name** in the branch name
- `next` is reserved for on-demand prerelease integration. Do not commit
  feature work directly to it; release workflows may commit RC metadata there.
- `feat/<library>-<feature-name>` - New features (e.g., `feat/godot-win-back-offers`)
- `fix/<library>-<bug-description>` - Bug fixes (e.g., `fix/expo-double-init`)
- `ci/<library>-<workflow-change>` - CI/workflow changes (e.g., `ci/kmp-store-e2e`)
- `docs/<library>-<doc-update>` - Documentation only (e.g., `docs/flutter-api-reference`)
- `test/<library>-<test-change>` - Test/e2e changes (e.g., `test/maui-store-e2e`)
- `chore/<library>-<task>` - Maintenance tasks (e.g., `chore/kmp-bump-deps`)
- `refactor/<library>-<change>` - Refactors (e.g., `refactor/google-store-flavors`)

**Library shortnames:**

- `rn` or `react-native` → react-native-iap
- `expo` → expo-iap
- `flutter` → flutter_inapp_purchase
- `godot` → godot-iap
- `kmp` → kmp-iap
- `gql` → specs/openiap/client
- `apple` → packages/apple
- `google` → packages/google
- `docs` → packages/docs

### 2. Check Current Status

```bash
git status
git diff --name-only
```

### 3. Stage Changes

**GQL schema only (FIRST COMMIT):**

```bash
git add specs/openiap/client/src/*.graphql
```

**Generated types (SECOND COMMIT):**

```bash
git add specs/openiap/client/src/generated/
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

| Type       | Description           |
| ---------- | --------------------- |
| `feat`     | New feature           |
| `fix`      | Bug fix               |
| `docs`     | Documentation only    |
| `refactor` | Code refactoring      |
| `chore`    | Maintenance tasks     |
| `test`     | Adding/updating tests |

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

Use `main` as the default base. Use `next` only when the maintainer explicitly
requested a prerelease train. Never target prerelease version-only commits at
`main`.

```bash
PR_BASE=main # set to next only for an explicit prerelease train
gh pr create --base "$PR_BASE" --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
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

### 7a. Upload Preview Recording

For every PR that adds a new feature, visible behavior change, UI change,
documentation page, example flow, or developer workflow, record a preview before
handoff:

1. Render the actual changed surface after implementation. Use the Codex Chrome
   Extension for web/docs/dashboard previews.
2. Compress the final recording to **under 10 MB**. Prefer H.264 MP4 with lower
   resolution / frame rate when needed.
3. Upload the compressed recording to the GitHub PR as a PR body attachment or a
   clearly labeled attached `Preview` comment.
   Never commit one-off PR preview recordings, including under
   `.github/pr-previews/`. Create them in a temporary or ignored local path,
   upload them as GitHub attachments, verify the attachment, then delete the
   local files. Only commit media that is itself product documentation or an
   example asset intended to ship with the repository.
   If browser or extension permissions block the attachment, stop and ask the
   maintainer to enable file uploads; do not force-add the recording as a Git
   fallback.
4. Link/embed the GitHub-hosted recording in the PR body or preview comment.

If there is no visual or interactive surface, add a short PR note explaining why
recording is not applicable and include the best terminal/API proof instead.
Never include secrets, private customer data, or browser profile details in the
recording.

### 8. Add Labels to PR

After creating the PR, add appropriate labels based on the changes.
First list available labels with `gh label list`, then add matching ones:

```bash
gh pr edit <PR_NUMBER> --add-label "<label1>,<label2>"
```

**Label selection guide:**

- Changes to `packages/apple/` → `📱 iOS`
- Changes to `packages/google/` → `🤖 android`
- Changes to `packages/docs/` → `📖 documentation`
- Changes to `specs/openiap/client/` → `⬡ gql`
- Changes to `libraries/react-native-iap/` → `react-native-iap`
- Changes to `libraries/expo-iap/` → `expo-iap`
- Changes to `libraries/flutter_inapp_purchase/` → `flutter-iap`
- Changes to `libraries/godot-iap/` → `godot-iap`
- Changes to `libraries/kmp-iap/` → `kmp-iap`
- Changes across multiple platforms → `cross-platform`
- New features → `🎯 feature`
- PR bug fixes → `🛠 bugfix`
- Breaking changes → `⚡️ breaking`
- Documentation only → `📖 documentation`
- CI/CD changes → `💨 ci`
- Refactoring → `፦ refactor`

---

## Commit Order (CRITICAL)

When making cross-package changes, commit in this order:

| Order | Path                          | Description                              |
| ----- | ----------------------------- | ---------------------------------------- |
| 1     | `specs/openiap/client/src/*.graphql`  | GraphQL schema ONLY (no generated types) |
| 2     | `specs/openiap/client/src/generated/` | Generated types (after schema review)    |
| 3     | `packages/apple/`             | iOS implementation                       |
| 4     | `packages/google/`            | Android implementation                   |
| 5     | `packages/docs/`              | Documentation updates                    |
| 6     | `.claude/commands/`           | Skill/workflow updates                   |
| 7     | `knowledge/`                  | Knowledge base updates                   |

**IMPORTANT - First Commit Must Be GQL Spec Only:**

```bash
# Stage ONLY .graphql files (not generated/)
git add specs/openiap/client/src/*.graphql

# Verify - should only show .graphql files
git diff --cached --name-only
# specs/openiap/client/src/type-android.graphql
# specs/openiap/client/src/type-ios.graphql
# specs/openiap/client/src/type.graphql

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

---

## Example PR Body

```markdown
## Summary

- Add Win-Back offers support for iOS 18+
- Add ProductStatusAndroid for Billing 8.0+ status codes
- Add JWS promotional offers for WWDC 2025

## Changes

### GraphQL Schema (specs/openiap/client)

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
- [x] `./gradlew :openiap:compileAmazonDebugKotlin` passes
- [x] `bun run typecheck` passes (docs)

🤖 Generated with [Claude Code](https://claude.ai/code)
```

---

## Quick Reference

```bash
# Full workflow from main
git checkout -b feat/my-feature
git add specs/openiap/client/src/*.graphql
git commit -m "feat(gql): add new types"
git add specs/openiap/client/src/generated/
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
