---
name: ship-release
description: Merge a verified OpenIAP PR, release every affected stable package one at a time, verify each public registry, publish the consolidated release note, stabilize it with review-self, and deploy production docs. Use when the user explicitly asks for this full post-review shipping workflow.
---

# Ship an OpenIAP Release

Complete a verified OpenIAP change from merge through public package and docs
delivery. This skill coordinates existing repository workflows; their detailed
rules remain the SSOT.

## Authority and required reading

This workflow performs public and irreversible actions. Use it only when the
user explicitly authorizes the requested merge, package publication, docs
deployment, and any direct `main` push. Missing authority for one stage stops
that stage without broadening the others.

Before acting, read:

- `AGENTS.md`
- `.codex/skills/openiap-workflows/SKILL.md`
- `.claude/commands/release.md`
- `.codex/skills/generate-doc/SKILL.md`
- `.codex/skills/review-self/SKILL.md`
- `.claude/commands/commit.md`

Load every convention file and specialized E2E skill required by the changed
paths. Never mutate production Convex data.

## 1. Establish the exact release scope

1. Confirm the PR is approved, required CI is successful on its exact head,
   review threads are clear, and any required device gate has passed or has an
   explicit recorded waiver.
2. Merge with the repository-supported method, then fast-forward local `main`.
3. Require a clean worktree and verify `HEAD` equals `origin/main`.
4. Classify affected packages from the merged diff. Release only packages with
   a user-visible or contract-relevant change; do not bump unaffected packages
   for symmetry.
5. Select stable SemVer bumps from the actual compatibility impact and run all
   preflight audits required by `.claude/commands/release.md`.

## 2. Publish packages sequentially

Release one affected package at a time in the canonical dependency order:

1. Apple
2. Google
3. React Native
4. Expo
5. Flutter
6. Godot
7. KMP
8. MAUI
9. Conformance, only when affected

For each package:

1. Dispatch the stable release workflow from the exact current `main`.
2. Wait for every validation and publication job to finish successfully.
3. Fast-forward local `main` and fetch the new tag.
4. Confirm package metadata, the release tag, and the release commit agree.
5. Verify the artifact through its public registry or distribution endpoint,
   including provenance or consumer smoke checks when the workflow supplies
   them. Registry propagation can lag; poll until the public endpoint returns
   the new version before starting the next package.

Do not run package releases concurrently. Stop on the first failed gate and
report the exact workflow job and package state.

Godot releases also require the authenticated Godot Asset Library listing to be
updated. Prepare the edit when possible, request action-time confirmation before
the public form submission, and report it as an explicit remaining manual step
when authentication is unavailable. Never reuse credentials supplied for a
different service.

## 3. Write the shipped release note

After every package version and public URL is known, use `generate-doc` to add
or update the consolidated release card in
`packages/docs/src/pages/docs/updates/releases.tsx`.

- Read versions from current package metadata, not from the release plan.
- Link the real package tags. The docs/spec tag may be the expected tag until
  the docs release is created.
- Lead with user-visible behavior, include required migration or platform
  caveats once, and omit version-bump mechanics.
- Add no versioned IAPKit entry; it is a service.

## 4. Stabilize and commit

Run `review-self` against the complete docs and workflow diff until two
consecutive full snapshots are clean at least five minutes apart. A material
change resets the clean count. Run all path-specific validation, including the
docs build, docs and release-state audits, skill validation, and
`git diff --check`.

Commit and push through `.claude/commands/commit.md`. An explicit invocation of
this full shipping workflow authorizes the release-note and release-process
documentation commit directly on `main`; do not open a PR for that post-release
docs-only commit. Immediately before committing, fast-forward from `origin/main`
and revalidate that the intended files are the only changes. Product-code fixes
still return to the normal PR loop.

## 5. Deploy and verify docs

From a clean local `main` equal to `origin/main`:

1. Run `npm run deploy` and wait for successful production completion.
2. Fetch the production release page and generated LLM documents with a cache
   buster. Confirm the new release title, API name, versions, and generated
   timestamp are present.
3. If the OpenIAP Spec advanced, dispatch the docs release workflow with the
   current version and verify the resulting `docs-{spec}` GitHub Release points
   to the deployed commit.
4. Recheck required CI for the final `main` head and report any still-pending
   external listing or registry state separately.

## Completion report

Report the merged PR and commit, every published version with its public
verification, docs commit and deployment result, review-self clean snapshots,
the docs release, and any explicitly incomplete external marketplace update.
