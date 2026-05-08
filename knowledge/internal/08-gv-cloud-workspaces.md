# GV Cloud Workspace Policy

> **Priority: MANDATORY**
> Follow this policy when using TabTabTab `gv` cloud environments with OpenIAP.

`gv` can be useful for OpenIAP as a safe remote maintenance runner, not as a
release, signing, or production-credential environment. Treat every GV
workspace as an external cloud workspace with GitHub access and no local secret
trust by default.

## Safe role for OpenIAP

Use GV for secret-free OSS maintenance work:

- Documentation edits, release notes, docs typecheck, and docs consistency
  audits.
- `packages/gql` tests and schema/codegen review work that does not require
  private credentials.
- `packages/kit` typecheck and unit tests that run without production env vars.
- PR review response work on isolated branches/worktrees.
- Long-running lint/test/build smoke checks that should survive local laptop
  sleep or high local resource use.

Do not treat GV as the source of truth for full OpenIAP release validation.
Native Apple signing, Play/App Store production credentials, package publishing,
and deployment stay in the existing local or CI release systems.

## Required boundaries

Always keep these boundaries unless the repository owner explicitly changes this
policy:

- Onboard the repo with env capture disabled:

  ```bash
  gv repo add . --skip-env
  ```

- First test of any new GV version or environment should be:

  ```bash
  gv repo add . --dry-run --skip-env
  ```

- GitHub App access must be limited to the selected `hyodotdev/openiap`
  repository. Do not grant all-repository access.
- Do not enable OpenAI/Codex auth mirroring for OpenIAP by default.
- Do not enable local profile, CLI, shell, editor, or credential mirroring by
  default.
- Do not add production, payment, signing, release, or deployment secrets to GV.
- If credentials are ever needed for a GV experiment, use sandbox/test-only
  credentials with explicit owner approval.

## Forbidden commands and actions

Never run or recommend these for OpenIAP GV work:

```bash
gv repo add . --yes
gv repo env list --reveal
gv env info --reveal
gv env info --qr
```

Also do not upload, reveal, or sync:

- `.env`, `.env.local`, `.env.*`
- App Store Connect `.p8` keys
- Google service-account JSON files
- signing keys, provisioning profiles, certificates, keystores, and JKS files
- npm, NuGet, Maven Central, CocoaPods, Fly, Convex, App Store, Google Play, or
  payment provider credentials

One-time GV login URLs and workspace URLs should be treated as sensitive access
links. Do not paste them into issues, PRs, public docs, or long-lived logs.

## Known GV baseline for this repo

Validated on 2026-05-08 with a GV `agent-sandbox` environment:

- Repo onboarding with `--skip-env` completed.
- `gv repo env list --repo openiap --json` returned an empty env var list.
- OpenAI auth status was disabled.
- GitHub access was enabled only after selected-repository approval.
- Cloud clone was clean on `main` from
  `https://github.com/hyodotdev/openiap.git`.
- The default environment had `node`, `npm`, `corepack`, `python3`, `git`, and
  `docker`.
- The default environment did not have `bun`, `yarn`, `java`, `swift`,
  `flutter`, or `dotnet`.
- No `.devcontainer/devcontainer.json` existed in the repo at validation time.

Because Bun is not available in the default GV environment, the safe current
pattern is to run Bun checks inside Docker containers with the workspace mounted
read-only.

## Safe verification pattern

Prefer an ephemeral Docker container with a read-only repo mount and an internal
copy:

```bash
gv ssh --env agent-sandbox -- \
  'set -eu
  OPENIAP_PATH="${OPENIAP_PATH:-$HOME/workspace/openiap}"
  test -d "$OPENIAP_PATH"
  docker run --rm \
    -v "$OPENIAP_PATH:/src:ro" \
    -w /work \
    oven/bun:1.3.13 \
    bash -lc "cp -a /src/. /work && bun install --frozen-lockfile && bun run audit:docs"'
```

Why this pattern:

- `:ro` prevents the container from writing to the GV checkout.
- `/work` is a temporary container copy, so `node_modules`, build output, and
  generated files disappear when the container exits.
- It avoids syncing local env files or local uncommitted changes.

After any GV run, verify both workspace cleanliness and env state:

```bash
gv ssh --env agent-sandbox -- \
  'cd ~/workspace/openiap && git status --short --branch'

gv repo env list --repo openiap --json
```

## Verified safe smoke checks

These checks have run successfully in the GV/Docker read-only pattern:

```bash
# GQL tests
cd packages/gql && bun run test

# Docs typecheck
cd packages/docs && bun run typecheck

# Kit typecheck and tests
cd packages/kit && bun run typecheck && bun run test

# Docs consistency audit
bun run audit:docs
```

Use these as the first GV regression suite for docs, GQL, and IAPKit
maintenance work.

## Out of scope for GV until explicitly proven

Do not use GV as the default runner for:

- `packages/apple` SwiftPM/Xcode signing or release workflows.
- iOS/macOS Godot, Expo, React Native, KMP, Flutter, or MAUI device builds.
- Android/KMP release publishing that needs Maven Central signing credentials.
- Flutter pub.dev, npm, NuGet, CocoaPods trunk, GitHub release, or deployment
  publishing.
- Fly/Convex production deploys.
- Any flow that requires production IAP, payment, App Store Connect, Google
  Play, or signing credentials.

Linux-friendly Android/KMP checks may become reasonable after the repository has
a minimal GV/devcontainer setup with Java installed, but production credentials
still remain out of scope.

## Branch and PR workflow

Use GV for isolated work, not direct `main` edits:

1. Start from the clean cloud clone.
2. Create a branch such as `codex/docs-gv-audit` or `codex/kit-gv-smoke`.
3. Run only secret-free checks.
4. Review `git diff` and `git status`.
5. Push only intentional source changes.
6. Open a PR for normal CI review.

Do not push release, signing, or deployment changes from GV without explicit
owner approval.

## Future improvement

If GV becomes part of regular maintenance, add a minimal devcontainer or setup
script for the Linux-friendly subset:

- Bun pinned to the root `packageManager`.
- Node/Corepack.
- Java for Gradle checks.
- Optional Android command-line tooling if needed.

Do not add Swift, Xcode, Flutter, .NET, signing tools, or production secret
setup to the first GV devcontainer. Keep the first iteration small and focused
on docs, GQL, kit, and non-release Android/KMP smoke checks.
