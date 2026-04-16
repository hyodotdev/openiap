# Git Conventions & Deployment

> **Priority: MANDATORY**
> Follow these conventions for all commits and deployments.

## Git Commit Message Format

### Rules

- **50 characters max** for the subject line (tag + scope + message combined)
- Everything after the tag MUST be lowercase
- No trailing period
- Use imperative mood ("add" not "added")

### With Tag and Scope

When a commit targets a specific package or library, include the scope:

```text
feat(rn): add offer redemption
fix(expo): resolve purchase crash
fix(flutter): correct discount mapping
feat(kmp): add subscription flow
chore(godot): bump openiap dep
fix(apple): handle StoreKit edge case
fix(google): update billing client
```

### Without Scope

For cross-cutting or monorepo-wide changes:

```text
feat: add RC promote to releases
fix: update repo URLs in package.json
chore: update CI workflow names
```

### Without Tag Prefix

First letter MUST be uppercase:

```text
Add user authentication system
Fix purchase validation error
```

### Scope Reference

| Scope | Package/Library |
|-------|----------------|
| `apple` | `packages/apple` |
| `google` | `packages/google` |
| `spec` | `packages/gql` |
| `docs` | `packages/docs` |
| `rn` | `libraries/react-native-iap` |
| `expo` | `libraries/expo-iap` |
| `flutter` | `libraries/flutter_inapp_purchase` |
| `kmp` | `libraries/kmp-iap` |
| `godot` | `libraries/godot-iap` |

### Common Tags

| Tag | Usage |
|-----|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation changes |
| `style:` | Code style changes (formatting) |
| `refactor:` | Code refactoring |
| `test:` | Adding or updating tests |
| `chore:` | Maintenance tasks |

---

## Deployment

### Deploying Apple Package (iOS/macOS)

**Via GitHub Actions UI:**

1. Go to Actions -> "Apple Release"
2. Click "Run workflow"
3. Enter version (e.g., `1.2.24`)
4. Click "Run workflow"

**What happens:**
1. Updates `openiap-versions.json`
2. Commits version change to main
3. Creates Git tag `apple-v1.2.24`
4. Builds and tests Swift package
5. Validates and publishes to CocoaPods
6. Creates GitHub Release

**Result:**
- CocoaPods: `pod 'openiap', '~> 1.2.24'`
- Swift Package Manager: `.package(url: "https://github.com/hyodotdev/openiap.git", from: "1.2.24")`

### Deploying Google Package (Android)

**Via GitHub Actions UI:**

1. Go to Actions -> "Google Release"
2. Click "Run workflow"
3. Enter version (e.g., `1.2.14`)
4. Click "Run workflow"

**What happens:**
1. Updates `openiap-versions.json`
2. Commits version change to main
3. Creates Git tag `google-v1.2.14`
4. Builds and tests Android library
5. Publishes to Maven Central
6. Creates GitHub Release with artifacts (AAR, JAR)

**Result:**
- Maven Central: `implementation("io.github.hyochan.openiap:openiap-google:1.2.14")`

### Deploying Documentation

```bash
# From monorepo root
npm run deploy 1.2.0
```

This will:
1. Build and deploy documentation to Vercel
2. Trigger GitHub Actions workflow to:
   - Regenerate types for all platforms
   - Create release artifacts (TypeScript, Dart, Kotlin, Swift)
   - Create Git tag `v1.2.0`
   - Create GitHub Release with artifacts

---

## Release Tag Conventions

Each package uses a different tag format for GitHub Releases:

| Package | Tag Format | Example |
|---------|-----------|---------|
| Apple | `{version}` (no prefix) | `2.1.0` |
| Google | `google-{version}` | `google-2.1.0` |
| React Native | `react-native-iap-{version}` | `react-native-iap-15.2.0` |
| Expo | `expo-iap-{version}` | `expo-iap-4.1.0` |
| Flutter | `flutter-iap-{version}` | `flutter-iap-9.2.0` |
| KMP | `kmp-iap-{version}` | `kmp-iap-2.2.0` |
| Godot | `godot-iap-{version}` | `godot-iap-2.2.0` |
| Docs | `docs-{version}` | `docs-1.2.0` |

> **Apple is the exception** — it tags with the bare semver version because
> CocoaPods and Swift Package Manager resolve directly from the Git tag.

---

## Important Notes

- **Deprecated repositories**: `openiap-apple` and `openiap-google` are no longer used
- **Monorepo only**: All releases are now managed from this monorepo
- **Separate versioning**: Apple and Google packages have independent versions
- **Swift Package Manager**: Automatically works via Git tags, no separate deployment step

---

## Version File Management

### openiap-versions.json

**CRITICAL: NEVER manually edit `openiap-versions.json`**

This file is automatically managed by CI/CD workflows during releases:
- Apple releases update `apple` version
- Google releases update `google` version
- GQL releases update `gql` and `docs` versions

Manual edits will cause version conflicts and deployment issues. Always use the GitHub Actions workflows to update versions.
