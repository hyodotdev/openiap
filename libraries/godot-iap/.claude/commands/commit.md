# Commit Changes

Complete workflow: branch → commit → push → PR

## Usage

```
/commit [options]
```

**Options:**
- `--push` or `-p`: Push to remote after commit
- `--pr`: Create PR after push
- `--all` or `-a`: Commit all changes at once
- `<path>`: Commit only specific path (e.g., `android`, `ios-gdextension`)

## Examples

```bash
# Full workflow: commit iOS changes, push, create PR
/commit ios-gdextension --pr

# Commit all and create PR
/commit --all --pr

# Just commit specific path
/commit android
```

## Complete Workflow

### 1. Check Branch

```bash
# Check current branch
git branch --show-current
```

**If on `main`** → Create a feature branch first:
```bash
git checkout -b feat/<feature-name>
```

**If NOT on `main`** → Proceed with commits directly.

**Branch naming conventions:**
- `feat/<feature-name>` - New features
- `fix/<bug-description>` - Bug fixes
- `docs/<doc-update>` - Documentation only
- `chore/<task>` - Maintenance tasks

### 2. Check Current Status

```bash
git status
git diff --name-only
```

### 3. Stage Changes

**Android plugin:**
```bash
git add android/
```

**iOS plugin:**
```bash
git add ios-gdextension/
```

**GDScript plugin files:**
```bash
git add addons/godot-iap/
```

**Example project:**
```bash
git add Example/
```

**All changes:**
```bash
git add .
```

### 4. Review Staged Changes

```bash
git diff --cached --stat
git diff --cached --name-only
```

### 5. Create Commit

Follow conventional commit format:

```bash
git commit -m "$(cat <<'EOF'
<type>(<scope>): <description>

<body - what changed and why>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

**Commit Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code refactoring |
| `chore` | Maintenance tasks |
| `test` | Adding/updating tests |

**Scope Examples:**
- `android` - Android Kotlin plugin
- `ios` - iOS Swift GDExtension
- `gdscript` - GDScript plugin files
- `example` - Example project
- `docs` - Documentation
- `build` - Build configuration

### 6. Push to Remote

```bash
git push -u origin <branch-name>
```

### 7. Create Pull Request

```bash
gh pr create --title "<type>(<scope>): <description>" --body "$(cat <<'EOF'
## Summary

<1-3 bullet points describing changes>

## Changes

### <Category 1>
- Change 1
- Change 2

### <Category 2>
- Change 1

## Test plan

- [ ] Android: `./gradlew assembleRelease` succeeds
- [ ] iOS: `swift build` succeeds
- [ ] Example project runs in Godot editor

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

---

## Commit Order (CRITICAL)

When making cross-platform changes, commit in this order:

| Order | Path | Description |
|-------|------|-------------|
| 1 | `addons/godot-iap/types.gd` | Type definitions (synced from OpenIAP) |
| 2 | `addons/godot-iap/*.gd` | GDScript interface files |
| 3 | `android/` | Android Kotlin implementation |
| 4 | `ios-gdextension/` | iOS Swift GDExtension implementation |
| 5 | `Example/` | Example project updates |
| 6 | `docs/` | Documentation updates |
| 7 | `.claude/` | Claude skills/guides updates |

**IMPORTANT - Type changes first:**
```bash
# Stage ONLY types.gd if types changed
git add addons/godot-iap/types.gd

# Verify - should only show types.gd
git diff --cached --name-only
# addons/godot-iap/types.gd

# Commit type changes
git commit -m "feat(gdscript): sync types from OpenIAP v1.x.x"
```

This order allows:
- Types to be reviewed first before implementation
- Platform implementations to follow the approved types
- Example project to demonstrate the implementation
- Documentation to reflect final implementation

---

## Example Commit Messages

**Types update (synced from OpenIAP):**
```
feat(gdscript): sync types from OpenIAP v1.3.16

- Update ProductAndroid with productStatusAndroid field
- Add WinBackOfferInputIOS for iOS 18+ support
- Update RequestPurchaseProps with new offer options

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Android implementation:**
```
feat(android): implement product status handling

- Add productStatusAndroid field mapping from BillingResult
- Handle NOT_FOUND and NO_OFFERS_AVAILABLE status codes
- Update fetchProducts to include status in response

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**iOS implementation:**
```
feat(ios): implement win-back offers for iOS 18+

- Add winBackOffer parameter in requestPurchase
- Implement StoreKit 2 winBackOffer handling
- Add availability check for iOS 18+

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**GDScript plugin update:**
```
feat(gdscript): add win-back offer support

- Update godot_iap_plugin.gd with win_back_offer parameter
- Add platform detection for iOS 18+ feature
- Update signal handlers for new purchase flow

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Example project:**
```
docs(example): add win-back offer demo

- Add UI button for win-back offer purchase
- Show win-back offer availability in product list
- Update main.gd with new purchase flow

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

**Build/dependency update:**
```
chore(build): update openiap-google to v1.3.24

- Update openiap-versions.json
- Run sync-versions.sh to propagate changes
- Update build.gradle.kts dependency

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

---

## Example PR Body

```markdown
## Summary

- Add win-back offers support for iOS 18+
- Update Android product status handling
- Sync types from OpenIAP v1.3.16

## Changes

### Types (addons/godot-iap)
- `types.gd` - Synced from OpenIAP with new fields

### Android (android/)
- Implement productStatusAndroid field mapping
- Handle new BillingResult status codes

### iOS (ios-gdextension/)
- Add win-back offer handling in purchase flow
- Implement iOS 18+ feature availability check

### Example (Example/)
- Add UI for testing win-back offers
- Update main.gd with new purchase parameters

## Test plan

- [x] Android: `./gradlew assembleRelease` succeeds
- [x] iOS: `swift build` succeeds
- [x] Example project runs in Godot editor
- [ ] Manual test on Android device
- [ ] Manual test on iOS device

🤖 Generated with [Claude Code](https://claude.ai/code)
```

---

## Quick Reference

```bash
# Full workflow from main
git checkout -b feat/my-feature
git add addons/godot-iap/types.gd
git commit -m "feat(gdscript): sync types from OpenIAP"
git add android/
git commit -m "feat(android): implement new feature"
git add ios-gdextension/
git commit -m "feat(ios): implement new feature"
git add addons/godot-iap/
git commit -m "feat(gdscript): update plugin interface"
git add Example/
git commit -m "docs(example): add feature demo"
git add .
git commit -m "chore: update docs and config"
git push -u origin feat/my-feature
gh pr create --title "feat: add new feature" --body "..."
```

---

## Version Bump (Release Only)

When preparing a release:

1. Update version in `addons/godot-iap/plugin.cfg`
2. Update `openiap-versions.json` if dependencies changed
3. Run `./scripts/sync-versions.sh`
4. Commit with `chore(release): bump version to x.x.x`
