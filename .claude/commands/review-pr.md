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

After the fix batch is pushed (once per round, not per comment), trigger a fresh round of automated review:

```bash
# Re-request Copilot review (note: capital C; the bot login is literally "Copilot")
gh api -X POST "repos/hyodotdev/openiap/pulls/$PR_NUMBER/requested_reviewers" \
  -f 'reviewers[]=Copilot'

# Kick off a new Gemini review pass
gh pr comment "$PR_NUMBER" --body "/gemini review"
```

Both are idempotent-ish — Copilot re-request is a no-op if still pending and re-requests if a review was already submitted; `/gemini review` always starts a new pass. Run both so the next polling cycle has something to find.

## Polling Loop (after fix batch)

The automated reviewers (Copilot + Gemini) need a few minutes to produce feedback. After pushing a round of fixes and posting `/gemini review`, schedule a wake-up in **~480 seconds (8 minutes)** and re-enter `/review-pr $PR_NUMBER` to:

1. Re-fetch unresolved review threads (`gh api repos/{owner}/{repo}/pulls/$PR_NUMBER/comments`).
2. If new unresolved threads exist → fix them, push, post `/gemini review` again, and schedule another 8-minute wake-up.
3. If no new unresolved threads exist → the PR is clean. End the loop and report completion to the user.

Use the `ScheduleWakeup` tool for the wake-up, passing `/review-pr $PR_NUMBER` back as the prompt so the next firing re-enters this skill with full context. Omit the call to stop the loop once all threads are resolved.

Guard against infinite loops: if a reviewer keeps flagging the same finding after two fix attempts, stop scheduling wake-ups and hand back to the user with a summary of what remains disputed.

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
