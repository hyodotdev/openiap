# Review PR Comments

Review and address PR review comments for this repository.

> **Note:** This extends the global `/review-pr` command with project-specific checks.

## Arguments

- `$ARGUMENTS` - PR number (e.g., `65`) or PR URL

## Project-Specific Build Commands

Based on changed files, run these checks BEFORE committing:

| Package | Commands |
|---------|----------|
| `scripts/agent/` | `cd scripts/agent && bun test` |
| `packages/gql/` | `cd packages/gql && bun run lint && bun run typecheck` |
| `packages/docs/` | `cd packages/docs && bun run lint && bun run typecheck` |
| `packages/apple/` | `cd packages/apple && swift build` |
| `packages/google/` | `./gradlew :openiap:compilePlayDebugKotlin && ./gradlew :openiap:compileHorizonDebugKotlin` |

**Important:** For Android, test BOTH Play and Horizon flavors.

## Project Conventions

When reviewing, check these project-specific rules:
- **iOS functions**: Must end with `IOS` suffix (e.g., `syncIOS`)
- **Android functions in packages/google**: NO `Android` suffix (it's Android-only)
- **Generated files**: Do NOT edit `packages/apple/Sources/Models/Types.swift` or `packages/google/openiap/src/main/Types.kt`

See [CLAUDE.md](../../CLAUDE.md) and [knowledge/internal/](../../knowledge/internal/) for full conventions.

## Reply Format Rules (CRITICAL)

When replying to PR comments:

### Commit Hash Formatting
**NEVER wrap commit hashes in backticks or code blocks.** GitHub only auto-links plain text commit hashes.

| Format | Example | Result |
|--------|---------|--------|
| ✅ CORRECT | `Fixed in f3b5fec.` | Clickable link to commit |
| ❌ WRONG | `Fixed in \`f3b5fec\`.` | Plain text, no link |

**Examples of correct replies:**
```
Fixed in f3b5fec.

**Changes:**
- Updated header to use bun run generate
```

```
Fixed in abc1234 along with other review items.
```

**Do NOT use backticks around the commit hash** - this breaks GitHub's auto-linking feature.
