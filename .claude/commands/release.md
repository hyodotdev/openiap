# Release Packages

Use this workflow for stable or prerelease package deployment. Release one
package at a time and verify the public registry before starting the next one.

## Public GitHub Language Guard

Before creating release notes, changelog entries, GitHub Release text, or public
release comments, apply the English-only communication policy in
`knowledge/internal/06-git-deployment.md#public-github-communication-language`.
Inspect the complete public payload before publishing it.

## Branch Contract

- `main` contains stable package metadata only. Run stable package releases,
  production docs deployment, and the Docs release workflow from `main`.
- `spec` is derived as the lower semantic version of `google` and `apple`.
  Never bump `spec` directly in a feature PR, release command, or docs
  deployment. Native version writers derive it atomically; sync verifies and
  propagates it.
- `next` is an on-demand prerelease integration branch. Run `-rc.*` and npm
  `next` releases from `next` only.
- `next` may be absent between prerelease trains. Create it from current `main`
  only when a maintainer requests a prerelease train.
- Before reusing an existing `next`, fetch it and inspect its divergence, open
  PRs, and active release runs. If it belongs to an older completed train, do
  not merge, rebase, reset, or delete it automatically; report the state and
  obtain explicit approval before replacing it from current `main`.
- Never merge prerelease version-only commits from `next` into `main`. Promote
  the reviewed source changes through a clean PR based on `main`, then run the
  stable release workflow from `main` with the intended bump type.
- If the original feature branch is unavailable, create a branch from `main`
  and cherry-pick or squash only the source/documentation commits from `next`;
  exclude release-version commits and confirm the resulting diff explicitly.
- Do not force-reset or delete `next` without explicit maintainer approval.

The release workflows enforce this contract through
`scripts/release-branch-policy.mjs`. Check locally with:

```bash
bun run audit:release-state
node --test scripts/release-branch-policy.test.mjs
```

Every release lane's version-bump commit also runs
`scripts/sync-release-generated.sh`, which regenerates and stages the files
derived from version metadata (`packages/docs/src/generated/version-metadata.json`,
`packages/docs/public/llms.txt`, `packages/docs/public/llms-full.txt`,
`knowledge/_claude-context/context.md`). Expect these paths in bump commits;
they are not worktree drift. Skipping this regeneration leaves `main` stale and
fails the `Audit SDK Parity` / `Test Agent Scripts` clean-worktree checks on
every subsequent PR.

## Preflight

1. Read `AGENTS.md` and `knowledge/internal/06-git-deployment.md`.
2. Confirm the target package metadata from its SSOT; do not infer versions
   from `openiap-versions.json` for framework libraries.
3. Confirm `spec = min(google, apple)` on stable `main`; stop if the floor
   invariant or any derived spec/package metadata is out of sync.
4. Fetch the target branch and tags, confirm a clean worktree, and inspect
   active release runs.
5. Run the focused package checks and the relevant monorepo audits.
6. Confirm required repository secrets exist without printing secret values.

```bash
git fetch origin main --tags
git status --short --branch
gh run list --status in_progress --limit 30
bun run audit:release-state
```

## Prerelease Train

Use this only for unusual compatibility work that needs external testing before
stable release.

1. Inspect `origin/next`. If it does not exist, create it from the latest
   `origin/main`; if it is stale, follow the replacement rule above.
2. Target feature PRs for the train at `next`; keep unrelated work on the usual
   feature-to-`main` path.
3. Dispatch the package workflow with `--ref next` and `prerelease=true` for the
   first RC. Use `version=rc-bump` for later RCs where supported.
4. Verify prerelease registry tags (`next`, RC Maven/NuGet/pub versions) and
   device/build checks.
5. Do not add an RC/next entry to the stable docs release history and do not run
   production `npm run deploy` from `next`.

When the remote branch is absent and creation is explicitly requested:

```bash
git fetch origin main
git switch --create next origin/main
git push --set-upstream origin next
```

Example:

```bash
gh workflow run release-expo.yml --ref next \
  -f version=minor -f prerelease=true
```

## Stable Release

1. Confirm the intended source changes are merged to `main` and
   `bun run audit:release-state` passes.
2. Dispatch with `--ref main`, `prerelease=false`, and the bump type relative to
   the stable version currently on `main`.
3. Wait for completion and inspect failed steps or warnings before continuing.
4. Verify the GitHub Release and public registry directly.

For a multi-package release train, use this order when affected:

1. `release-apple.yml`
2. `release-google.yml`
3. `release-react-native.yml`
4. `release-expo.yml`
5. `release-flutter.yml`
6. `release-godot.yml`
7. `release-kmp.yml`
8. `release-maui.yml`
9. `npm run deploy`, then `release.yml` with `version=current`

Fetch latest `main` before each dependent workflow so every release starts from
the prior stable version commit. After an Apple or Google release, confirm the
native workflow has derived and synchronized the spec floor before dispatching
the next package or docs release. Do not dispatch the full list in parallel.

## Verification Sources

Verify the registry, not only the GitHub Actions conclusion:

| Package      | Verification                                                             |
| ------------ | ------------------------------------------------------------------------ |
| Apple        | `pod trunk info openiap`; GitHub tag `{version}`                         |
| Google       | Maven Central POMs for Play, Amazon, and Horizon; tag `google-{version}` |
| React Native | `npm view react-native-iap@{version} version dist-tags --json`           |
| Expo         | `npm view expo-iap@{version} version dist-tags --json`                   |
| Flutter      | `https://pub.dev/api/packages/flutter_inapp_purchase/versions/{version}` |
| Godot        | GitHub Release and `godot-iap-{version}.zip` contents                    |
| KMP          | Maven Central `kmp-iap-{version}.pom` and GitHub Release                 |
| MAUI         | NuGet flat-container package and GitHub Release                          |
| Docs         | Production `openiap.dev` asset content and `docs-{spec}` release         |

Registry indexing can lag. Poll until the artifact is public or report a real
timeout; do not equate a successful upload response with completed indexing.

## Flutter Publisher

`release-flutter.yml` dispatches `publish-flutter.yml` exactly once on the
created tag. The publisher has no tag-push trigger. Do not manually dispatch a
second run unless the first run failed before publication.

## Godot Asset Library

The GitHub Release does not update Asset Library entry 4627. After a stable
Godot release, report the exact version and release ZIP URL so the maintainer
can update and submit the asset for review.

## Final Report

Include the workflow run URLs, stable/prerelease channel, registry evidence,
remaining manual work, warnings that need follow-up, issue state changes, and
whether any release run remains active.
