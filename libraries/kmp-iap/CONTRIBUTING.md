# Contributing to kmp-iap

Thank you for your interest in contributing to kmp-iap! This guide will help you get started with development.

## Development Setup

### Prerequisites

- JDK 11 or higher
- Android Studio (latest stable version)
- Xcode (for iOS development, Mac only)
- Android SDK

### Getting Started

1. Fork and clone the repository

   ```bash
   git clone https://github.com/[your-username]/kmp-iap.git
   cd kmp-iap
   ```

2. Open the project in Android Studio

3. Sync the project with Gradle files

## Running the Example App

### Android

```bash
# Build and install the debug APK
./gradlew :example:composeApp:assembleDebug

# Or run directly from Android Studio
```

### iOS (Mac only)

```bash
# Navigate to iOS app directory
cd example/iosApp

# Open in Xcode
xed .

# Build and run from Xcode
```

## Development Workflow

### 1. Building the Library

```bash
# Build the library
./gradlew :library:build

# Run tests
./gradlew :library:test
```

### 2. Making Changes

Before making changes:

1. Create a new branch from `main`
2. Write tests for new features
3. Ensure existing tests pass
4. Follow the project conventions

### 3. Testing Your Changes

```bash
# Run all tests
./gradlew :library:test

# Run specific test
./gradlew :library:test --tests "TestClassName"
```

### 4. Submitting a Pull Request

1. Ensure all tests pass
2. Update documentation if needed
3. Create a PR with a clear description
4. Link any related issues

## Code Conventions

For detailed information about:

- Naming conventions
- Code style guidelines
- API design patterns
- OpenIAP specification compliance

Please refer to [CLAUDE.md](./CLAUDE.md)

## Project Structure

```text
kmp-iap/
├── library/           # Main library code
│   ├── src/
│   │   ├── commonMain/     # Shared code
│   │   ├── androidMain/    # Android-specific
│   │   └── iosMain/        # iOS-specific
│   └── build.gradle.kts
├── example/          # Example application
│   ├── composeApp/   # Compose Multiplatform app
│   └── iosApp/       # iOS app
├── native/           # Native dependencies (gitignored)
│   └── openiap-apple/      # Local copy for development
└── CLAUDE.md         # Coding conventions
```

## OpenIAP Apple Module

The iOS implementation depends on the [openiap-apple](https://github.com/hyodotdev/openiap-apple) library, which is a Swift package that provides StoreKit 2 functionality.

### How It Works

1. **CocoaPods Integration**: The library uses CocoaPods to integrate openiap-apple via Git tags
   - Configured in `library/build.gradle.kts`
   - Podspec references: `https://github.com/hyodotdev/openiap-apple.git`
   - Version managed via Git tags (e.g., `1.2.5`)

2. **Build Process**:
   ```bash
   # The Gradle build automatically:
   # 1. Downloads openiap-apple via CocoaPods
   # 2. Generates Kotlin/Native cinterop bindings
   # 3. Builds the iOS framework

   ./gradlew :library:build
   ```

3. **Local Development Copy**:
   - `native/openiap-apple/` contains a local copy for reference
   - This directory is in `.gitignore` (line 31)
   - **Do not commit changes here** - changes should go to the [openiap-apple repository](https://github.com/hyodotdev/openiap-apple)

### Updating OpenIAP Apple Version

When a new version of openiap-apple is released:

1. Update the version in `library/build.gradle.kts`:
   ```kotlin
   cocoapods {
       pod("openiap") {
           version = "1.2.5"  // Update this
           extraOpts += listOf("-compiler-option", "-fmodules")
       }
   }
   ```

2. Update `native/InAppPurchaseBridge/Package.swift` if using Swift Package Manager:
   ```swift
   .package(url: "https://github.com/hyodotdev/openiap-apple.git", from: "1.2.5")
   ```

3. Clean and rebuild:
   ```bash
   ./gradlew clean
   ./gradlew :library:build
   ```

## Debugging Tips

### Android

- Use Android Studio's debugger
- Check Logcat for IAP-related logs
- Test with Google Play Console test accounts

### iOS

- Use Xcode's debugger
- Check Console app for StoreKit logs
- Test with Sandbox test accounts

## Common Issues

### Build Issues

- Ensure Gradle wrapper is up to date
- Clean and rebuild: `./gradlew clean build`
- Invalidate caches in Android Studio

### Testing IAP

- Use test accounts for both platforms
- Ensure proper app signing for release builds
- Check platform-specific IAP configuration

## Questions or Problems?

- Check existing [issues](https://github.com/hyochan/kmp-iap/issues)
- Start a [discussion](https://github.com/hyochan/kmp-iap/discussions)
- Refer to [OpenIAP discussions](https://github.com/hyochan/openiap.dev/discussions) for specification questions

## License

By contributing, you agree that your contributions will be licensed under the project's license.
