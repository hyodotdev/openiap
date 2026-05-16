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

| Scope     | Package/Library                    |
| --------- | ---------------------------------- |
| `apple`   | `packages/apple`                   |
| `google`  | `packages/google`                  |
| `spec`    | `packages/gql`                     |
| `docs`    | `packages/docs`                    |
| `rn`      | `libraries/react-native-iap`       |
| `expo`    | `libraries/expo-iap`               |
| `flutter` | `libraries/flutter_inapp_purchase` |
| `kmp`     | `libraries/kmp-iap`                |
| `godot`   | `libraries/godot-iap`              |

### Common Tags

| Tag         | Usage                           |
| ----------- | ------------------------------- |
| `feat:`     | New feature                     |
| `fix:`      | Bug fix                         |
| `docs:`     | Documentation changes           |
| `style:`    | Code style changes (formatting) |
| `refactor:` | Code refactoring                |
| `test:`     | Adding or updating tests        |
| `chore:`    | Maintenance tasks               |

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
3. Creates Git tag `<apple-version>` (bare semver)
4. Builds and tests Swift package
5. Validates and publishes to CocoaPods
6. Creates GitHub Release

**Result:**

- CocoaPods: `pod 'openiap', '~> <apple-version>'`
- Swift Package Manager: `.package(url: "https://github.com/hyodotdev/openiap.git", from: "<apple-version>")`

### Deploying Google Package (Android)

**Via GitHub Actions UI:**

1. Go to Actions -> "Google Release"
2. Click "Run workflow"
3. Enter version (e.g., `<google-version>`)
4. Click "Run workflow"

**What happens:**

1. Updates `openiap-versions.json`
2. Commits version change to main
3. Creates Git tag `google-<google-version>`
4. Builds and tests Android library
5. Publishes to Maven Central
6. Creates GitHub Release with artifacts (AAR, JAR)

**Result:**

- Maven Central: `implementation("io.github.hyochan.openiap:openiap-google:<google-version>")`

### Deploying Documentation

```bash
# From monorepo root
npm run deploy
```

This will:

1. Build and deploy documentation to Vercel
2. Trigger GitHub Actions workflow to:
   - Regenerate types for all platforms
   - Create release artifacts (TypeScript, Dart, Kotlin, Swift)
   - Create Git tag `docs-<spec>`
   - Create GitHub Release with artifacts

`npm run deploy` uses the current `spec` value from
`openiap-versions.json`. To deploy a different spec version, pass it
explicitly:

```bash
npm run deploy 1.2.0
```

---

## Release Tag Conventions

Each package uses a different tag format for GitHub Releases:

| Package      | Tag Format                   | Example                   |
| ------------ | ---------------------------- | ------------------------- |
| Apple        | `{version}` (no prefix)      | `2.1.0`                   |
| Google       | `google-{version}`           | `google-2.1.0`            |
| React Native | `react-native-iap-{version}` | `react-native-iap-15.2.0` |
| Expo         | `expo-iap-{version}`         | `expo-iap-4.1.0`          |
| Flutter      | `flutter-iap-{version}`      | `flutter-iap-9.2.0`       |
| KMP          | `kmp-iap-{version}`          | `kmp-iap-2.2.0`           |
| Godot        | `godot-iap-{version}`        | `godot-iap-2.2.0`         |
| Docs         | `docs-{version}`             | `docs-1.2.0`              |

> **Apple is the exception** — it tags with the bare semver version because
> CocoaPods and Swift Package Manager resolve directly from the Git tag.

### Release Docs Version Guard

When documenting release package versions in
`packages/docs/src/pages/docs/updates/releases.tsx`, do not infer versions from
adjacent release notes or assume every package moved in lockstep.

Use these checks before writing a release list:

| Package      | Metadata / Tag Check                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Apple        | `jq -r '.apple' openiap-versions.json`; tag `{version}`                                                           |
| Google       | `jq -r '.google' openiap-versions.json`; tag `google-{version}`                                                   |
| React Native | `jq -r '.version' libraries/react-native-iap/package.json`; tag `react-native-iap-{version}`                      |
| Expo         | `jq -r '.version' libraries/expo-iap/package.json`; tag `expo-iap-{version}`                                      |
| Flutter      | `awk '/^version:/{print $2}' libraries/flutter_inapp_purchase/pubspec.yaml`; tag `flutter-iap-{version}`          |
| Godot        | `sed -n 's/^version="\\(.*\\)"/\\1/p' libraries/godot-iap/addons/godot-iap/plugin.cfg`; tag `godot-iap-{version}` |
| KMP          | `sed -n 's/^libraryVersion=//p' libraries/kmp-iap/gradle.properties`; tag `kmp-iap-{version}`                     |
| MAUI         | read `<PackageVersion>` from `libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj`; tag `maui-iap-{version}`  |

If the release is not published yet, use planned wording and plain text. If the
release is published, verify the tag exists with `gh release view <tag>` before
linking it. This prevents stale Package Releases tables such as documenting
`maui-iap 1.0.1` when the actual release tag is `maui-iap-1.0.2`.

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
- GQL releases update `spec` version
- Deploy script (`npm run deploy`) uses the current `spec` version by default,
  and updates `spec` only when an explicit version is passed

The manifest is only for the shared spec and native platform packages:
`spec`, `google`, and `apple`. Framework library package versions
(`react-native-iap`, `expo-iap`, `flutter_inapp_purchase`, `godot-iap`,
`kmp-iap`, `maui-iap`) must stay in each library's own package metadata and
release workflow, not as extra keys in `openiap-versions.json`.

Manual edits will cause version conflicts and deployment issues. Always use the GitHub Actions workflows or deploy script to update versions.

**Why this matters:** If a feature PR sets `apple: "2.1.1"` manually, and then CI auto-bumps on release, CI sees "current is 2.1.1" and bumps to 2.1.2 — skipping 2.1.1 entirely. The published tag becomes 2.1.2 with no 2.1.1 ever existing.

**Rule:** Feature PRs must NEVER touch version fields in `openiap-versions.json`. Version bumps happen only via:

1. Release workflows (Apple Release, Google Release)
2. Deploy script (`npm run deploy`, optionally `npm run deploy <version>`)
3. CI auto-bump after merge
