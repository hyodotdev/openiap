# Resolve Issue

Analyze a GitHub issue, add labels, and either fix it with a PR or comment with analysis.

## Usage

```text
/resolve-issue <ISSUE_NUMBER_OR_URL>
```

## Examples

```text
/resolve-issue 88
/resolve-issue https://github.com/hyodotdev/openiap/issues/88
```

## Arguments

- `$ARGUMENTS` - Issue number (e.g., `88`) or issue URL

## Instructions

When this command is executed, perform the following:

### 1. Gather Issue Information

```bash
# Get issue details
gh issue view $ARGUMENTS --repo hyodotdev/openiap --json number,title,body,state,labels,author,comments

# Check if there are related PRs
gh pr list --repo hyodotdev/openiap --search "issue:$ISSUE_NUMBER" --json number,title,state
```

### 2. Add Labels

Based on the issue content, add appropriate labels:

```bash
gh issue edit $ISSUE_NUMBER --repo hyodotdev/openiap --add-label "<label1>,<label2>"
```

**Label selection guide:**

| Condition | Label |
|-----------|-------|
| Bug report / crash | `🐛 bug` |
| New feature request | `🎯 feature` |
| Mentions `packages/apple` or iOS | `📱 iOS` |
| Mentions `packages/google` or Android | `🤖 android` |
| Mentions `packages/docs` | `📖 documentation` |
| Mentions `packages/gql` | `⬡ gql` |
| Mentions `react-native-iap` | `react-native-iap` |
| Mentions `expo-iap` | `expo-iap` |
| Mentions `flutter_inapp_purchase` | `flutter-iap` |
| Mentions `godot-iap` | `godot-iap` |
| Mentions `kmp-iap` | `kmp-iap` |
| Affects multiple platforms | `cross-platform` |
| Breaking change | `⚡️ breaking` |

### 3. Analyze and Decide

Classify the issue:

- **Fixable now** → Proceed to Step 4 (create fix PR)
- **Needs more info** → Comment asking for clarification
- **Feature request / discussion** → Comment with analysis and feasibility assessment
- **Already fixed** → Comment with the fix reference and close
- **Out of scope / won't fix** → Comment explaining why

### 4. Fix and Create PR (if fixable)

#### 4a. Create a fix branch

Branch naming must include the target library/package:

```bash
git checkout main && git pull
git checkout -b fix/<library>-<short-description>
```

#### 4b. Investigate and fix

1. Read the relevant code mentioned in the issue
2. Understand the root cause
3. Implement the fix
4. Run appropriate build/test commands based on changed packages:

| Package | Commands |
|---------|----------|
| `packages/gql/` | `cd packages/gql && bun run lint && bun run typecheck` |
| `packages/docs/` | `cd packages/docs && bun run lint && bun run typecheck` |
| `packages/apple/` | `cd packages/apple && swift build` |
| `packages/google/` | `cd packages/google && ./gradlew :openiap:compilePlayDebugKotlin && ./gradlew :openiap:compileHorizonDebugKotlin` |
| `libraries/react-native-iap/` | `cd libraries/react-native-iap && yarn typecheck && yarn lint` |
| `libraries/expo-iap/` | `cd libraries/expo-iap && bun run typecheck && bun run lint` |
| `libraries/flutter_inapp_purchase/` | `cd libraries/flutter_inapp_purchase && flutter analyze && flutter test` |
| `libraries/kmp-iap/` | `cd libraries/kmp-iap && ./gradlew :library:build` |

#### 4c. Commit and push

```bash
git add <files>
git commit -m "fix(<scope>): <description>

Closes #$ISSUE_NUMBER

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
git push -u origin <branch-name>
```

#### 4d. Create PR

```bash
gh pr create --title "fix(<scope>): <description>" --body "$(cat <<'EOF'
## Summary

<1-3 bullet points>

Closes #$ISSUE_NUMBER

## Test plan

- [ ] Build passes
- [ ] Relevant tests pass

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

### 5. Comment on the Issue

Always comment on the issue with your findings:

**If fixed with PR:**
```bash
gh issue comment $ISSUE_NUMBER --repo hyodotdev/openiap --body "$(cat <<'EOF'
<Root cause analysis>

Fix is up in #<PR_NUMBER>.

**Note:** This repository (OpenIAP monorepo) handles development for all framework libraries from the versions listed below. For earlier versions, refer to the archived individual repositories.

- react-native-iap v15.0.0+
- expo-iap v4.0.0+
- flutter_inapp_purchase v9.0.0+
- godot-iap v2.0.0+
- kmp-iap v2.0.0+
EOF
)"
```

**If needs more info:**
```bash
gh issue comment $ISSUE_NUMBER --repo hyodotdev/openiap --body "<questions and what info is needed>"
```

### 6. Report

Summarize what was done:
- Issue classification
- Labels added
- Action taken (PR created / comment posted / closed)
- Link to PR if created
