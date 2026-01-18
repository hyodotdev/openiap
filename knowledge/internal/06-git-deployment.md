# Git Conventions & Deployment

> **Priority: MANDATORY**
> Follow these conventions for all commits and deployments.

## Git Commit Message Format

### With Tag Prefix

Everything after the tag MUST be lowercase:

```
feat: add user authentication system
fix: resolve purchase validation error
docs: update API reference
refactor: simplify product fetching logic
test: add subscription validation tests
chore: update dependencies
```

### Without Tag Prefix

First letter MUST be uppercase:

```
Add user authentication system
Fix purchase validation error
Update API reference
```

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
