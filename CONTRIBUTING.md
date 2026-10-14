# Contributing to OpenIAP

Thanks for helping. Open an [issue](https://github.com/hyodotdev/openiap/issues)
for a bug, or start a [Discussion](https://github.com/hyodotdev/openiap/discussions)
before building a new API so its shape is agreed first. Small fixes can go
straight to a pull request.

## What You Need For Your Change

A docs text fix needs nothing local: edit the page under
`packages/docs/src/pages/` in the GitHub web editor and open the PR. For
anything else, install the toolchain for the area you touch and run its checks
from that directory. CI runs the same commands.

| Change                                        | Toolchain                     | Checks                                                                                                                        |
| --------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Docs site (`packages/docs`)                   | Bun                           | `bun run typecheck && bun run lint && bunx prettier --check "src/**/*.{ts,tsx,css}"`, then `bun run audit:docs` from the root |
| iOS/macOS native (`packages/apple`)           | Xcode 26                      | `swift build && swift test`                                                                                                   |
| Android native (`packages/google`)            | JDK 17                        | `./gradlew :openiap-core:test :openiap:test`                                                                                  |
| Client schema (`specs/client`)                | Bun                           | See [Changing the Client Schema](#changing-the-client-schema)                                                                 |
| Commerce Protocol (`specs/commerce-protocol`) | Bun, Node.js 20               | See [Changing the Commerce Protocol](#changing-the-commerce-protocol)                                                         |
| `libraries/react-native-iap`                  | Node.js 20, Yarn 3 (Corepack) | `yarn install && yarn lint:tsc && yarn test:ci`                                                                               |
| `libraries/expo-iap`                          | Bun                           | `bun install && bun run lint:tsc && bun run test`                                                                             |
| `libraries/flutter_inapp_purchase`            | Flutter 3.44                  | `flutter pub get && flutter analyze && flutter test`                                                                          |
| `libraries/godot-iap`                         | Godot 4.3+                    | `make test`                                                                                                                   |
| `libraries/kmp-iap`                           | JDK 17                        | `./gradlew :library:testPlayDebugUnitTest`                                                                                    |
| `libraries/maui-iap`                          | .NET 10 SDK                   | `dotnet test tests/OpenIap.Maui.Tests/OpenIap.Maui.Tests.csproj -p:TargetFrameworks=net10.0`                                  |

Bun is pinned to 1.3.13 by the root `package.json` `packageManager` field. The
pre-commit hook enforces that exact version only when you change dependencies
(a staged `package.json` or `bun.lock`). Root audit scripts need Node.js 22.

For the root workspace (docs, specs, and the pre-commit hook):

```bash
git clone https://github.com/hyodotdev/openiap.git
cd openiap
bun install
```

Each library's `CONTRIBUTING.md` (`AGENTS.md` for `maui-iap`) explains how to
run its example app. React Native's `example/` is a Yarn workspace, so the
library's `yarn install` already installs it.

## Changing the Client Schema

1. Edit `specs/client/src/*.graphql`.
2. Run `cd specs/client && bun run generate && bun run test`. Generation
   rewrites every language and syncs every SDK copy in one step.
3. Wire the change through each SDK with the
   [SDK Parity Checklist](knowledge/internal/04-platform-packages.md#sdk-parity-checklist-critical--prevents-declared-but-not-implemented),
   then run `bun run audit:parity` from the root.

Never edit generated files by hand; the list is in
[AGENTS.md](AGENTS.md#auto-generated-files-do-not-edit).

## Changing the Commerce Protocol

Start with the **Commerce Protocol proposal** issue form. The
[contribution procedure](specs/commerce-protocol/CONVENTION.md#public-collaboration-and-implementation-evidence)
covers the evidence and compatibility review. Edit `SPEC.md` and the owning
GraphQL layer under `schema/`, then run `bun run build && bun run test` in
`specs/commerce-protocol`. Never edit `specs/commerce-protocol/generated/`.

## Opening a Pull Request

- Fork, branch from `main`, and keep one change per PR.
- Write in English. Commit messages read `feat: add x` with a tag or `Add x`
  without one; scopes are listed in
  [Git Commit Message Format](knowledge/internal/06-git-deployment.md#git-commit-message-format).
- Say what changed and why in a few short paragraphs.
- Skip labels and the release-notes card. The maintainer adds both, and on
  outside PRs the release-note check only warns.
- Do not bump versions. Releases run from CI.

Maintainers: releases, versioning, and deployment are in
[`knowledge/internal/06-git-deployment.md`](knowledge/internal/06-git-deployment.md).
Project conventions start at [AGENTS.md](AGENTS.md).
