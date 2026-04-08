# Contributing to godot-iap

Thank you for your interest in contributing to godot-iap! This guide will help you get started with development, testing, and submitting changes.

## Development Setup

### Prerequisites

- macOS (required for iOS builds)
- [Godot 4.3+](https://godotengine.org/download)
- [Xcode 15+](https://developer.apple.com/xcode/) (for iOS)
- [Android Studio](https://developer.android.com/studio) with SDK (for Android)
- Java 17+ (for Android builds)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/hyodotdev/openiap.git
cd openiap/libraries/godot-iap

# Setup build environment (downloads dependencies, installs git hooks)
make setup
```

This will:
- Download `godot-lib.aar` for Android builds
- Install git pre-commit hooks that auto-build iOS when `ios-gdextension/` files change

## Project Structure

```
godot-iap/
├── android/              # Android plugin (Kotlin)
├── ios-gdextension/      # iOS plugin (Swift GDExtension)
├── Example/              # Development project
│   └── addons/godot-iap/ # Plugin files (source of truth)
├── TestProject/          # Release testing (auto-generated, gitignored)
├── scripts/              # Build and utility scripts
└── docs/                 # Documentation site
```

## Building

### Build Commands

```bash
make help          # Show all available commands

# Build plugins
make android       # Build Android AAR
make ios           # Build iOS frameworks
make all           # Build everything

# Development (uses Example/ directly)
make run-android   # Build, export, install and run on Android device
make run-ios       # Build, export, open Xcode for iOS

# Release testing (uses TestProject/ with release structure)
make test-android  # Reset TestProject, copy binaries, run on Android
make test-ios      # Reset TestProject, copy binaries, open Xcode
```

## Testing

### Development vs Release Testing

| Command | Purpose | Source |
|---------|---------|--------|
| `make run-android` | Quick development testing | `Example/` directly |
| `make run-ios` | Quick development testing | `Example/` directly |
| `make test-android` | Verify release structure | `TestProject/` (copied from Example) |
| `make test-ios` | Verify release structure | `TestProject/` (copied from Example) |

### Testing Workflow

1. **Development**: Make changes in `Example/addons/godot-iap/` and test with `make run-*`
2. **Pre-release**: Test with `make test-*` to verify the release zip structure works correctly
3. **TestProject** is automatically reset from `Example/` on each test run

### iOS Testing Notes

- iOS frameworks are pre-built and committed to git for faster CI
- The pre-commit hook auto-rebuilds iOS when `ios-gdextension/` files are staged
- Run `make ios` manually if you need to rebuild without committing

### Android Testing Notes

- Requires a connected device or emulator
- Debug and release AARs are both needed for Godot export

## Making Changes

### Code Style

Follow the conventions in [CLAUDE.md](CLAUDE.md):

- **GDScript**: snake_case for functions/signals, PascalCase for classes
- **Kotlin**: Standard Kotlin conventions
- **Swift**: Standard Swift conventions

### Modifying the Plugin

1. Edit files in `Example/addons/godot-iap/`
2. Test with `make run-android` or `make run-ios`
3. Verify release structure with `make test-android` or `make test-ios`

### Modifying Native Code

**Android (`android/`):**
```bash
# Edit Kotlin files in android/src/main/java/
make android       # Rebuild AAR
make run-android   # Test
```

**iOS (`ios-gdextension/`):**
```bash
# Edit Swift files in ios-gdextension/Sources/
make ios           # Rebuild frameworks
make run-ios       # Test
```

## Submitting Changes

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes and test thoroughly
4. Commit with descriptive messages
5. Push and create a Pull Request

### Commit Messages

Use conventional commit format:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `chore:` Build/tooling changes

Example: `fix: iOS async products_fetched signal handling`

## Release Process

Releases are automated via GitHub Actions:

1. Go to **Actions → Release → Run workflow**
2. Select version bump type (`patch`, `minor`, `major`, or `custom`)
3. Optionally mark as prerelease
4. The workflow will:
   - Bump version in `plugin.cfg`
   - Build Android AAR
   - Verify iOS frameworks exist
   - Create release zip with addon files
   - Create GitHub release with auto-generated notes

### Pre-release Checklist

Before triggering a release:
- [ ] Test on Android device with `make test-android`
- [ ] Test on iOS device with `make test-ios`
- [ ] Ensure iOS frameworks are committed (`Example/addons/godot-iap/bin/ios/`)
- [ ] All changes are pushed to `main`

## Getting Help

- Open an [issue](https://github.com/hyochan/godot-iap/issues) for bugs or feature requests
- Check the [documentation](https://hyochan.github.io/godot-iap) for usage guides
- Reference the [OpenIAP specification](https://openiap.dev) for API design
