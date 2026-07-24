# Contributing to OpenIAP

This guide explains how to contribute to the OpenIAP monorepo.

## 1. Project Structure

```text
openiap/
├── packages/
│   ├── gql/           # GraphQL schema & type generation (SSOT)
│   ├── docs/          # Documentation site (openiap.dev)
│   ├── google/        # Android native module (Maven Central)
│   └── apple/         # iOS native module (CocoaPods/SPM)
├── libraries/
│   ├── react-native-iap/          # React Native SDK (npm)
│   ├── expo-iap/                  # Expo SDK (npm)
│   ├── flutter_inapp_purchase/    # Flutter SDK (pub.dev)
│   ├── godot-iap/                 # Godot 4.x plugin (GitHub Release)
│   ├── kmp-iap/                   # Kotlin Multiplatform (Maven Central)
│   └── maui-iap/                  # .NET MAUI / C# (NuGet)
├── scripts/
│   └── sync-versions.sh           # Sync version metadata and replay manifest copies
└── .github/workflows/             # CI/CD
```

- **packages/** contains the core native modules and shared infrastructure.
- **libraries/** contains framework-specific SDKs that wrap the native modules.
- **scripts/** contains monorepo-wide automation.

## 2. Getting Started

### Prerequisites

- [Bun](https://bun.sh/) at the exact version declared by the root
  `packageManager` field (currently 1.3.13)
- For Android: JDK 17+, Gradle
- For iOS: Xcode, Swift 5.9+
- For Flutter: Flutter SDK
- For Godot: Godot 4.x editor
- For MAUI: .NET 9 SDK + MAUI workload

### Initial Setup

```bash
git clone https://github.com/hyodotdev/openiap.git
cd openiap
bun install

# Sync checked-in version metadata and compatibility copies
./scripts/sync-versions.sh
```

Each library uses its own package manager:

| Library                | Package Manager              |
| ---------------------- | ---------------------------- |
| react-native-iap       | Yarn 3 (Berry)               |
| expo-iap               | Bun                          |
| flutter_inapp_purchase | Flutter/Dart (`flutter pub`) |
| godot-iap              | N/A (GDScript)               |
| kmp-iap                | Gradle                       |
| maui-iap               | .NET CLI / NuGet             |

## 3. Development Workflows

### Adding a New ErrorCode or Type

1. Edit `packages/gql/src/*.graphql`
2. `cd packages/gql && bun run generate`
3. Update Swift switch statements in `packages/apple/Sources/Models/OpenIapError.swift` and `packages/apple/Sources/OpenIapModule.swift`
4. Update `COMMON_ERROR_CODE_MAP` in `libraries/react-native-iap/src/utils/errorMapping.ts` and `libraries/expo-iap/src/utils/errorMapping.ts`

### Type Generation Architecture

```text
GraphQL Schema ─┬─► graphql-codegen + guarded AST post-processing ─► TypeScript
                └─► Parser → IR → language plugins ─► Swift/Kotlin/Dart/GDScript/C#
                                                        ↓
                                             generated-sync-manifest.mjs
```

One `bun run generate` command in `packages/gql` produces every language and
syncs every target declared in `generated-sync-manifest.mjs`. Do not run a
second type-copy command or maintain another target list.

### Working on a Specific Library

Each library has its own `CLAUDE.md` with detailed conventions and development instructions:

- `libraries/react-native-iap/CLAUDE.md` -- Nitro Modules, useIAP hook, error handling
- `libraries/expo-iap/CLAUDE.md` -- Expo Modules, iOS podspec workaround, tvOS support
- `libraries/flutter_inapp_purchase/CLAUDE.md` -- Generated types.dart, fetchProducts generic API
- `libraries/godot-iap/CLAUDE.md` -- GDExtension (iOS), AAR plugin (Android)
- `libraries/kmp-iap/CLAUDE.md` -- Flow-based API, CocoaPods iOS integration
- `libraries/maui-iap/CLAUDE.md` -- .NET MAUI / C#, generated Types.cs, native bindings

Libraries reference local `packages/apple` and `packages/google` source during development. Published packages use CocoaPods/Maven Central for native dependencies.

### Running Examples

| Library          | Command                                                                                                                                                                             |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react-native-iap | `cd libraries/react-native-iap && yarn install && yarn prepare && cd example && yarn install && yarn ios --device`                                                                  |
| expo-iap         | `cd libraries/expo-iap && bun install && bun run prepare && cd example && bun install && bunx expo run:ios --device`                                                                |
| flutter          | `cd libraries/flutter_inapp_purchase && flutter pub get && cd example && flutter pub get && flutter run`                                                                            |
| godot            | Open `libraries/godot-iap/Example/project.godot` in Godot editor, export to device                                                                                                  |
| kmp              | `cd libraries/kmp-iap && ./gradlew :library:podGenIos && ./gradlew :library:podInstallSyntheticIos && ./gradlew :example:composeApp:linkDebugFrameworkIosArm64`, then open in Xcode |
| maui             | `cd libraries/maui-iap && dotnet build src/OpenIap.Maui/OpenIap.Maui.csproj -f net9.0`                                                                                              |

## 4. Release Process

### Release Order (CRITICAL)

Native modules must be released before framework libraries:

1. `packages/apple` -- CocoaPods + SPM (via `release-apple.yml`)
2. `packages/google` -- Maven Central (via `release-google.yml`)
3. Framework libraries (can be parallel after steps 1+2):
   - `release-react-native.yml` -- npm
   - `release-expo.yml` -- npm
   - `release-flutter.yml` -- pub.dev
   - `release-godot.yml` -- GitHub Release
   - `release-kmp.yml` -- Maven Central
   - `release-maui.yml` -- NuGet

### Prerelease

Native and framework package workflows support their documented version bump
modes (`patch` / `minor` / `major` / `rc` / `promote`). The Docs workflow is
`current`-only because the Spec version is derived from the native floor.

- `major` + prerelease checkbox -- X.0.0-rc.1
- `rc` -- X.0.0-rc.2 (increment prerelease)
- `promote` -- X.0.0 (stable release from latest rc)

### Version Management

- `openiap-versions.json` tracks only `spec`, `google`, and `apple` versions.
- `spec` is derived as the semantic-version minimum of `google` and `apple`;
  never bump it independently.
- Framework library versions live in each library's package metadata and release workflow.
- Native version writers update their native key and the derived `spec`
  atomically. `./scripts/sync-versions.sh` then verifies that invariant and
  propagates the canonical manifest; it does not derive the floor or regenerate
  schema types.

## 5. CI/CD

| Workflow                  | Scope                                    |
| ------------------------- | ---------------------------------------- |
| `ci.yml`                  | Core packages (gql, apple, google, docs) |
| `ci-react-native-iap.yml` | Lint + test                              |
| `ci-expo-iap.yml`         | Lint + test                              |
| `ci-flutter-iap.yml`      | Analyze + test                           |
| `ci-godot-iap.yml`        | Verify files                             |
| `ci-kmp-iap.yml`          | Compile check                            |
| `ci-maui-iap.yml`         | .NET build                               |

## 6. Auto-generated Files (DO NOT EDIT)

These files are generated and synchronized by `bun run generate` in
`packages/gql`. Never edit them directly:

- `packages/gql/src/generated/*` -- All generated type files (SSOT)
- `packages/apple/Sources/Models/Types.swift`
- `packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt`
- `libraries/react-native-iap/src/types.ts`
- `libraries/expo-iap/src/types.ts`
- `libraries/flutter_inapp_purchase/lib/types.dart`
- `libraries/godot-iap/addons/godot-iap/types.gd`
- `libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt`
- `libraries/maui-iap/src/OpenIap.Maui/Types.cs`
- `openiap-versions.json` -- Tracks only `spec`, `google`, and `apple`;
  Google/Apple are native-workflow-managed, while `spec` is their derived
  semantic-version minimum and is never bumped independently

To regenerate:

```bash
cd packages/gql && bun run generate
```

## 7. Commit Conventions

```text
<type>: <description>
```

- With tag: lowercase after the colon (e.g., `feat: add subscription upgrade flow`)
- Without tag: uppercase first letter (e.g., `Add subscription upgrade flow`)

**Types:**

| Tag        | Description           |
| ---------- | --------------------- |
| `feat`     | New feature           |
| `fix`      | Bug fix               |
| `docs`     | Documentation changes |
| `refactor` | Code refactoring      |
| `test`     | Add/modify tests      |
| `chore`    | Build/config changes  |

## 8. Links

- Docs: <https://openiap.dev>
- GitHub: <https://github.com/hyodotdev/openiap>
- Discussions: <https://github.com/hyodotdev/openiap/discussions>
