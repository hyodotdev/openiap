# Contributing to Flutter InApp Purchase

Thank you for your interest in contributing! This guide will help you get started with development and submitting your contributions.

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/hyodotdev/openiap.git
cd openiap/libraries/flutter_inapp_purchase
```

### 2. Install Dependencies

```bash
flutter pub get
```

### Platform-Specific Setup

#### iOS and macOS

- This plugin declares the OpenIAP Apple native module for both Swift Package Manager and CocoaPods. See [openiap-versions.json](./openiap-versions.json) for the current version.
- Flutter 3.44 and newer enables Swift Package Manager by default. When testing SwiftPM locally, run `flutter config --enable-swift-package-manager`, then build from `example`.
- CocoaPods remains supported for older Flutter projects or projects that disable SwiftPM. After upgrading or cloning, run `pod install` in each Apple example target you use:
  ```bash
  (cd example/ios && pod install)
  (cd example/macos && pod install)
  ```
- Minimum deployment targets are iOS `15.0` and macOS `14.0`.

#### Android

- This plugin uses the OpenIAP Google native module. See [openiap-versions.json](./openiap-versions.json) for the current version.
- The module is automatically fetched from Maven Central during build.

### 3. Enable Git Hooks (recommended)

This repo ships with Git hooks under `.githooks` that auto-format, analyze, and test your changes before committing. Enable them once per clone:

```bash
git config core.hooksPath .githooks
```

After this, committing will:

- Run `flutter pub get`
- Auto-format staged Dart files
- Verify repo-wide formatting (same as CI)
- Run `flutter analyze` (non-blocking by default)
- Run `flutter test`

Hook options (env vars):

- `SKIP_PRECOMMIT_TESTS=1` to skip tests
- `PRECOMMIT_TEST_CONCURRENCY=<N>` to control concurrency (default 4)
- `PRECOMMIT_FAIL_FAST=0` to disable `--fail-fast`
- `PRECOMMIT_RUN_ALL_TESTS=0` to only run changed tests
- `ENFORCE_ANALYZE=1` to fail on analyzer warnings

### 3. Run the Example App

Navigate to the example directory and run the app:

```bash
cd example
flutter pub get

# For iOS
flutter run --dart-define=IOS_PRODUCTS="your_product_ids"

# For Android
flutter run --dart-define=ANDROID_PRODUCTS="your_product_ids"
```

**Note:** You'll need to configure your app with valid product IDs from your App Store Connect or Google Play Console.

## Making Changes

### 1. Fork the Repository

1. Go to <https://github.com/hyodotdev/openiap>
2. Click the "Fork" button in the top-right corner
3. Clone your fork locally:

   ```sh
   git clone https://github.com/YOUR_USERNAME/openiap.git
   cd openiap/libraries/flutter_inapp_purchase
   ```

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 3. Make Your Changes

- Write your code following the project conventions
- Add tests for new functionality
- Update documentation as needed

### 4. Test Your Changes

```bash
# Format your code
dart format .

# Run tests
flutter test

# Run the example app to verify functionality
cd example
flutter run
```

### Android: Use local openiap-google for debugging (optional)

By default, this plugin depends on the published artifact version from
`openiap-versions.json`:

```
implementation "io.github.hyochan.openiap:openiap-google:${openiapGoogleVersion}"
```

If you need to debug against the monorepo OpenIAP Android module:

1. Point Gradle to the local module.

   Edit `android/settings.gradle` and uncomment the lines, updating the path:

   ```
   include ':openiap'
   project(':openiap').projectDir = new File(settingsDir, '../../../packages/google/openiap')
   ```

2. Sync and run.

   Run a Gradle sync from Android Studio or rebuild the Flutter module.

   To revert, comment out the include lines in `settings.gradle`. No
   `android/build.gradle` dependency changes are needed.

### 5. Commit Your Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

Follow conventional commit messages:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `refactor:` for code refactoring
- `test:` for test additions/changes
- `chore:` for maintenance tasks

### 6. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 7. Create a Pull Request

1. Go to your fork on GitHub
2. Click "Pull request" button
3. Select your branch and target `main` branch of the original repository
4. Fill in the PR template with:
   - Description of changes
   - Related issue number (if applicable)
   - Testing performed
5. Submit the pull request

## Development Guidelines

### Coding Standards

Please refer to [CLAUDE.md](./CLAUDE.md) for:

- Naming conventions
- Platform-specific guidelines
- API method naming
- OpenIAP specification compliance

### Before Submitting

- [ ] Code is formatted with `dart format .`
- [ ] All tests pass with `flutter test`
- [ ] Example app runs without errors
- [ ] Documentation is updated if needed
- [ ] Commit messages follow conventional format

## Questions or Issues?

- For new feature proposals, start a discussion at: <https://github.com/hyodotdev/openiap/discussions>
- For bugs, open an issue with a clear description and reproduction steps
- For questions, feel free to open a discussion

Thank you for contributing!
