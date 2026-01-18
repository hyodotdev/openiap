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
   ├─ Valid → Fix code
   └─ Invalid → Add reply comment explaining why (don't resolve)
         ↓
4. Run lint, typecheck, tests (BEFORE commit)
         ↓
5. If all pass → Commit and push
         ↓
6. For each fixed thread:
   ├─ Reply with commit link + what changed
   └─ Resolve thread
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

### 6. Run Lint, Typecheck, Tests (BEFORE Commit)

**CRITICAL**: Always verify fixes don't break anything BEFORE committing:

```bash
# Based on changed files, run relevant checks:

# scripts/agent changes
cd scripts/agent && bun test

# packages/gql changes
cd packages/gql && bun run lint && bun run typecheck

# packages/docs changes
cd packages/docs && bun run lint && bun run typecheck

# packages/apple changes
cd packages/apple && swift build && swift test

# packages/google changes (test BOTH flavors)
cd packages/google && ./gradlew :openiap:compilePlayDebugKotlin && ./gradlew :openiap:compileHorizonDebugKotlin
```

**If any check fails:**
1. Fix the issue
2. Re-run the failing check
3. Only proceed to commit when ALL checks pass

### 7. Commit and Push Fixes

After ALL checks pass, commit the changes:

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

### 8. Resolve Fixed Threads

For each thread that was fixed, **add a reply comment** explaining what was fixed and linking to the commit, then resolve:

**Step 1: Add reply comment with fix details**

```bash
gh api graphql -f query='
mutation {
  addPullRequestReviewThreadReply(input: {
    pullRequestReviewThreadId: "THREAD_ID",
    body: "Fixed in COMMIT_HASH.\n\n**What was changed:**\n- DESCRIPTION_OF_FIX\n\nThanks for catching this!"
  }) {
    comment { id }
  }
}'
```

**Step 2: Resolve the thread**

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input: {threadId: "THREAD_ID"}) {
    thread { id }
  }
}'
```

**Reply templates for fixed threads:**

- **Simple fix:**
  > "Fixed in `abc1234`. Added blank lines around fenced code blocks."

- **Code change:**
  > "Fixed in `abc1234`.\n\n**Changes:**\n- Added guard clause for null check\n- Throws explicit error instead of silent ignore\n\nThanks for the thorough review!"

- **Documentation fix:**
  > "Fixed in `abc1234`. Updated version history to match official release notes."

- **Multiple fixes in one commit:**
  > "Fixed in `abc1234` along with other review items.\n\n**This thread:** Replaced hard-coded paths with placeholders."

## Decision Tree

```text
Review Comment
     │
     ├─► Is it a valid issue?
     │        │
     │        ├─► YES: Can we fix it?
     │        │        │
     │        │        ├─► YES → Fix code, reply with commit link, resolve thread
     │        │        └─► NO (out of scope) → Reply explaining why, don't resolve
     │        │
     │        └─► NO: Why is it invalid?
     │                 │
     │                 ├─► Wrong suggestion → Reply with correction, don't resolve
     │                 ├─► Misunderstanding → Reply with clarification, don't resolve
     │                 └─► Style preference → Reply citing conventions, don't resolve
     │
     └─► Is it already fixed?
              │
              └─► YES → Reply with commit link, resolve thread
```

## Thread Resolution Rules

| Scenario | Reply? | Resolve? | Content |
|----------|--------|----------|---------|
| Fixed the issue | ✅ YES | ✅ YES | Commit link + what changed |
| Already fixed in previous commit | ✅ YES | ✅ YES | Commit link |
| Disagree with suggestion | ✅ YES | ❌ NO | Explanation + reasoning |
| Out of scope | ✅ YES | ❌ NO | Why it's out of scope |
| Misunderstanding | ✅ YES | ❌ NO | Clarification |
| Need more info from reviewer | ✅ YES | ❌ NO | Question for clarification |

**Important:** Never resolve a thread without either:
1. Fixing the issue (with commit link in reply)
2. Getting agreement from the reviewer that it's not needed

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
- ✅ `scripts/agent/README.md:7` - Added language tag to code block → Replied with `abc1234`
- ✅ `scripts/agent/agent-coder.ts:56` - Fixed path resolution → Replied with `abc1234`
- ...

### Replied Only (2) - Not Resolved
- 💬 `packages/gql/schema.graphql:42` - Disagreed: follows project convention (waiting for reviewer response)
- 💬 `packages/apple/Sources/OpenIap.swift:15` - Out of scope for this PR (waiting for reviewer response)

### Already Fixed (2)
- ⏭️ `CLAUDE.md:85` - Was fixed in previous commit `def5678` → Replied and resolved

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
5. **ALWAYS run lint/tsc/tests BEFORE commit** - Never commit if any check fails
6. **Group commits** - Batch related fixes into logical commits
7. **Fix test failures** - If tests fail after your fix, fix the issue before committing
8. **Always reply before resolving** - When fixing an issue, reply with the commit hash and what changed before resolving the thread
9. **Never silent resolve** - Reviewers should be able to see what action was taken on their comment
10. **Link commits** - Use short commit hash (7 chars) with backticks: \`abc1234\`
