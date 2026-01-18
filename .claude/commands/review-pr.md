# Review PR Comments

Automated workflow to review, fix, and respond to PR review comments.

## Arguments

- `$ARGUMENTS` - PR number (e.g., `65`) or PR URL

## Workflow

```text
1. Fetch PR review threads
         ↓
2. Analyze each unresolved comment
         ↓
3. For each comment:
   ├─ Valid → Fix code, commit, resolve thread
   └─ Invalid → Add reply comment explaining why
         ↓
4. Run tests to verify fixes
         ↓
5. Push all changes
```

## Steps

### 1. Parse PR Number

Extract PR number from argument:
- If URL: `https://github.com/hyodotdev/openiap/pull/65` → `65`
- If number: `65` → `65`

### 2. Fetch Unresolved Review Threads

```bash
gh api graphql -f query='
query {
  repository(owner: "hyodotdev", name: "openiap") {
    pullRequest(number: PR_NUMBER) {
      reviewThreads(first: 50) {
        nodes {
          id
          isResolved
          path
          line
          comments(first: 10) {
            nodes {
              id
              body
              author { login }
            }
          }
        }
      }
    }
  }
}'
```

### 3. Analyze Each Review Comment

For each unresolved thread, determine:

**A. Is the review comment valid?**
- Does it point to a real issue in the code?
- Is the suggested fix correct?
- Does it align with project conventions (check CLAUDE.md, CONVENTION.md)?

**B. Classification:**

| Type | Action |
|------|--------|
| Valid bug/issue | Fix the code |
| Valid improvement | Fix the code |
| Valid style issue | Fix the code |
| Incorrect suggestion | Reply with explanation |
| Misunderstanding | Reply with clarification |
| Already fixed | Resolve thread |
| Out of scope | Reply explaining scope |

### 4. Handle Valid Reviews

For valid review comments:

1. **Read the file** mentioned in the review
2. **Understand the issue** from the comment
3. **Fix the code** following project conventions
4. **Verify** the fix doesn't break anything
5. **Mark for commit** (collect all fixes)

### 5. Handle Invalid Reviews

For invalid/incorrect review comments, add a reply:

```bash
gh api graphql -f query='
mutation {
  addPullRequestReviewComment(input: {
    pullRequestReviewThreadId: "THREAD_ID",
    body: "YOUR_REPLY_MESSAGE"
  }) {
    comment { id }
  }
}'
```

**Reply templates:**

- **Incorrect suggestion:**
  > "This suggestion would actually cause [issue]. The current implementation is correct because [reason]."

- **Misunderstanding:**
  > "I think there may be a misunderstanding here. [Clarification of how the code works]."

- **Already fixed:**
  > "This has been addressed in commit [hash]."

- **Out of scope:**
  > "This is outside the scope of this PR. Created issue #XX to track this separately."

- **Disagree with style:**
  > "This follows the project convention defined in [CLAUDE.md/CONVENTION.md]. [Quote relevant section]."

### 6. Commit and Push Fixes

After fixing all valid issues:

```bash
# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "fix: address PR review comments

- [List each fix made]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push to remote
git push
```

### 7. Run Tests

Verify fixes don't break anything:

```bash
# Run relevant tests based on changed files
bun test                           # scripts/agent tests
cd packages/gql && bun run typecheck  # TypeScript
cd packages/apple && swift build      # Swift
cd packages/google && ./gradlew :openiap:compileDebugKotlin  # Kotlin
```

### 8. Resolve Fixed Threads

For each thread that was fixed:

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "THREAD_ID"}) {
    thread { id }
  }
}'
```

## Decision Tree

```text
Review Comment
     │
     ├─► Is it a valid issue?
     │        │
     │        ├─► YES: Can we fix it?
     │        │        │
     │        │        ├─► YES → Fix code, resolve thread
     │        │        └─► NO (out of scope) → Reply, don't resolve
     │        │
     │        └─► NO: Why is it invalid?
     │                 │
     │                 ├─► Wrong suggestion → Reply with correction
     │                 ├─► Misunderstanding → Reply with clarification
     │                 └─► Style preference → Reply citing conventions
     │
     └─► Is it already fixed?
              │
              └─► YES → Resolve thread
```

## Example Usage

```bash
# By PR number
/review-pr 65

# By PR URL
/review-pr https://github.com/hyodotdev/openiap/pull/65
```

## Output Summary

After running, provide a summary:

```markdown
## PR Review Summary

**PR:** #65
**Threads processed:** 12

### Fixed (8)
- ✅ `scripts/agent/README.md:7` - Added language tag to code block
- ✅ `scripts/agent/agent-coder.ts:56` - Fixed path resolution
- ...

### Replied (2)
- 💬 `packages/gql/schema.graphql:42` - Disagreed: follows project convention
- 💬 `packages/apple/Sources/OpenIap.swift:15` - Out of scope for this PR

### Already Resolved (2)
- ⏭️ `CLAUDE.md:85` - Was fixed in previous commit

### Commits
- `abc1234` - fix: address PR review comments (8 files)

### Tests
- ✅ 48 tests passing
- ✅ TypeScript typecheck passed
```

## Important Notes

1. **Always read before fixing** - Never suggest fixes without reading the actual code
2. **Check conventions** - Reference CLAUDE.md and package CONVENTION.md files
3. **Be respectful** - When disagreeing, explain clearly and cite sources
4. **Don't over-fix** - Only fix what the review asks for, don't add extra changes
5. **Test before resolving** - Ensure fixes don't break anything
6. **Group commits** - Batch related fixes into logical commits
