---
name: generate-doc
description: Use for OpenIAP documentation generation work, especially release-note entries in packages/docs/src/pages/docs/updates/releases.tsx where package releases are assumed to be deployed and links should be written as shipped release links.
---

# Generate OpenIAP Docs

Use this skill when the user asks to generate or update OpenIAP docs, especially
release notes that should be written as if package releases are already
published.

## Required Reading

Before editing docs, read:

- `AGENTS.md` or `CLAUDE.md`
- `packages/docs/CONVENTION.md`
- `knowledge/internal/05-docs-patterns.md`
- `knowledge/internal/06-git-deployment.md`
- `knowledge/internal/07-docs-consistency.md`

If the task also changes package/library behavior, use `openiap-workflows` and
read the package or library convention file before editing that code.

## Release Note Mode

Current scope: assumed-published release notes.

Use shipped wording only when the user explicitly says to assume deployment or
write the docs as already released. In that mode:

- Use `Package Releases`, not `Planned Package Releases`.
- Link expected release/package URLs exactly as the release will publish them.
- Do not add `(planned)` labels.
- Mention the release as publishing or shipping, not as upcoming.
- State in your response that the links are expected release links until actual
  deployment is complete.

For non-assumed releases, follow the release-note verification rules in
`knowledge/internal/05-docs-patterns.md` and
`knowledge/internal/06-git-deployment.md`; do not invent shipped links.

## Version Sources

Never infer framework versions from adjacent release notes or from
`openiap-versions.json`. Use the release docs version guard in
`knowledge/internal/06-git-deployment.md`.

Common source checks:

```bash
jq -r '.apple' openiap-versions.json
jq -r '.google' openiap-versions.json
jq -r '.version' libraries/react-native-iap/package.json
jq -r '.version' libraries/expo-iap/package.json
awk '/^version:/{print $2}' libraries/flutter_inapp_purchase/pubspec.yaml
sed -n 's/^version="\([^"]*\)"/\1/p' libraries/godot-iap/addons/godot-iap/plugin.cfg
sed -n 's/^libraryVersion=//p' libraries/kmp-iap/gradle.properties
sed -n -E 's|.*<PackageVersion>([^<]+)</PackageVersion>.*|\1|p' libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj
```

Tag formats:

- Apple: `{version}`
- Google: `google-{version}`
- React Native: `react-native-iap-{version}`
- Expo: `expo-iap-{version}`
- Flutter: `flutter-iap-{version}`
- Godot: `godot-iap-{version}`
- KMP: `kmp-iap-{version}`
- MAUI: `maui-iap-{version}`

If a release workflow will bump versions after the docs are written, derive the
expected version from the explicit release plan or ask for confirmation when the
target version is ambiguous.

## Editing Release Notes

Release notes live in:

`packages/docs/src/pages/docs/updates/releases.tsx`

Follow the existing card pattern:

- Add the newest note near the top of `allNotes`.
- Use a stable kebab-case `id` with the date.
- Use `new Date('YYYY-MM-DD')`.
- Use `AnchorLink` for the heading.
- Keep package links in a `Package Releases` list when using assumed-published
  mode.
- Link issues and PRs when they exist.
- Do not edit `packages/docs/src/generated/version-metadata.json` manually; it
  is produced by `./scripts/sync-versions.sh`.

## Validation

For docs-only release-note edits, run:

```bash
cd packages/docs && bunx prettier --check "src/**/*.{ts,tsx,js,jsx,css,json}"
cd packages/docs && bun run build
bun run audit:docs
git diff --check
```

If Prettier fails, format only the touched docs files and rerun the checks.

Before committing to `main`, pull first:

```bash
git pull --ff-only origin main
```

