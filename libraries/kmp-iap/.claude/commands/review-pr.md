# Review PR Comments

Review and address PR review comments for this repository.

> **Note:** This extends the global `/review-pr` command with project-specific checks.

## Arguments

- `$ARGUMENTS` - PR number (e.g., `32`) or PR URL

## Project-Specific Build Commands

Based on changed files, run these checks BEFORE committing:

| Path | Commands |
|------|----------|
| `library/src/commonMain/` | `./gradlew :library:build` |
| `library/src/iosMain/` | `./gradlew :library:build` |
| `library/src/androidMain/` | `./gradlew :library:build` |
| `library/` (any) | `./gradlew :library:test` |
| `example/` | `./gradlew :example:composeApp:assembleDebug` |
| `docs/` | `cd docs && npm run build` |

**Important:** Always run full library build when changing any platform implementation.

## Project Conventions

When reviewing, check these project-specific rules:

- **IAP naming**: Use `IAP` at end (e.g., `KmpIAP`), use `Iap` when followed by other words (e.g., `kmpIapInstance`)
- **ID naming**: Always use `Id` not `ID` (e.g., `productId`, `transactionId`)
- **iOS types**: Must end with `IOS` suffix (e.g., `PurchaseIOS`, `TransactionStateIOS`)
- **Android types**: Must end with `Android` suffix (e.g., `PurchaseAndroid`, `AndroidPurchaseState`)
- **Platform suffix**: Always suffix, never prefix (`TransactionStateIOS` not `IosTransactionState`)

See [CLAUDE.md](../../CLAUDE.md) for full conventions.

## Auto-Label (CRITICAL)

After reviewing, check if the PR has labels. If no labels are assigned, **automatically add appropriate labels** using `gh pr edit <number> --add-label "<label>"`.

Choose labels based on PR title prefix and changed files:

| PR Title / Change Pattern | Label |
|---------------------------|-------|
| `feat:` or new feature | `:tea: integration` |
| `fix:` or bug fix | `⌚️ regression` |
| `chore:` with dependency/version updates | `:package: update packages` |
| `chore:` other maintenance | `✨ configuration` |
| `docs:` | `:earth_americas: web` |
| `refactor:` | `፦ refactor` |
| `test:` | `testing` |
| UI/UX changes | `:stadium: ui` |
| Type definition changes | `❄️ types` |

If the PR already has labels, skip this step.

## Reply Format Rules (CRITICAL)

When replying to PR comments:

### Commit Hash Formatting

**NEVER wrap commit hashes in backticks or code blocks.** GitHub only auto-links plain text commit hashes.

| Format | Example | Result |
|--------|---------|--------|
| ✅ CORRECT | `Fixed in f3b5fec.` | Clickable link to commit |
| ❌ WRONG | `Fixed in \`f3b5fec\`.` | Plain text, no link |

**Examples of correct replies:**

```text
Fixed in f3b5fec.

**Changes:**
- Updated type naming to follow conventions
```

```text
Fixed in abc1234 along with other review items.
```

**Do NOT use backticks around the commit hash** - this breaks GitHub's auto-linking feature.
