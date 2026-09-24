# Project Structure

## Directory Layout

```
godot-iap/
├── android/                # Android plugin (Kotlin)
├── ios-gdextension/        # iOS plugin (SwiftGodot)
├── Example/                # Development project (source of truth)
│   ├── addons/godot-iap/   # Plugin addon
│   │   ├── bin/ios/        # iOS frameworks (committed to git)
│   │   └── android/        # Android AARs (gitignored)
│   └── ios/                # Exported Xcode project (gitignored)
├── TestProject/            # Release testing (auto-generated, gitignored)
├── scripts/                # Build scripts
│   ├── pre-commit          # Auto-builds iOS on ios-gdextension changes
│   ├── install-hooks.sh    # Installs git hooks
│   └── fix_ios_embed.sh    # Patches Xcode for framework embedding
├── docs/                   # Docusaurus documentation
└── Makefile                # Main build commands
```

## Dependencies

- **Android**: `io.github.hyochan.openiap:openiap-google` (version in `openiap-versions.json`)
- **iOS**: `https://github.com/hyodotdev/openiap.git` (SwiftGodot)

## Quick Commands

```bash
# Development (uses Example/ directly)
make run-ios       # Build, export, open Xcode
make run-android   # Build, export, install on device

# Release testing (resets TestProject/ from Example/)
make test-ios      # Copy binaries to TestProject, open Xcode
make test-android  # Copy binaries to TestProject, run on device

make help          # Show all commands
```
