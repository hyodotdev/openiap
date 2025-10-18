# Contributing to OpenIAP

This guide explains how to contribute to the OpenIAP monorepo.

## 📁 Project Structure

```sh
openiap/
├── packages/
│   ├── gql/          # GraphQL schema & type generation
│   ├── docs/         # Documentation site (openiap.dev)
│   ├── google/       # Android/Kotlin implementation
│   └── apple/        # iOS/Swift implementation
└── package.json      # Workspace configuration
```

## 🚀 Getting Started

### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/hyodotdev/openiap.git
cd openiap

# Install dependencies for all packages
bun install
```

### 2. Development Environment

**Required:**

- [Bun](https://bun.sh/) v1.1.0+

**Optional (platform-specific):**

- For Android: JDK 17+, Gradle
- For iOS: Xcode, Swift 5.9+

## 📦 Packages Overview

### `@hyodotdev/openiap-gql`

GraphQL schema and type generation for all platforms.

```bash
cd packages/gql

# Generate types for all platforms
bun run generate

# Generate for specific platform
bun run generate:ts      # TypeScript
bun run generate:swift   # Swift
bun run generate:kotlin  # Kotlin
bun run generate:dart    # Dart
```

### `@hyodotdev/openiap-docs`

Documentation website at [openiap.dev](https://openiap.dev)

```bash
cd packages/docs

# Development server
bun run dev

# Build for production
bun run build

# Type checking
bun run typecheck
```

### `@hyodotdev/openiap-google`

Android/Kotlin implementation

```bash
cd packages/google

# Generate types from gql
bun run generate:types

# Build the library
bun run build

# Run tests
bun run test
```

### `@hyodotdev/openiap-apple`

iOS/Swift implementation

```bash
cd packages/apple

# Generate types from gql
bun run generate:types

# Build the library
bun run build

# Run tests
bun run test
```

## 📝 Workflow Scenarios

### Scenario 1: Modifying GraphQL Schema

**When:** Adding new types or APIs

```bash
# 1. Navigate to gql package
cd packages/gql

# 2. Edit schema files
# Modify src/*.graphql files

# 3. Generate types
bun run generate

# 4. Verify generated files
ls src/generated/
# → types.ts, Types.kt, Types.swift, types.dart
```

**Generated files:**

- `src/generated/types.ts` - TypeScript
- `src/generated/Types.kt` - Kotlin
- `src/generated/Types.swift` - Swift
- `src/generated/types.dart` - Dart

### Scenario 2: Working on Android (Google)

**When:** Modifying Android app or library

```bash
# 1. Navigate to google package
cd packages/google

# 2. Write Kotlin code
# Work in openiap/src/main/java/dev/hyo/openiap/

# 3. Build and test
./gradlew :openiap:compileDebugKotlin
./gradlew :openiap:test
```

**When types are changed:**

```bash
# Auto-update types after gql schema changes
cd packages/gql
bun run generate
# → Automatically updates Android and iOS types!
```

**Important:**

- `Types.kt` is auto-generated - **DO NOT edit directly**
- Place shared utilities in `openiap/src/main/java/dev/hyo/openiap/utils/`

### Scenario 3: Working on iOS (Apple)

**When:** Modifying iOS app or library

```bash
# 1. Navigate to apple package
cd packages/apple

# 2. Write Swift code
# Work in Sources/ directory

# 3. Build and test
swift build
swift test
```

**When types are changed:**

```bash
# Auto-update types after gql schema changes
cd packages/gql
bun run generate
# → Automatically updates Android and iOS types!
```

**Important:**

- `Sources/Models/Types.swift` is auto-generated - **DO NOT edit directly**
- Place helper classes in `Sources/Helpers/`

### Scenario 4: Updating Documentation

**When:** Updating openiap.dev documentation

```bash
# 1. Navigate to docs package
cd packages/docs

# 2. Start development server
bun run dev
# → http://localhost:5173

# 3. Edit files
# Work in src/ directory

# 4. Type check and build
bun run typecheck
bun run build
```

## 🛠️ Development Tools

### Running Example Apps

**Using VSCode (Recommended):**

Press `F5` or `Cmd+Shift+P` → "Debug: Select and Start Debugging" and choose:

- 🍎 **Open Apple (iOS) in Xcode** - Opens iOS example in Xcode
- 🤖 **Open Google (Android) in Android Studio** - Opens Android example
- 📝 **GQL: Generate Types** - Generates types from GraphQL schema
- 📚 **Docs: Dev Server** - Starts documentation development server

**Manual Commands:**

```bash
# Apple (iOS) - Open in Xcode
cd packages/apple
open Example/Martie.xcodeproj

# Google (Android) - Open in Android Studio
cd packages/google
./scripts/open-android-studio.sh

# Google (Android) - Run from terminal
cd packages/google
./gradlew :Example:installDebug && adb shell am start -n dev.hyo.martie/.MainActivity
```

### Development Scripts

**From Root:**

```bash
# Build all packages
bun run build

# Run dev servers (where applicable)
bun run dev

# Run all tests
bun run test

# Lint all packages
bun run lint

# Clean all node_modules
bun run clean
```

**Package-Specific:**

Each package has its own scripts. See individual `package.json` files for details.

## 📝 Type Generation Flow

```text
GraphQL Schema (packages/gql/src/*.graphql)
           ↓
    Type Generation (bun run generate)
           ↓
    ├─→ TypeScript (src/generated/types.ts)
    ├─→ Swift (src/generated/Types.swift) ──┐
    ├─→ Kotlin (src/generated/Types.kt) ──┐ │
    └─→ Dart (src/generated/types.dart)   │ │
                                          │ │
                 Auto Sync ───────────────┘ │
                                            │
    ┌───────────────────────────────────────┘
    ↓
    ├─→ packages/apple/Sources/Models/Types.swift
    └─→ packages/google/.../openiap/Types.kt (+ post-processing)
```

**Key Feature:** One `generate` command updates all platforms automatically!

## 🔄 Common Workflows

### Adding a New Feature

```bash
# 1. Create a branch
git checkout -b feat/new-feature

# 2. Modify gql schema (if needed)
cd packages/gql
# Edit schema files
bun run generate

# 3. Implement platform-specific code
cd ../google  # or ../apple
# Write code...

# 4. Update documentation
cd ../docs
# Write docs...

# 5. Commit
git add .
git commit -m "feat: add new feature"

# 6. Push & create PR
git push origin feat/new-feature
```

### Fixing a Bug

```bash
# 1. Create a branch
git checkout -b fix/bug-description

# 2. Navigate to relevant package
cd packages/[google|apple|docs|gql]

# 3. Fix and test
# Modify code...
bun run test  # or platform-specific test command

# 4. Commit
git add .
git commit -m "fix: resolve bug description"

# 5. Push & create PR
git push origin fix/bug-description
```

## 📋 Commit Conventions

```bash
# Format
<type>: <description>

# Types
feat:      # New feature
fix:       # Bug fix
docs:      # Documentation changes
refactor:  # Code refactoring
test:      # Add/modify tests
chore:     # Build/config changes
```

**Examples:**

```bash
feat: add subscription upgrade flow
fix: resolve purchase verification on android
docs: update api documentation for fetchProducts
refactor: simplify product caching logic
```

## 🧪 Testing

### GQL (Type Generation)

```bash
cd packages/gql
bun run generate
# Should complete without errors
```

### Android (Google)

```bash
cd packages/google
./gradlew :openiap:test
./gradlew :openiap:compileDebugKotlin
```

### iOS (Apple)

```bash
cd packages/apple
swift test
swift build
```

### Docs

```bash
cd packages/docs
bun run typecheck
bun run lint
bun run build
```

## 🔧 Common Tasks

### Type Synchronization Issues

```bash
# Regenerate types (auto-updates all platforms)
cd packages/gql
bun run generate
```

### Dependency Issues

```bash
# Reinstall all dependencies from root
cd /path/to/openiap
rm -rf node_modules
rm bun.lockb
bun install
```

### Clear Build Cache

```bash
# Android (Google)
cd packages/google
./gradlew clean

# iOS (Apple)
cd packages/apple
swift package clean

# Docs
cd packages/docs
rm -rf dist node_modules
bun install
```

## 🔧 Configuration

### Bun Workspace

The monorepo uses Bun workspaces for dependency management. All packages are defined in the root `package.json`:

```json
{
  "workspaces": ["packages/*"]
}
```

### Package Manager

All packages use Bun as the package manager:

```json
{
  "packageManager": "bun@1.1.0"
}
```

## 🏷️ Version Management

Versions are centrally managed in `openiap-versions.json` at the monorepo root:

```json
{
  "gql": "1.2.2",      // GraphQL schema version
  "docs": "1.2.2",     // Documentation version
  "google": "1.2.12",  // Android library version
  "apple": "1.2.23"    // iOS/macOS library version
}
```

### Version Synchronization

All package versions are managed in the root `openiap-versions.json` file. Before building or deploying, sync version files to all packages:

```bash
# Sync version files to all packages
./scripts/sync-versions.sh
```

This script copies the root version file to all packages, ensuring they have real files (not symlinks) for proper package distribution.

**Important**: The synced files in packages are gitignored and automatically generated during build/deploy processes.

### Version Strategy

- **Spec versions** (`gql` + `docs`): Should be kept in sync, represents the API specification
- **Implementation versions** (`google`, `apple`): Independent, represents platform implementations

### Manual Version Updates

To update versions, edit the root `openiap-versions.json` file directly:

```bash
# 1. Edit version in openiap-versions.json
vim openiap-versions.json

# 2. Sync to all packages
./scripts/sync-versions.sh

# 3. Commit changes
git add openiap-versions.json
git commit -m "chore: bump version to x.x.x"
```

### When to Bump Versions

**Spec version (gql + docs):**

- **Major**: Breaking changes in GraphQL schema
- **Minor**: New features, backward-compatible API additions
- **Patch**: Bug fixes, documentation updates

**Implementation versions (google, apple):**

- **Major**: Breaking changes in platform API
- **Minor**: New features, backward-compatible changes
- **Patch**: Bug fixes, performance improvements

## 🚢 Releases

### Release Strategy

- **Monorepo Release**: Unified deployment for all packages
- **Docs**: Deployed to Vercel
- **Type Artifacts**: Published to GitHub Releases (TypeScript, Dart, Kotlin, Swift)
- **Platform Libraries**: Android (Maven Central), iOS (Swift Package Manager)

### Deployment Workflow

```bash
# Deploy everything (docs + create release)
npm run deploy <version>

# Example
npm run deploy 1.2.3
```

This command will:

1. **Sync version files** to all packages
2. **Build and deploy docs** to Vercel (locally)
3. **Trigger GitHub Actions** to:
   - Regenerate types for all platforms
   - Create release artifacts (TypeScript, Dart, Kotlin, Swift)
   - Create Git tag `v<version>`
   - Create GitHub Release with artifacts

### Platform-Specific Releases

**For Android releases:**

```bash
# 1. Update version in openiap-versions.json
# 2. Sync versions
./scripts/sync-versions.sh

# 3. Create tag (triggers Android release workflow)
git tag google-v1.2.12
git push && git push --tags

# GitHub Actions will:
#    - Build and test
#    - Create GitHub release
#    - Publish to Maven Central
# Available at: https://github.com/hyodotdev/openiap/tree/main/packages/google
```

**For iOS releases:**

```bash
# 1. Update version in openiap-versions.json
# 2. Sync versions
./scripts/sync-versions.sh

# 3. Create tag (triggers iOS release workflow)
git tag apple-v1.2.23
git push && git push --tags

# GitHub Actions will:
#    - Build and test
#    - Create GitHub release
#    - Package becomes available via Swift Package Manager
# Available at: https://github.com/hyodotdev/openiap/tree/main/packages/apple
```

### CI/CD Workflows

- **Release** (`release.yml`): Triggered by `npm run deploy <version>`
  - Syncs version files
  - Regenerates types for all platforms
  - Creates release artifacts (TypeScript, Dart, Kotlin, Swift)
  - Creates Git tag and GitHub Release

- **Apple Release** (`apple-release.yml`): Triggered by `apple-v*` tags
  - Builds and tests
  - Creates GitHub release
  - Package available via Swift Package Manager

- **Google Release** (`google-release.yml`): Triggered by `google-v*` tags
  - Builds and tests
  - Creates GitHub release
  - Publishes to Maven Central

- **CI** (`ci.yml`): Runs on all PRs and pushes to main
  - Tests GQL type generation
  - Tests Android build
  - Tests iOS build
  - Tests docs build

## 📖 Additional Documentation

- [Google (Android) Conventions](./packages/google/CONVENTION.md)
- [Apple (iOS) Guidelines](./packages/apple/CLAUDE.md)
- [Docs Guidelines](./packages/docs/CLAUDE.md)
- [GQL Schema Rules](./packages/gql/README.md)

## 💡 Tips

### Quick Navigation

```bash
# Navigate quickly from root to each package
alias gql='cd packages/gql'
alias docs='cd packages/docs'
alias google='cd packages/google'
alias apple='cd packages/apple'
```

### Generate All Types at Once

```bash
# Generate all platform types (from root)
cd packages/gql && bun run generate
# → Auto-updates Android & iOS!
```

### Parallel Development

```bash
# Work in multiple terminal tabs:
# Tab 1: docs dev server
cd packages/docs && bun run dev

# Tab 2: android build watch
cd packages/google && ./gradlew --continuous :openiap:compileDebugKotlin

# Tab 3: iOS tests
cd packages/apple && swift test --parallel
```

## ❓ Troubleshooting

### "gql package not found" Error

```bash
# Ensure you're running from monorepo structure
pwd  # Should be /path/to/openiap/packages/[google|apple]
```

### Types Not Updating

```bash
# 1. Regenerate gql types first
cd packages/gql
bun run generate:kotlin  # or generate:swift

# 2. Verify generated file
ls src/generated/Types.kt  # or Types.swift

# 3. Re-run platform script
cd ../google  # or ../apple
bun run generate:types
```

## 📞 Need Help?

- [GitHub Issues](https://github.com/hyodotdev/openiap/issues)
- [GitHub Discussions](https://github.com/hyodotdev/openiap/discussions)
- [openiap.dev](https://openiap.dev)
