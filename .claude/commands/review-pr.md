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

## Response Rules (CRITICAL)

**NEVER respond with "will address in a follow-up" or "will fix later".** Fix ALL review comments NOW in the current PR. Every comment must be addressed with a code fix and committed before replying. No exceptions.

For each comment:
1. **Read the code** mentioned in the comment
2. **Fix it** immediately
3. **Commit and push**
4. **Reply directly to the inline review comment** (NOT a general PR comment)
5. **Resolve the conversation** via GraphQL API

### Replying to Inline Review Comments

**CRITICAL:** Always reply to inline review comments using the comment-specific reply API, NOT `gh pr comment`.

```bash
# Step 1: Get inline review comments with their IDs
gh api repos/hyodotdev/openiap/pulls/$PR_NUMBER/comments \
  --jq '.[] | {id: .id, path: .path, line: .line, body: .body[:100]}'

# Step 2: Reply to a specific inline comment
gh api repos/hyodotdev/openiap/pulls/$PR_NUMBER/comments/$COMMENT_ID/replies \
  -X POST -f body="Fixed in $COMMIT_HASH. $DESCRIPTION"
```

**DO NOT use `gh pr comment`** — that creates a general PR comment, not a reply to the review thread.

### Resolving Threads

```bash
# Get unresolved thread IDs
gh api graphql -f query='
query {
  repository(owner: "hyodotdev", name: "openiap") {
    pullRequest(number: $PR_NUMBER) {
      reviewThreads(first: 50) {
        nodes {
          id
          isResolved
          path
          comments(first: 1) {
            nodes { databaseId }
          }
        }
      }
    }
  }
}'

# Resolve a specific thread
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "$THREAD_ID"}) {
    thread { id isResolved }
  }
}'
```

**Thread Resolution Rules:**
- Only resolve threads where code changes have been made and pushed
- Do not resolve threads that are just suggestions for future improvement
- Do not resolve threads awaiting user clarification

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
- Updated header to use bun run generate
```

```text
Fixed in abc1234 along with other review items.
```

**Do NOT use backticks around the commit hash** - this breaks GitHub's auto-linking feature.
