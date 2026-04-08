# Review PR Comments

Review and address PR review comments for this repository.

> **Note:** This extends the global `/review-pr` command with project-specific checks.

## Arguments

- `$ARGUMENTS` - PR number (e.g., `12`) or PR URL

## Project-Specific Build Commands

Based on changed files, run these checks BEFORE committing:

| Path | Commands |
|------|----------|
| `android/` | `cd android && ./gradlew assembleRelease` |
| `ios-gdextension/` | `cd ios-gdextension && swift build` |
| `addons/godot-iap/*.gd` | Open Example project in Godot editor to check for parse errors |
| `Example/` | Run Example project in Godot editor |

**Important:** Test BOTH Android and iOS builds when changes affect shared GDScript files.

## Project Conventions

When reviewing, check these project-specific rules:

### Naming Conventions
- **IAP suffix**: Use `IAP` when final (e.g., `GodotIAP`), use `Iap` when followed by words (e.g., `IapManager`)
- **ID**: Always use `Id` (e.g., `productId`, `transactionId`)
- **Platform suffixes**: `IOS` for iOS, `Android` for Android (e.g., `ProductIOS`, `PurchaseAndroid`)

### GDScript Conventions
- Function names: `snake_case`
- Class names: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Use typed parameters and return types from `Types`

### Generated Files
- Do NOT manually edit `addons/godot-iap/types.gd` - it's auto-generated from OpenIAP
- Use `scripts/generate-types.sh` to update types

### Return Type Patterns
- `-> Array` for multiple platform-specific items (Products, Purchases)
- `-> Variant` for single item OR null (Purchase result)
- `-> Types.X` for platform-agnostic types (VoidResult, BoolResult)

See [CLAUDE.md](../../CLAUDE.md) for full conventions.

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
- Updated function to use snake_case naming
```

```text
Fixed in abc1234 along with other review items.
```

**Do NOT use backticks around the commit hash** - this breaks GitHub's auto-linking feature.

## Workflow

1. Fetch PR review comments (code-level comments):

   ```bash
   gh api repos/{owner}/{repo}/pulls/{number}/comments
   ```

   This returns individual review comments with their `id` fields needed for replies.

2. Also fetch general PR comments if needed:

   ```bash
   gh pr view <number> --comments
   ```

3. Review each comment and understand the requested change

4. Make the necessary code changes

5. Run relevant build commands based on changed files

6. Commit with descriptive message referencing the review

7. Push changes

8. Reply to **each individual review comment** using the comment's `id`:

   ```bash
   gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies -X POST -f body="Fixed in abc1234."
   ```

   **CRITICAL:** You MUST include `-X POST` — without it the request defaults to GET and returns 404. Always reply directly to individual comments, NOT as a general PR review comment. Use the `/pulls/comments/{id}/replies` endpoint, NOT `gh pr review --comment`.
