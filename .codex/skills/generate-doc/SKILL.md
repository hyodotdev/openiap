---
name: generate-doc
description: Use for OpenIAP documentation generation work, especially pre-deployment release-note entries in packages/docs/src/pages/docs/updates/releases.tsx that must name the expected native and framework versions, link their future GitHub Releases, and update an existing unreleased train instead of creating a duplicate.
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

Current scope: pre-deployment notes written in assumed-published form.

RC and npm `next` releases live on the on-demand `next` branch and do not get a
release-history entry. Gather their changes as source material, but add the
consolidated docs entry only when the train is promoted to a stable release on
`main`. Production `npm run deploy` is stable-only.

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

## Existing Unreleased Train

Before adding a release card, inspect the newest entries and package tags.

- If an existing card describes a release train whose package tags are not all
  published yet, update that card in place with the new user-visible changes.
  Do not add another card for the same train.
- Consolidate overlapping unreleased cards when they describe the same package
  versions. Preserve their old IDs in the note's pagination-aware alias list
  and render matching hidden anchors so old deep links select the right page.
- If an unreleased hosted IAPKit card already exists and companion SDK packages
  belong to the same release train, expand that card into the single
  consolidated release entry and advance its date and title. Do not create a
  second card for the package versions.
- Structure a consolidated train in this order: a short `Common changes`
  summary, hosted IAPKit changes, versioned native and framework changes grouped
  by package, migration or integration notes, and `Package Releases` at the
  bottom.
- IAPKit and its MCP deploy as services and have no package version. Include
  their user-visible behavior in the consolidated card, but never invent an
  IAPKit item in the versioned `Package Releases` list.
- Create a new card only when the latest card is already fully published or the
  new work has an explicitly separate release train.

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

When workflows will bump versions after the docs are written, resolve expected
versions in this order:

1. Reuse explicit targets already recorded in the existing unreleased card or
   release plan.
2. Use package metadata that has already advanced beyond the last published
   release.
3. For an affected package still at its last published stable version, classify
   the public change before resolving its target: use the next patch for
   backward-compatible fixes, the next minor for backward-compatible features,
   and the next major for breaking public API or type removals. If the SemVer
   impact is ambiguous or conflicts with an existing release plan, ask instead
   of guessing.
4. Do not bump unaffected packages merely to make a release list symmetrical.
5. Reuse the explicit maintainer-selected OpenIAP Spec/docs target from the
   coordinated release plan or unreleased card. If no explicit coordinated spec
   target exists, ask; never infer or auto-align it from Apple and Google
   versions.

Before naming any package's next major, inspect the canonical deprecation and
migration schedule. The release train must include every public removal already
scheduled for that major, or stop for maintainer direction to reschedule the
contract; never announce a major while claiming APIs scheduled for that major
remain available.

Write every resolved target into the release card with its expected tag link.
Do not leave versionless package bullets, `(planned)` labels, or a
`Planned Package Releases` list in assumed-published mode. Ask for confirmation
only when repository evidence names conflicting target versions or it is unclear
whether work belongs to the existing train.

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
- Name the expected version in each package-specific heading or bullet, as well
  as in the linked `Package Releases` list.
- Link issues and PRs when they exist.
- Do not edit `packages/docs/src/generated/version-metadata.json` manually; it
  is produced by `./scripts/sync-versions.sh`.

## Multi-package Release Trains

The consolidated release page remains the release-note SSOT, but a release that
ships several packages must still be readable package by package. This is the
project decision recorded from issue #206.

- When the user gives a starting commit, inspect that commit inclusively through
  the latest target branch, then include the current PR diff. Do not derive the
  release contents only from the PR title or its latest commits.
- Group notable changes under the affected platform package or framework
  library (Google, Apple, IAPKit, React Native, Expo, Flutter, Godot, KMP, and
  MAUI). Omit groups with no user-facing change.
- Keep each group concise. State the behavior users gain or the regression that
  was fixed; do not list commit mechanics, version-bump-only commits, generated
  files, or repeated cross-framework boilerplate.
- Put truly shared schema or release-process changes in one short shared group,
  then describe framework-specific wiring or caveats in the relevant framework
  group.
- Link the issues and PRs that explain user-visible fixes. Keep package-local
  changelogs as pointers to this canonical entry unless a registry requires an
  inline changelog.

## Validation

For docs-only release-note edits, run:

```bash
cd packages/docs && bunx prettier --check "src/**/*.{ts,tsx,js,jsx,css,json}"
cd packages/docs && bun run build
bun run audit:docs
bun run audit:release-state
git diff --check
```

If Prettier fails, format only the touched docs files and rerun the checks.

Before committing to `main`, pull first:

```bash
git pull --ff-only origin main
```
