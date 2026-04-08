# Contributing

We welcome contributions! This guide will help you get started with development setup and understanding the project structure.

## Development Setup

1. **Clone and Install Dependencies**

   ```bash
   git clone https://github.com/hyodotdev/openiap.git
   cd openiap/libraries/react-native-iap
   yarn install
   ```

2. **Generate Nitro Files**

   ```bash
   yarn specs
   ```

3. **Running the Example App**

   ```bash
   # React Native Example (workspace)
   cd example && yarn ios
   cd example && yarn android

   # Expo Example (independent)
   cd example-expo && bun setup
   cd example-expo && bun ios
   cd example-expo && bun android
   ```

## Example Apps Architecture

This project includes two example applications:

### `example/` - React Native CLI Example

- **Location**: `example/screens/`
- **Router**: React Navigation
- **Package Manager**: Yarn (workspace)
- **Purpose**: Main development and testing environment

### `example-expo/` - Expo Router Example

- **Location**: `example-expo/app/`
- **Router**: Expo Router
- **Package Manager**: Bun (independent)
- **Purpose**: Expo-specific testing and demonstration

### Screen File Synchronization

The `example-expo` app automatically syncs screen files from `example/screens/` to maintain consistency:

- **Source**: `example/screens/*.tsx` (PascalCase)
- **Target**: `example-expo/app/*.tsx` (kebab-case)

**File Mapping:**

- `AvailablePurchases.tsx` → `available-purchases.tsx`
- `OfferCode.tsx` → `offer-code.tsx`
- `PurchaseFlow.tsx` → `purchase-flow.tsx`
- `SubscriptionFlow.tsx` → `subscription-flow.tsx`

**Automatic Synchronization:**

```bash
# Happens automatically during:
cd example-expo && bun install  # (postinstall script)
cd example-expo && bun setup    # (setup script)

# Manual synchronization:
cd example-expo && ./scripts/copy-screens.sh
```

**Important Notes:**

- 🚨 **Do NOT edit files in `example-expo/app/` directly**
- ✅ **Always modify the source files in `example/screens/`**
- 🔄 **Files are automatically copied with generation comments**
- 📝 **Generated files include header comments indicating their source**

## Code Guidelines

- Run `yarn typecheck` and `yarn lint --fix` before committing
- Use TypeScript with strict mode
- Follow existing code style and conventions
- Add tests for new features when possible

### Development Workflow

When working with example screens:

1. **Modify Source Files**: Make changes in `example/screens/*.tsx`
2. **Test React Native**: Run `cd example && yarn ios/android` to test changes
3. **Sync Expo Files**: Changes automatically sync to `example-expo/app/` during `bun install`
4. **Test Expo**: Run `cd example-expo && bun ios/android` to verify expo compatibility
5. **Commit**: Only commit source files in `example/screens/`, not generated files in `example-expo/app/`

### Testing

Before submitting changes:

```bash
# Check TypeScript and linting
yarn typecheck && yarn lint --fix

# Run library tests
yarn test:ci

# Test example apps
cd example && yarn test        # React Native example tests
cd example-expo && bun test    # Expo example tests (if available)
```

## Release Process (Maintainers)

Follow these steps when preparing a new release (e.g., 14.2.0):

1. Verify CI locally

   ```bash
   yarn ci:check
   # or:
   yarn typecheck && yarn lint --fix && yarn test:ci && yarn nitrogen
   ```

2. iOS/OpenIAP
   - Ensure Nitro codegen is up to date: `yarn nitrogen`
   - Verify Pods resolve in the example app: `cd example/ios && pod install`

3. Android
   - We ship consumer R8 keep rules in `android/consumer-rules.pro` so Nitro classes aren’t stripped.
   - Verify a release build of the example app: `cd example/android && ./gradlew :app:assembleRelease`

4. Version bump & docs
   - Update `package.json` version
   - Add a blog post in `docs/blog/` with highlights
   - Update CHANGELOG if needed

5. Tagging and Publishing
   - Push the release PR; ensure CI is green
   - Create a GitHub Release
   - Publish to npm via the existing workflows

Recent highlights (14.2.0)

- iOS: idempotent, non-blocking init; `initConnection()` now propagates failures.
- iOS: bump OpenIAP to `~> 1.1.8`.
- Android: add consumer R8 keep rules to protect Nitro HybridObjects.
- CI: use vendored Yarn to avoid Corepack 503.
- Example: stabilized Subscription/Purchase flows; tests improved.

## Project Structure

- [`android/`](android): All your `android`-specific implementations.
  - [`build.gradle`](android/build.gradle): The gradle build file. This contains four important pieces:
    1. Standard react-native library boilerplate code
    2. Configures Kotlin (`apply plugin: 'org.jetbrains.kotlin.android'`)
    3. Adds all Nitrogen files (`apply from: '.../NitroIap+autolinking.gradle'`)
    4. Triggers the native C++ build (via CMake/`externalNativeBuild`)
  - [`CMakeLists.txt`](android/CMakeLists.txt): The CMake build file to build C++ code. This contains four important pieces:
    1. Creates a library called `NitroIap` (same as in `nitro.json`)
    2. Adds all Nitrogen files (`include(.../NitroIap+autolinking.cmake)`)
    3. Adds all custom C++ files (only `HybridTestObjectCpp.cpp`)
    4. Adds a `cpp-adapter.cpp` file, which autolinks all C++ HybridObjects (only `HybridTestObjectCpp`)
  - [`src/main/java/com/margelo/nitro/iap/`](android/src/main/java/com/margelo/nitro/iap/): All Kotlin implementations.
    - [`NitroIapPackage.java`](android/src/main/java/com/margelo/nitro/iap/NitroIapPackage.java): The react-native package. You need this because the react-native CLI only adds libraries if they have a `*Package.java` file. In here, you can autolink all Kotlin HybridObjects.
- [`cpp/`](cpp): All your cross-platform implementations. (only `HybridTestObjectCpp.cpp`)
- [`ios/`](ios): All your iOS-specific implementations.
- [`nitrogen/`](nitrogen): All files generated by nitrogen. You should commit this folder to git.
- [`src/`](src): The TypeScript codebase. This defines all HybridObjects and loads them at runtime.
  - [`specs/`](src/specs): All HybridObject types. Nitrogen will run on all `*.nitro.ts` files.
- [`nitro.json`](nitro.json): The configuration file for nitrogen. This will define all native namespaces, as well as the library name.
- [`NitroIap.podspec`](NitroIap.podspec): The iOS podspec build file to build the iOS code. This contains three important pieces:
  1. Specifies the Pod's name. This must be identical to the name specified in `nitro.json`.
  2. Adds all of your `.swift` or `.cpp` files (implementations).
  3. Adds all Nitrogen files (`add_nitrogen_files(s)`)
- [`package.json`](package.json): The npm package.json file. `react-native-nitro-modules` should be a `peerDependency`.

## Submitting Pull Requests

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting: `yarn typecheck && yarn lint --fix`
5. Submit a pull request with a clear description

For detailed usage examples and error handling, see the [documentation](https://hyochan.github.io/react-native-iap).
