# Development Guide

## VSCode Setup

**Run and Debug (F5):**
- 🍎 iOS: Build & Run
- 🤖 Android: Build & Run
- 🎮 Godot: Run Example
- 📚 Docs: Dev Server

**Run Task (Cmd+Shift+B):**
- 🍎 iOS: Build, Export & Run
- 🤖 Android: Build, Export & Run

## Development vs Release Testing

| Command | Purpose | Source |
|---------|---------|--------|
| `make run-android` | Quick development | `Example/` directly |
| `make run-ios` | Quick development | `Example/` directly |
| `make test-android` | Verify release structure | `TestProject/` (reset from Example) |
| `make test-ios` | Verify release structure | `TestProject/` (reset from Example) |

**TestProject** is completely reset from `Example/` on every `make test-*` run to ensure clean state.

## Version Management

`openiap-versions.json` - OpenIAP dependency versions:
```json
{
  "apple": "1.3.9",
  "google": "1.3.21",
  "gql": "1.3.11"
}
```

Run `scripts/sync-versions.sh` after editing to sync versions across all config files.

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/fix_ios_embed.sh` | Patch Xcode project for framework embedding |
| `scripts/generate-types.sh` | Download GDScript types from openiap releases |
| `scripts/sync-versions.sh` | Sync OpenIAP versions across configs |
| `scripts/pre-commit` | Auto-builds iOS when ios-gdextension files change |
| `scripts/install-hooks.sh` | Install git hooks (run via `make setup`) |

## Pre-commit Hook

The pre-commit hook automatically rebuilds iOS frameworks when `ios-gdextension/` files are staged:

```bash
# Installed via make setup
# Or manually: ./scripts/install-hooks.sh
```

## Release Process

Releases are automated via GitHub Actions:

1. **Actions → Release → Run workflow**
2. Select version bump (`patch`, `minor`, `major`, or `custom`)
3. Workflow builds Android, verifies iOS frameworks, creates release

**Note:** iOS frameworks are pre-built and committed to git for faster CI (~2min vs ~30min).

## Troubleshooting

### iOS: dyld Library not loaded
Framework not embedded. Run `make run-ios` which auto-patches the Xcode project.

### macOS Editor: GDExtension not found
Normal - iOS plugin only supports iOS platform, not macOS editor.

### Android: Plugin not found
Check `Example/addons/godot-iap/android/` has AAR files and `.gdap` manifest.

### iOS: fetch_products returns pending forever
Ensure `products_fetched` signal is connected. iOS uses async product fetching.
