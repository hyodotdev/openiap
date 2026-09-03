# Git Conventions & Deployment

> **Priority: MANDATORY**
> Follow these conventions for all commits and deployments.

## Public GitHub Communication Language

OpenIAP is a public open-source project. All repository-authored public GitHub
communication **must be written in English**, regardless of the language used
in a private maintainer conversation.

This rule covers:

- issue and pull request titles, bodies, and comments
- inline review replies and review summaries
- GitHub Discussions and maintainer-authored label or milestone descriptions
- commit messages, changelogs, release notes, and GitHub Release text

Code identifiers, command-only bot triggers, logs, and directly quoted reporter
text may remain in their original form when accuracy requires it. Any
surrounding explanation or response must still be English.

Before any GitHub write through the CLI, API, browser, or automation, inspect
the complete title/body payload and confirm that all repository-authored prose
is English. When non-English repository-authored text is found in the active
work scope, edit the existing artifact in place when possible instead of adding
a duplicate translation.

## Git Commit Message Format

### Rules

- **50 characters max** for the subject line (tag + scope + message combined)
- Everything after the tag MUST be lowercase
- No trailing period
- Use imperative mood ("add" not "added")

## Pull Request Preview Recordings

Every PR that introduces a new feature, visible behavior change, UI change,
documentation page, example flow, or developer workflow must include a preview
recording before it is handed off for review.

Requirements:

- Record the actual changed surface after the implementation is complete. Use
  the Codex Chrome Extension for web/docs/dashboard previews whenever a browser
  can render the change.
- Compress the final video to **under 10 MB** so GitHub accepts it reliably.
  Prefer H.264 MP4 with a modest resolution / frame rate when the raw capture is
  too large.
- Upload the compressed recording to the GitHub PR as a PR body attachment or a
  clearly labeled attached `Preview` comment.
- Never commit one-off PR preview recordings, including under
  `.github/pr-previews/`. Create them in a temporary or ignored local path,
  upload them as GitHub attachments, verify the attachment, then delete the
  local files. Only commit media that is itself a product documentation or
  example asset intended to ship with the repository.
- If browser or extension permissions block an attachment, stop and ask the
  maintainer to enable file uploads. Do not force-add the recording as a Git
  fallback.
- Link or embed the uploaded preview in the PR body or a clearly labeled
  `Preview` PR comment.
- If the change has no visual or interactive surface, include a short note in
  the PR explaining why a recording was not applicable and show the most useful
  terminal/API proof instead.
- Do not upload secrets, private customer data, unreleased credentials, or local
  browser profile details in previews. Redact or use test fixtures.

### With Tag and Scope

When a commit targets a specific package or library, include the scope:

```text
feat(rn): add offer redemption
fix(expo): resolve purchase crash
fix(flutter): correct discount mapping
feat(kmp): add subscription flow
chore(godot): bump openiap dep
fix(apple): handle StoreKit edge case
fix(google): update billing client
```

### Without Scope

For cross-cutting or monorepo-wide changes:

```text
feat: add RC promote to releases
fix: update repo URLs in package.json
chore: update CI workflow names
```

### Without Tag Prefix

First letter MUST be uppercase:

```text
Add user authentication system
Fix purchase validation error
```

### Scope Reference

| Scope     | Package/Library                    |
| --------- | ---------------------------------- |
| `apple`   | `packages/apple`                   |
| `google`  | `packages/google`                  |
| `spec`    | `specs/client`                     |
| `docs`    | `packages/docs`                    |
| `rn`      | `libraries/react-native-iap`       |
| `expo`    | `libraries/expo-iap`               |
| `flutter` | `libraries/flutter_inapp_purchase` |
| `kmp`     | `libraries/kmp-iap`                |
| `godot`   | `libraries/godot-iap`              |

### Common Tags

| Tag         | Usage                           |
| ----------- | ------------------------------- |
| `feat:`     | New feature                     |
| `fix:`      | Bug fix                         |
| `docs:`     | Documentation changes           |
| `style:`    | Code style changes (formatting) |
| `refactor:` | Code refactoring                |
| `test:`     | Adding or updating tests        |
| `chore:`    | Maintenance tasks               |

---

## Deployment

### Stable And Prerelease Branches

`main` is the stable release branch. Its package metadata must never contain a
SemVer prerelease suffix. Stable package releases, production docs deployment,
and the Docs GitHub Release run from `main` only.

`next` is an on-demand prerelease integration branch for compatibility work
that needs external validation, such as a new store runtime. It is not a
permanent development branch and may be absent between prerelease trains.

- Create `next` from the latest `main` only when a maintainer requests a
  prerelease train.
- Before reusing `next`, inspect its divergence, open PRs, and active workflows.
  If it belongs to an older completed train, do not merge, rebase, reset, or
  delete it automatically; obtain explicit maintainer approval before replacing
  it from current `main`.
- Run first RC releases from `next` with `prerelease=true`; run later RC bumps
  with `version=rc-bump` where supported.
- Release workflows commit prerelease metadata back to `next`, never `main`.
- Do not merge prerelease version-only commits into `main`. Promote reviewed
  source changes through a clean PR based on `main`, then run the stable
  workflow from `main` using the intended bump type relative to its stable
  metadata.
- Do not force-reset or delete `next` without explicit maintainer approval.
- RC/next releases do not get entries in the stable docs release history.

The executable policy is `scripts/release-branch-policy.mjs`. CI runs it for
`main` and `next`, and every package release workflow runs it before builds:

```bash
bun run audit:release-state
node --test scripts/release-branch-policy.test.mjs
```

Framework-library release workflows also require `origin/<release-branch>` to
still equal the workflow dispatch SHA after validation. If the branch advanced,
the workflow must stop instead of rebasing unverified commits into the release;
rerun the complete review, CI, and E2E gates on the new head, then dispatch the
release again.

### CI-Only Package Publishing

External registry publication for npm and Flutter packages is CI-only. Never
run `npm publish`, `flutter pub publish`, or an equivalent package-publishing
command from a local terminal.

- Enter a stable or prerelease package release only through its guarded
  `workflow_dispatch` source workflow on the allowed release branch.
- React Native and Expo source workflows create an immutable release tag; the
  tag-ref child publisher performs the npm registry write with OIDC.
- The Flutter source workflow is dispatched, but the actual pub.dev registry
  write runs only from the immutable tag-push `publish-flutter.yml` workflow.
  pub.dev rejects OIDC publishing from a `workflow_dispatch` event even when
  that run checks out a tag.
- Local registry-facing commands in a release workflow are limited to read-only
  verification; local build and test commands remain allowed.

Exact-version `npm deprecate` and retraction through the signed-in pub.dev Admin
UI are authenticated lifecycle-maintenance exceptions, not package publishing.
Use them only after the replacement version is publicly verified. Do not add a
token- or OTP-backed CI mutation path for either operation.

The version commit and immutable provenance tag must be pushed atomically before
publishing a framework package to its external registry. A `current` retry may
reuse that tag to finish an interrupted publication, but if the registry already
contains the version while its provenance tag is absent, stop instead of tagging
the current branch tip as an unverified substitute.

Before any `current` retry checks out an existing release tag, run
`scripts/assert-release-tag.mjs`. The guard must prove that the local tag matches
the immutable origin tag, its package metadata declares the expected version,
and its peeled commit is reachable from the validated `main` or `next` release
branch. Do this before executing build scripts or loading package content from
the tag; a matching tag name alone is not reviewed-branch provenance.

When `current` must create a missing tag for a version that is not yet published,
the workflow creates an empty provenance-recovery commit and atomically pushes
that real branch update with a tag targeting the verified dispatch SHA. A no-op
branch refspec is not a compare-and-swap guard because Git omits up-to-date refs
from the push transaction.

For npm trusted publishing, the release workflow's branch-ref phase creates and
pushes the immutable tag, then dispatches the same trusted-publisher workflow on
that tag ref. Only the tag-ref publish job receives `id-token: write`. It must
require the exact package/version tag and require the checked-out commit to equal
the tag-ref event's `GITHUB_SHA` before running `npm publish --provenance`.
Checking out or detaching to a tag inside a branch-dispatched retry is not enough:
npm's provenance statement reads the immutable workflow event SHA, so changing
only the local checkout can make package `gitHead` and attested source disagree.
Serialize tag-ref publishers per package so concurrent versions cannot move the
same npm dist-tag backward. The publisher must also prove that the tag is
reachable from `main` for stable versions or `next` for prereleases and that it
was dispatched by a successful branch-ref run of the same release workflow. The
branch run uploads an immutable, run-attempt-scoped authorization artifact that
names the exact repository, workflow, source branch/SHA, release tag, and tag
SHA; the tag publisher must download it from the supplied source run and match
every field before publishing. Resolve the authorization's recorded attempt with
GitHub's attempt-specific run endpoint; a later rerun of the same source run ID
must not invalidate an earlier valid artifact by substituting the run's latest
attempt metadata. A merely successful historical run is not valid authorization
for another tag.
Before accepting an already-published version, and again after a new publish,
run npm's signature audit to authenticate the Sigstore bundle and bind it to the
published tarball, then inspect only that audit's returned verified bundle when
matching registry `gitHead`, artifact SHA-512, and the decoded SLSA statement's
repository, workflow ref, and resolved Git commit against the immutable release
tag. A tag whose stored
workflow predates the tag-ref publisher cannot be repaired safely through
`current`; stop with an explicit instruction to release a new reviewed version.

### Deploying Apple Package (iOS/macOS)

**Via GitHub Actions UI:**

1. Go to Actions -> "Apple Release"
2. Click "Run workflow"
3. Select `main` for stable or `next` for prerelease
4. Select the version bump type and prerelease flag
5. Click "Run workflow"

**What happens:**

1. Updates `openiap-versions.json`
2. Regenerates release-derived files via `scripts/sync-release-generated.sh`
   (docs `version-metadata.json`, `llms.txt`, `llms-full.txt`, agent
   `context.md`) so they land in the same version-bump commit
3. Commits the version change to the guarded release branch
4. Creates Git tag `<apple-version>` (bare semver)
5. Builds and tests Swift package
6. Validates and publishes to CocoaPods
7. Creates GitHub Release

**Result:**

- CocoaPods: `pod 'openiap', '~> <apple-version>'`
- Swift Package Manager: `.package(url: "https://github.com/hyodotdev/openiap.git", from: "<apple-version>")`

### Deploying Google Package (Android)

**Via GitHub Actions UI:**

1. Go to Actions -> "Google Release"
2. Click "Run workflow"
3. Select `main` for stable or `next` for prerelease
4. Select the version bump type and prerelease flag
5. Click "Run workflow"

**What happens:**

1. Updates `openiap-versions.json`
2. Regenerates release-derived files via `scripts/sync-release-generated.sh`
   (docs `version-metadata.json`, `llms.txt`, `llms-full.txt`, agent
   `context.md`) so they land in the same version-bump commit
3. Commits the version change to the guarded release branch
4. Creates Git tag `google-<google-version>`
5. Builds and tests Android library
6. Publishes to Maven Central
7. Creates GitHub Release with artifacts (AAR, JAR)

**Result:**

- Maven Central: `implementation("io.github.hyochan.openiap:openiap-google:<google-version>")`

### Deploying Documentation

**Merging to `main` does not publish documentation.** No workflow deploys the
production docs on merge; `deploy-kit.yml` auto-deploys IAPKit instead.
Production docs go out only when a human runs the local deploy below.

This matters most for a PR that changes both `packages/kit/` and
`packages/docs/`: the kit server auto-deploys from `main` while the docs half
stays on the previously deployed build. Server behavior can therefore go live
while the documentation describing it is still unpublished. After merging such a
PR, deploy the docs and verify both surfaces.

Production documentation is stable-only and must deploy from a clean `main`
checkout that exactly matches `origin/main`. The script rejects prerelease spec
versions, other branches, and stale or unpublished local snapshots.

On a fresh checkout, first run `cd packages/docs && vercel link` and select the
existing OpenIAP project. Deployment stops when that local project link is
missing or invalid. It validates the immutable project and organization IDs,
rejects conflicting `VERCEL_PROJECT_ID` or `VERCEL_ORG_ID` overrides, and
reports success only after Vercel returns a ready production deployment.

```bash
# From monorepo root
npm run deploy
```

This will:

1. Sync version metadata
2. Typecheck and build the docs site
3. Deploy production documentation to Vercel

`npm run deploy` uses the current native-derived `spec` value from
`openiap-versions.json`. It rejects any explicit argument that differs from the
native floor; docs deployment is not a version-bump path.

**Routine docs deployments stop here.** Do not follow them with a Docs GitHub
Release: the spec version has not moved, so the immutable `docs-{spec}` tag
cannot represent a new release. Run the stable Docs workflow only when the spec
version itself advanced:

```bash
gh workflow run release.yml --ref main -f version=current
```

If a Docs GitHub Release is requested while `spec` is unchanged, stop and
explain that the immutable tag scheme cannot represent it. Deploying the docs
site is still valid and does not require a new GitHub Release.

Verifying a docs deployment: `llms-full.txt` carries a `Generated:` timestamp
that must match the committed file, and the deployed entry bundle should contain
any newly added page copy. A stale timestamp under a cache-busting query string
means the deploy has not landed, not that a CDN is caching.

---

## Release Tag Conventions

Each package uses a different tag format for GitHub Releases:

| Package      | Tag Format                   | Example                   |
| ------------ | ---------------------------- | ------------------------- |
| Apple        | `{version}` (no prefix)      | `2.1.0`                   |
| Google       | `google-{version}`           | `google-2.1.0`            |
| React Native | `react-native-iap-{version}` | `react-native-iap-15.2.0` |
| Expo         | `expo-iap-{version}`         | `expo-iap-4.1.0`          |
| Flutter      | `flutter-iap-{version}`      | `flutter-iap-9.2.0`       |
| KMP          | `kmp-iap-{version}`          | `kmp-iap-2.2.0`           |
| Godot        | `godot-iap-{version}`        | `godot-iap-2.2.0`         |
| MAUI         | `maui-iap-{version}`         | `maui-iap-1.2.1`          |
| Docs         | `docs-{version}`             | `docs-1.2.0`              |

> **Apple is the exception** — it tags with the bare semver version because
> CocoaPods and Swift Package Manager resolve directly from the Git tag.

Flutter's pub.dev trusted publisher is also event-sensitive: only
`publish-flutter.yml` runs started by pushing a matching
`flutter-iap-{version}` tag are eligible for OIDC publication. A manually
dispatched workflow on that tag is still ineligible. The release workflow must
wait for the tag-push run, and retries must rerun that original run without
deleting or recreating the immutable tag. Before requesting OIDC, the publisher
must prove that the tag commit is reachable from `main` for a stable version or
`next` for a prerelease and verify the exact tag/SHA against the run-scoped
authorization artifact uploaded by the guarded release workflow. An unpublished
tag that predates this lane, or whose authorization artifact expired, must not
rerun legacy publishing code; create a new reviewed release version instead.

GitHub Deployment Environments are optional pub.dev hardening, not a publishing
prerequisite. This repository currently relies on its guarded tag-push CI lane
without a required environment. Add an `environment` to the publisher only
when a maintainer intentionally enables the matching requirement in the
pub.dev package Admin settings; never make an unconfigured environment a
release blocker.

### Release Docs Version Guard

When documenting release package versions in
`packages/docs/src/pages/docs/updates/releases.tsx`, do not infer versions from
adjacent release notes or assume every package moved in lockstep.

Use these checks before writing a release list:

| Package      | Metadata / Tag Check                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| Apple        | `jq -r '.apple' openiap-versions.json`; tag `{version}`                                                           |
| Google       | `jq -r '.google' openiap-versions.json`; tag `google-{version}`                                                   |
| React Native | `jq -r '.version' libraries/react-native-iap/package.json`; tag `react-native-iap-{version}`                      |
| Expo         | `jq -r '.version' libraries/expo-iap/package.json`; tag `expo-iap-{version}`                                      |
| Flutter      | `awk '/^version:/{print $2}' libraries/flutter_inapp_purchase/pubspec.yaml`; tag `flutter-iap-{version}`          |
| Godot        | `sed -n 's/^version="\\(.*\\)"/\\1/p' libraries/godot-iap/addons/godot-iap/plugin.cfg`; tag `godot-iap-{version}` |
| KMP          | `sed -n 's/^libraryVersion=//p' libraries/kmp-iap/gradle.properties`; tag `kmp-iap-{version}`                     |
| MAUI         | read `<PackageVersion>` from `libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj`; tag `maui-iap-{version}`  |

If the release is not published yet, use planned wording and plain text. If the
release is published, verify the tag exists with `gh release view <tag>` before
linking it. This prevents stale Package Releases tables such as documenting
`maui-iap 1.0.1` when the actual release tag is `maui-iap-1.0.3`.

Do not add RC or npm `next` releases to the stable release history. Collect
their user-facing changes and write one package-grouped entry when the release
train is promoted on `main`.

---

## Important Notes

- **Deprecated repositories**: `openiap-apple` and `openiap-google` are no longer used
- **Monorepo only**: All releases are now managed from this monorepo
- **Separate versioning**: Apple and Google packages have independent versions
- **Swift Package Manager**: Automatically works via Git tags, no separate deployment step

---

## Version File Management

### openiap-versions.json

**CRITICAL: NEVER manually edit the `google` or `apple` fields in
`openiap-versions.json`.**

Version ownership is split:

- Apple releases update `apple` version
- Google releases update `google` version
- The shared `spec` is always the lower semantic version of `google` and
  `apple`
- Native version writers update their native key and derive `spec` atomically;
  sync then verifies the invariant and refreshes `specs/client/package.json`,
  `packages/docs/package.json`, and other derived copies
- Production docs deployment consumes the derived current `spec`; it must not
  accept an independently selected spec version

Release workflows write stable values on `main` and prerelease values on
`next`. Manual edits are not a substitute for selecting the correct workflow
branch.

The manifest is only for the shared spec and native platform packages:
`spec`, `google`, and `apple`. Framework library package versions
(`react-native-iap`, `expo-iap`, `flutter_inapp_purchase`, `godot-iap`,
`kmp-iap`, `maui-iap`) must stay in each library's own package metadata and
release workflow, not as extra keys in `openiap-versions.json`.

Manual Google, Apple, or spec edits will cause version conflicts and deployment
issues. Use the native GitHub Actions workflows and repository sync automation.

**Why this matters:** If a feature PR sets `apple: "2.1.1"` manually, and then CI auto-bumps on release, CI sees "current is 2.1.1" and bumps to 2.1.2 — skipping 2.1.1 entirely. The published tag becomes 2.1.2 with no 2.1.1 ever existing.

**Rule:** Feature PRs must never touch `spec`, `google`, or `apple`. Stable
version changes happen via:

1. Release workflows (Apple Release, Google Release)
2. Native version automation that derives `spec = min(google, apple)`, followed
   by sync propagation
3. Deploy script (`npm run deploy`) using the already-derived spec
4. CI auto-bump after merge where configured
