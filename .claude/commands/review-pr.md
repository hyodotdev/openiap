# Review PR Comments

Review and address PR review comments for this repository.

> **Note:** This extends the global `/review-pr` command with project-specific checks.

## Arguments

- `$ARGUMENTS` - PR number (e.g., `65`) or PR URL

## Project-Specific Build Commands

Based on changed files, run these checks BEFORE committing:

| Package            | Commands                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/agent/`   | `cd scripts/agent && bun test`                                                                                                                                   |
| `packages/gql/`    | `cd packages/gql && bun run test`                                                                                                                                |
| `packages/docs/`   | `cd packages/docs && bun run lint && bun run typecheck`                                                                                                          |
| `packages/apple/`  | `cd packages/apple && swift build`                                                                                                                               |
| `packages/google/` | `cd packages/google && ./gradlew :openiap:compilePlayDebugKotlin && ./gradlew :openiap:compileHorizonDebugKotlin && ./gradlew :openiap:compileAmazonDebugKotlin` |

**Important:** For Android, test Play, Horizon, and Amazon flavors.

## Project Conventions

When reviewing, check these project-specific rules:

- **iOS functions**: Must end with `IOS` suffix (e.g., `syncIOS`)
- **Android functions in packages/google**: NO `Android` suffix (it's Android-only)
- **Generated files**: Do NOT edit `packages/apple/Sources/Models/Types.swift` or `packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt`

See [CLAUDE.md](../../CLAUDE.md) and [knowledge/internal/](../../knowledge/internal/) for full conventions.

## Public GitHub Language Guard

Before posting any review reply or PR conversation comment, apply the
English-only public communication policy in
`knowledge/internal/06-git-deployment.md#public-github-communication-language`.
Inspect the complete reply body before sending it; a private maintainer's
language is not the language of the public reply.

## Response Rules (CRITICAL)

**NEVER respond with "will address in a follow-up" or "will fix later".** Fix ALL review comments NOW in the current PR. Every comment must be addressed with a code fix and committed before replying. No exceptions.

**This rule applies to architectural / refactor / "out of scope" findings too.** Phrases like "tracked as a follow-up", "is its own refactor", "belongs in a dedicated PR", "real architectural change", "future enhancement", or "tracking as follow-up rather than landing in this PR" are NOT acceptable replies — they are deferrals dressed up. If the reviewer flagged a real correctness or operational gap, implement the fix in this PR, however much code it takes. Pagination, schema additions, new validators, API rewrites, scheduler-chained mutations — all in scope. Push back ONLY when the finding is wrong on the merits (e.g. a stylistic preference contradicting an existing schema convention), and back the pushback with concrete repo evidence.

If you are tempted to write "tracking as follow-up", stop and implement the fix instead.

For each comment:

1. **Read the code** mentioned in the comment
2. **Fix it** immediately
3. **Commit and push**
4. **Reply directly to the inline review comment** (NOT a general PR comment)
5. **Resolve the conversation** via GraphQL API

After the fix batch is pushed (once per round, not per comment), trigger a fresh round from every automated reviewer wired into this repo:

```bash
# Re-request Copilot review (note: capital C; the bot login is literally "Copilot").
# GOTCHA: if Copilot has already submitted a review on an earlier commit, the
# REST POST below returns HTTP 201 but silently leaves `requested_reviewers`
# empty — it's idempotent against reviewers whose prior review is still on
# record, so a plain re-POST does nothing. The reliable workaround is DELETE
# + POST so GitHub treats it as a fresh request.
gh api -X DELETE "repos/hyodotdev/openiap/pulls/$PR_NUMBER/requested_reviewers" \
  -f 'reviewers[]=Copilot' >/dev/null 2>&1 || true
sleep 2
gh api -X POST "repos/hyodotdev/openiap/pulls/$PR_NUMBER/requested_reviewers" \
  -f 'reviewers[]=Copilot' >/dev/null

# Verify it actually took — GitHub occasionally still drops the re-request
# even after DELETE. If the list is empty, warn so the user can hit "Re-request
# review" in the GitHub UI manually as a last resort (the UI uses a
# privileged endpoint that works even when the API silently no-ops).
if [ -z "$(gh api repos/hyodotdev/openiap/pulls/$PR_NUMBER --jq '.requested_reviewers | map(select(.login == "Copilot")) | .[0].login // empty')" ]; then
  echo "WARN: Copilot re-request didn't stick via API; click Re-request review in the GitHub UI if you need it."
fi

# Kick off a new Gemini review pass
gh pr comment "$PR_NUMBER" --body "/gemini review"

# Kick off a new CodeRabbit review pass
gh pr comment "$PR_NUMBER" --body "@coderabbitai review"
```

`/gemini review` and `@coderabbitai review` are the supported review triggers,
but an accepted command can still return a terminal availability failure.
Inspect the response instead of treating the trigger comment itself as review
success. Copilot's bot is flakier — the DELETE+POST dance is the best
programmatic option, and the verification step flags the cases where manual
intervention is needed so we don't pretend the re-request succeeded when it
silently didn't.

## Automated Reviewer Fallback

External reviewers are useful review inputs, not a completion dependency. If one
or more configured reviewers cannot review the current head, replace the missing
coverage with one complete `$review-self` round.

Treat a reviewer as unavailable for the current head when either condition is
met:

- A terminal review, status, or top-level reply says that review was skipped or
  could not run because of quota, rate limits, billing or credits, file-count or
  diff-size limits, authentication or permissions, service shutdown, or another
  explicit availability failure.
- Two consecutive polling rounds after the request produce neither an actionable
  review nor an in-progress/requested state.

Do not classify a queued, requested, or actively running review as unavailable.
Keep polling it until it completes or meets an unavailable condition.

When fallback is required:

1. Record the affected reviewer names, terminal reasons, and current head SHA.
2. Invoke the current surface's `review-self` skill for **one complete review
   round** against the PR's actual base and current head. The canonical procedure
   is `.codex/skills/review-self/SKILL.md`; Claude Code uses its
   `.claude/skills/review-self/SKILL.md` adapter. Pass the original requirements,
   acceptance criteria, changed-path conventions, and existing commit/push
   authority. Explicitly request one pass so `review-pr` remains the only polling
   owner.
3. Do not let the fallback round re-enter `review-pr`, request reviewers, or
   schedule its own five-minute loop. It may inspect current review/CI evidence,
   but this workflow owns thread handling and polling.
4. Fix and verify every validated finding using the normal response rules. If a
   fix changes the head, request the external reviewers again after the fix batch
   and run fallback again only if they are unavailable for the new head.
5. Mark the unavailable reviewers as covered only after the fallback round is
   clean and its required checks pass. A single complete fallback round may cover
   multiple unavailable reviewers for the same head.

Cache fallback coverage by reviewer failure set and head SHA. Do not repeat an
unchanged self-review on no-op polls. Any head change invalidates the cached
coverage.

Reviewer unavailability alone is neither a blocker nor a clean result. The PR is
clean only after every unavailable reviewer has fallback coverage for the
current head, alongside the normal thread and CI completion gates.

## Polling Loop (after fix batch)

The automated reviewers (Copilot, Gemini, and CodeRabbit) need a few minutes to
produce feedback. After pushing a round of fixes and posting the reviewer
triggers, schedule a wake-up in **~480 seconds (8 minutes)** and re-enter
`/review-pr $PR_NUMBER` to:

1. Re-fetch unresolved review threads (`gh api repos/{owner}/{repo}/pulls/$PR_NUMBER/comments`) and reviewer request/status/review evidence.
2. If new unresolved threads exist → fix them, push, post `/gemini review` again, and schedule another 8-minute wake-up.
3. If a reviewer is unavailable for the current head → run or reuse the
   head-specific `$review-self` fallback above.
4. If no unresolved threads exist, CI is terminal and successful, and every
   unavailable reviewer has clean fallback coverage for the current head → the
   PR is clean. Clean up the temporary review-trigger comments, end the loop,
   and report completion to the user.

Use the `ScheduleWakeup` tool for the wake-up, passing `/review-pr $PR_NUMBER` back as the prompt so the next firing re-enters this skill with full context. Omit the call to stop the loop once all threads are resolved.

Guard against infinite loops: if a reviewer keeps flagging the same finding after two fix attempts, stop scheduling wake-ups and hand back to the user with a summary of what remains disputed.

### Cleanup Review Trigger Comments

When the polling loop ends with no unresolved review threads, delete the temporary top-level comments created only to trigger bot reviews:

- Author comments whose body is exactly `/gemini review`
- Author comments whose body is exactly `@coderabbitai review`
- CodeRabbit top-level "Action performed" replies created by those commands (`CodeRabbit review command invocation`)

Do **not** delete inline review replies, actual reviewer summaries, CodeRabbit walkthrough comments, or any comment containing substantive review feedback. The cleanup is only for command noise left in the PR timeline.

Use the issue comments API because PR conversation comments are issue comments:

```bash
gh api repos/hyodotdev/openiap/issues/$PR_NUMBER/comments --paginate --jq '
  .[]
  | select(
      .body == "/gemini review"
      or .body == "@coderabbitai review"
      or (.user.login == "coderabbitai[bot]" and (.body | contains("CodeRabbit review command invocation")))
    )
  | .id' | while read comment_id; do
  [ -n "$comment_id" ] && gh api -X DELETE "repos/hyodotdev/openiap/issues/comments/$comment_id"
done
```

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

- Resolve threads where code changes have been made and pushed (after posting a reply with the commit hash).
- **Auto-resolve outdated threads only**: GitHub marks a thread as `isOutdated: true` when the underlying code has already shifted out from under the comment, so those findings no longer apply to the current diff. Sweep those without a reply at the start of every round. **Do not** auto-resolve threads just because the last comment is from the author — the reviewer may still need to confirm the fix.
- Do not resolve threads that are just suggestions for future improvement unless explicitly acknowledged.
- Do not resolve threads awaiting user clarification.

Outdated sweep (run once per round before fetching open findings):

```bash
PR_NUMBER=...
gh api graphql -f query='
query($owner:String!,$name:String!,$pr:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$pr) {
      reviewThreads(first:100) {
        nodes { id isResolved isOutdated }
      }
    }
  }
}' -F owner=hyodotdev -F name=openiap -F pr=$PR_NUMBER --jq '
  .data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved == false)
  | select(.isOutdated == true)
  | .id' | while read tid; do
  [ -n "$tid" ] && gh api graphql -f query='
    mutation($id:ID!) {
      resolveReviewThread(input:{threadId:$id}) { thread { id isResolved } }
    }' -F id="$tid" >/dev/null && echo "auto-resolved outdated $tid"
done
```

Threads that the author has already replied to still show up in the "unresolved" list on the next round — that is intentional so the reviewer can confirm the fix landed and either agree (resolve manually / mark fixed) or push back. Resolving them as soon as the author replies would silence legitimate follow-up feedback.

## Reply Format Rules (CRITICAL)

When replying to PR comments:

### Commit Hash Formatting

**NEVER wrap commit hashes in backticks or code blocks.** GitHub only auto-links plain text commit hashes.

| Format     | Example                 | Result                   |
| ---------- | ----------------------- | ------------------------ |
| ✅ CORRECT | `Fixed in f3b5fec.`     | Clickable link to commit |
| ❌ WRONG   | `Fixed in \`f3b5fec\`.` | Plain text, no link      |

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
