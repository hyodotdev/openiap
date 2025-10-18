# Contributing to OpenIAP Android

Thank you for your interest in contributing! We love your input and appreciate your efforts to make OpenIAP better.

## Quick Start

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`./gradlew :openiap:test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/openiap-google.git
cd openiap-google

# Open in Android Studio (recommended)
./scripts/open-android-studio.sh

# Or build from CLI
./gradlew :openiap:assemble

# Run unit tests for the library module
./gradlew :openiap:test

# (Optional) Install and run the Example app
./gradlew :Example:installDebug
adb shell am start -n dev.hyo.martie/.MainActivity
```

## Horizon OS Development (Meta Quest)

This library supports both Google Play Store and Meta Horizon OS (Quest devices) using product flavors.

### Setting Up Horizon App ID

1. **Create `local.properties`** in the project root (if it doesn't exist):

```properties
# local.properties (DO NOT commit this file)
sdk.dir=/path/to/Android/sdk

# Horizon OS App ID (Meta Quest)
EXAMPLE_HORIZON_APP_ID=your_horizon_app_id_here
```

1. **Alternative: Pass via command line**:

```bash
# Build with App ID
./gradlew :Example:assembleHorizonDebug -PEXAMPLE_HORIZON_APP_ID=your_app_id

# Install with App ID
./gradlew :Example:installHorizonDebug -PEXAMPLE_HORIZON_APP_ID=your_app_id
```

1. **Using Android Studio**:
   - Open **View > Tool Windows > Build Variants**
   - Set **Example** module to **horizonDebug**
   - Set **openiap** module to **horizonDebug**
   - Run the app (App ID will be read from `local.properties`)

### Build Variants

- **playDebug** / **playRelease** - Google Play Store billing
- **horizonDebug** / **horizonRelease** - Meta Horizon OS billing

### Testing on Quest Devices

```bash
# Connect Quest via ADB
adb devices

# Install Horizon variant
./gradlew :Example:installHorizonDebug

# View logs
adb logcat | grep -E "OpenIap|Horizon"
```

**Note**: The Horizon App ID is required for Horizon Billing to work. Without it, the billing client will fail to connect.

## Generated Types

- All GraphQL models in `openiap/src/main/java/dev/hyo/openiap/Types.kt` are generated from the [`openiap` monorepo](https://github.com/hyodotdev/openiap/tree/main/packages/gql). When you update API behavior, adjust the upstream type generator first so the Kotlin output stays in sync across platforms.
- The canonical workflow is documented in `CONVENTION.md`. Read it before touching generated models or related helpers.
- To refresh the generated file locally, run `./scripts/generate-types.sh`. If you need to experiment with manual edits, you can pass `--skip-download true` to reuse the current `Types.kt` while still applying the post-processing step, but remember that ad-hoc edits will not ship in published releases unless the upstream generator incorporates them.
- For changes that require generator support, open an issue or pull request in the [`packages/gql`](https://github.com/hyodotdev/openiap/tree/main/packages/gql) directory of the monorepo.

## Code Style

- Follow the official Kotlin Coding Conventions
- Use meaningful, descriptive names for types, functions, and variables
- Keep functions small and focused
- Add comments when they clarify intent (avoid redundant comments)

### Naming Conventions

- **OpenIap prefix for public models (Android)**
  - Prefix all public model types with `OpenIap`.
  - Examples: `OpenIapProduct`, `OpenIapPurchase`, `OpenIapActiveSubscription`, `OpenIapRequestPurchaseProps`, `OpenIapProductRequest`, `OpenIapReceiptValidationProps`, `OpenIapReceiptValidationResult`.
- Private/internal helper types do not need the prefix.
- When renaming existing types, provide a public typealias from the old name to the new name to preserve source compatibility and migrate usages incrementally when feasible.

## Testing

All new features must include unit tests (JUnit + coroutines test):

```kotlin
@Test
fun yourFeature_isCorrect() = kotlinx.coroutines.test.runTest {
    // Arrange
    // val module = FakeOpenIapModule()

    // Act
    // val result = store.yourMethod()

    // Assert
    // assertEquals(expected, result)
}
```

Run tests locally with:

```bash
./gradlew :openiap:test
```

## Pull Request Guidelines

### ✅ Do

- Write clear PR titles and descriptions
- Include tests for new features
- Update documentation when needed
- Keep changes focused and small

### ❌ Don't

- Mix unrelated changes in one PR
- Break existing tests
- Change code style without discussion
- Include commented-out or dead code

## Commit Messages

Keep them clear and concise:

- `Add purchase error recovery`
- `Fix subscription status check`
- `Update Google Play Billing integration`
- `Refactor transaction handling`

## Questions?

Feel free to:

- Open an issue for bugs or features
- Start a discussion for questions
- Tag @chan for urgent matters

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
