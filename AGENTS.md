# OpenIAP Monorepo - Agent Guidelines

Instructions for AI agents working in the OpenIAP monorepo. Detailed rules live
in `knowledge/internal/`, the Single Source of Truth (SSOT); this file routes to
them. Human contributors start at [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick Reference

| Topic                   | File                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naming Conventions      | [`knowledge/internal/01-naming-conventions.md`](knowledge/internal/01-naming-conventions.md)                                                                                    |
| Architecture            | [`knowledge/internal/02-architecture.md`](knowledge/internal/02-architecture.md)                                                                                                |
| Coding Style            | [`knowledge/internal/03-coding-style.md`](knowledge/internal/03-coding-style.md)                                                                                                |
| Platform Packages       | [`knowledge/internal/04-platform-packages.md`](knowledge/internal/04-platform-packages.md) (run `bun audit:parity` before commits; CI runs the same SDK parity job)             |
| Docs Patterns           | [`knowledge/internal/05-docs-patterns.md`](knowledge/internal/05-docs-patterns.md)                                                                                              |
| Git & Deployment        | [`knowledge/internal/06-git-deployment.md`](knowledge/internal/06-git-deployment.md)                                                                                            |
| Docs Consistency / SSOT | [`knowledge/internal/07-docs-consistency.md`](knowledge/internal/07-docs-consistency.md) (run `bun audit:docs` before pushing API/Type doc edits)                               |
| Community Touchpoints   | [`knowledge/internal/09-community-touchpoints.md`](knowledge/internal/09-community-touchpoints.md) (first-purchase notice, assistant note, README section; one source of truth) |
| Agent Tooling           | [`knowledge/internal/10-agent-tooling.md`](knowledge/internal/10-agent-tooling.md) (per-tool setup, compiled context, skills and slash commands)                                |
| Research References     | [`knowledge/research/README.md`](knowledge/research/README.md) (paper registry and evidence-backed engineering backlog)                                                         |

## Monorepo Structure

```text
openiap/
├── packages/
│   ├── cli/           # `openiap init` + `doctor` CLI (npm)
│   ├── conformance/   # Behavioral conformance spec, runner, and reports
│   ├── docs/          # Documentation site (React/Vite/Vercel)
│   ├── google/        # Android library
│   ├── apple/         # iOS/macOS library
│   ├── kit/           # Purchase validation + entitlement infrastructure (Fly.io app)
│   └── mcp-server/    # IAPKit MCP server (hosted at kit.openiap.dev/mcp)
├── specs/             # Publishable specifications; never deployed services
│   ├── client/             # Client GraphQL contract + multiplatform code generation
│   └── commerce-protocol/  # Vendor-neutral server-side commerce contract
├── plugins/
│   └── openiap/       # Codex + Claude Code plugin (skills + MCP config)
├── libraries/         # Framework SDK implementations
│   ├── react-native-iap/  # React Native (npm)
│   ├── expo-iap/          # Expo (npm)
│   ├── flutter_inapp_purchase/  # Flutter (pub.dev)
│   ├── godot-iap/         # Godot 4.x (GitHub Release)
│   ├── kmp-iap/           # Kotlin Multiplatform (Maven Central)
│   └── maui-iap/          # .NET MAUI / C# (NuGet)
├── knowledge/         # Shared knowledge base (SSOT)
│   ├── internal/      # Project philosophy (HIGHEST PRIORITY)
│   ├── external/      # External API reference
│   ├── _agent-context/   # Compiled context shared by AI assistants
│   └── _claude-context/  # Compatibility link to _agent-context
├── scripts/           # Monorepo-wide automation
└── .github/workflows/ # CI/CD workflows
```

## Required Pre-Work

**CRITICAL**: Before writing or editing anything in a package or library:

1. **Read the relevant knowledge files** from `knowledge/internal/`
   - When the GraphQL schema adds or changes an API, follow the **SDK Parity Checklist** in [`knowledge/internal/04-platform-packages.md`](knowledge/internal/04-platform-packages.md#sdk-parity-checklist-critical--prevents-declared-but-not-implemented) to avoid phantom interfaces (declared in types but never wired end-to-end — the class of bug behind GitHub issue #104).
2. **Check the package-specific CONVENTION.md**:
   - [`specs/client/CONVENTION.md`](specs/client/CONVENTION.md)
   - [`packages/google/CONVENTION.md`](packages/google/CONVENTION.md)
   - [`packages/apple/CONVENTION.md`](packages/apple/CONVENTION.md)
   - [`packages/docs/CONVENTION.md`](packages/docs/CONVENTION.md)
   - [`specs/commerce-protocol/CONVENTION.md`](specs/commerce-protocol/CONVENTION.md) — the server-side commerce specification; its GraphQL contract is the authoring SSOT, JSON Schemas are generated validator artifacts, and IAPKit conforms to the spec, never the reverse
   - [`packages/kit/CONVENTION.md`](packages/kit/CONVENTION.md) — kit is a deployable SaaS (not a library); has its own Convex schema and isn't part of the GQL type-sync chain. Its `/v1` responses are still a published contract that shipped SDKs decode: read the `/v1` response contract section and run `bun audit:kit-contract` before changing a response enum, `isValidState`, or a purchase-state mapping
3. **For framework libraries, read the library-specific AGENTS.md**:
   - [`libraries/react-native-iap/AGENTS.md`](libraries/react-native-iap/AGENTS.md) — Yarn 3, Nitro Modules, useIAP hook semantics, error handling
   - [`libraries/expo-iap/AGENTS.md`](libraries/expo-iap/AGENTS.md) — Bun, Expo Modules, iOS podspec 13.4 workaround, tvOS 16.0 requirement
   - [`libraries/flutter_inapp_purchase/AGENTS.md`](libraries/flutter_inapp_purchase/AGENTS.md) — Flutter/Dart, generated types.dart, fetchProducts generic API
   - [`libraries/godot-iap/AGENTS.md`](libraries/godot-iap/AGENTS.md) — GDScript conventions, GDExtension (iOS), AAR plugin (Android)
   - [`libraries/kmp-iap/AGENTS.md`](libraries/kmp-iap/AGENTS.md) — Kotlin Multiplatform, Flow-based API, SwiftPM iOS integration
   - [`libraries/maui-iap/AGENTS.md`](libraries/maui-iap/AGENTS.md) — .NET MAUI / C# 12, generated Types.cs, Android/iOS bindings

## Key Rules Summary

### Code and Docs Quality

- **KISS and SSOT** are release criteria; apply
  [the canonical rules](knowledge/internal/03-coding-style.md#0-kiss-and-ssot-are-release-requirements)
  before implementation and during every review.
- **Clean up once it works**: reread the diff for duplication, redundant
  fallbacks, and stale comments, and fix smells you meet even outside the
  change. Never write `as any`.
  [Checklist](knowledge/internal/03-coding-style.md#clean-up-once-it-works).
- **Comments**: one line by default, point first, plain words; keep only what
  the code cannot show.
  [Checklist](knowledge/internal/03-coding-style.md#keep-them-short--especially-ai-generated-ones).
- **Docs**: lead with the outcome, state each fact once, keep required caveats.
  Apply the
  [Reader-First Writing Standard](knowledge/internal/05-docs-patterns.md#reader-first-writing-standard).
- **Layout**: extend the existing owner instead of adding a parallel root
  directory, per the
  [Directory Ownership Guardrail](knowledge/internal/02-architecture.md#directory-ownership-guardrail);
  run `bun run audit:layout` after moving directories.

### Docs Ship With The Change

A PR into `main` that changes a published package also updates the guides it
affects and the release card for the next version, written as already
published. Apply the
[Release Note Completeness Gate](knowledge/internal/05-docs-patterns.md#release-note-completeness-gate)
before creating or updating a PR, declaring review clean, or releasing. On PRs
from outside contributors the maintainer adds the card.

### Public GitHub Writing

- Everything posted to GitHub (issues, PRs, reviews, Discussions, commits,
  release notes) is in English; follow the
  [language guard](knowledge/internal/06-git-deployment.md#public-github-communication-language).
- Write like a maintainer explaining the change to a colleague: what changed
  and why, short sentences, no preamble or investigation narrative. A PR body
  is a few short paragraphs (thirty lines at most); a review reply is one to
  three sentences. [Style rules](knowledge/internal/06-git-deployment.md#public-github-communication-style).
- Creating or updating an issue, Discussion, or PR includes choosing its
  labels with `$github-labels` per the
  [GitHub Labels policy](knowledge/internal/06-git-deployment.md#github-labels).

### Opening Pull Requests

This rule binds AI agents and maintainer sessions; human contributors are
welcome to open PRs. Open a new PR only when the maintainer explicitly requests
it. Permission for one PR, or to continue, merge, or release, does not
authorize follow-up PRs. Keep small fixes in the relevant open PR, and leave
unrelated PRs alone. A small docs fix with no open PR is a one-line question
about committing straight to `main`. Claude Code holds PR creation for approval
(`scripts/guard-pull-request.mjs`).
[Canonical rule](knowledge/internal/06-git-deployment.md#opening-pull-requests).

### Platform Function Naming

- **iOS functions**: Must end with `IOS` suffix (e.g., `syncIOS`, `getReceiptDataIOS`)
- **Android functions in packages/google**: NO `Android` suffix (it's Android-only)
- **Cross-platform functions**: NO suffix

### Physical iPhone Testing

Do not use iPhone Mirroring for debugging, purchases, or E2E tests. Follow the
direct-device XCUITest procedure in
[`.codex/skills/e2e-matrix-runner/SKILL.md`](.codex/skills/e2e-matrix-runner/SKILL.md).
Report unavailable checks as `BLOCKED` (unverified), never as passed.

### Production Data Guardrail

- **Never write to a production deployment**: no mutation or action from the
  Convex dashboard runner or `npx convex run --prod`, and no HTTP call that is
  not a plain read. The dashboard runner preselects the last function used,
  which has included `drainAccountDeletionBatch`; confirm the selection before
  pressing Run, and prefer not opening it.
- Never edit, insert, or delete documents in the production data browser.
  Schema and data changes ship through a reviewed deploy.
- Read production only when asked (tables, counts, logs, health), report
  aggregates, and never copy customer emails or other personal data anywhere.
- Try things on the **dev** deployment; a missing query is added to
  `packages/kit/convex` and reaches production through the normal deploy.
- Unsure which deployment is selected? Stop and confirm; the dashboard shows
  it next to the project name (e.g. `Production • healthy-kudu-836`).

### Webhook Direction Guardrail

Webhooks run server-to-server only: store → IAPKit, and IAPKit → a developer
backend the project owner registered. Never add an IAPKit → SDK/mobile webhook
stream, SSE endpoint, WebSocket, push relay, or long-poll feed; device push
belongs to the developer's backend, and a shipped app never gets project-wide
lifecycle events or a secret key. `bun audit:parity` enforces this; do not
weaken it to bring the feature back. See
[IAPKit webhook boundary](knowledge/internal/02-architecture.md#iapkit-webhook-boundary).

### Auto-Generated Files (DO NOT EDIT)

Never edit these by hand. `cd specs/client && bun run generate` regenerates
them and syncs every target in `specs/client/generated-sync-manifest.mjs`:

- `specs/client/src/generated/*`
- `packages/apple/Sources/Models/Types.swift`
- `packages/apple/Sources/OpenIapGeneratedVersion.swift` (from `openiap-versions.json`)
- `packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt`
- `libraries/react-native-iap/src/types.ts`
- `libraries/expo-iap/src/types.ts`
- `libraries/flutter_inapp_purchase/lib/types.dart`
- `libraries/godot-iap/addons/godot-iap/types.gd`
- `libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt`
- `libraries/maui-iap/src/OpenIap.Maui/Types.cs`
- `libraries/{react-native-iap,expo-iap}/src/{kit-api,purchase-flow}.ts`
- `libraries/expo-iap/src/utils/errorMapping.ts` and its
  `__tests__/errorMapping.shared.test.ts` (mirrored from react-native-iap)

`openiap-versions.json` tracks only `clientProtocol`, `google`, `apple`, and the
`plugins/openiap` `plugin` version, and only release CI changes it; feature work
never edits version fields, plugin manifests included. Framework library
versions live in each library's own metadata. See
[Version File Management](knowledge/internal/06-git-deployment.md#version-file-management).

### Commits and Releases

- Commit format: `feat: add new feature` with a tag (lowercase after it),
  `Add new feature` without one. Scopes are in
  [Git Commit Message Format](knowledge/internal/06-git-deployment.md#git-commit-message-format).
- Package releases run from `main` through explicit workflow dispatches;
  merging publishes nothing, and Vercel deploys docs from `main`. Read
  `.claude/commands/release.md` before any deployment. Historical RC sources
  are retained by a protected archive tag; never change or delete it. Policy:
  [Main And Release Channels](knowledge/internal/06-git-deployment.md#main-and-release-channels).

## Agent Tooling

Per-tool setup (Codex, Claude Code, Grok, Muse, Cursor), the compiled context,
and the full skill and slash-command list are in
[`knowledge/internal/10-agent-tooling.md`](knowledge/internal/10-agent-tooling.md).
After editing `knowledge/`, run `cd scripts/agent && bun run compile:ai`.
