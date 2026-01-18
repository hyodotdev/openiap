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
