# OpenIAP Monorepo - Agent Guidelines

This document provides an overview for AI agents working across the OpenIAP monorepo.

**All detailed rules are in the `knowledge/internal/` folder** - this is the Single Source of Truth (SSOT).

## Quick Reference

| Topic                   | File                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Naming Conventions      | [`knowledge/internal/01-naming-conventions.md`](knowledge/internal/01-naming-conventions.md)                                                                               |
| Architecture            | [`knowledge/internal/02-architecture.md`](knowledge/internal/02-architecture.md)                                                                                           |
| Coding Style            | [`knowledge/internal/03-coding-style.md`](knowledge/internal/03-coding-style.md)                                                                                           |
| Platform Packages       | [`knowledge/internal/04-platform-packages.md`](knowledge/internal/04-platform-packages.md) (run `bun audit:parity` before commits; pre-commit mirrors CI's SDK parity job) |
| Docs Patterns           | [`knowledge/internal/05-docs-patterns.md`](knowledge/internal/05-docs-patterns.md)                                                                                         |
| Git & Deployment        | [`knowledge/internal/06-git-deployment.md`](knowledge/internal/06-git-deployment.md)                                                                                       |
| Docs Consistency / SSOT | [`knowledge/internal/07-docs-consistency.md`](knowledge/internal/07-docs-consistency.md) (run `bun audit:docs` before pushing API/Type doc edits)                          |

## Monorepo Structure

```text
openiap/
├── packages/
│   ├── docs/          # Documentation site (React/Vite/Vercel)
│   ├── gql/           # GraphQL schema & type generation
│   ├── google/        # Android library
│   ├── apple/         # iOS/macOS library
│   ├── kit/           # Hosted receipt-validation SaaS (Fly.io app)
│   └── mcp-server/    # IAPKit MCP server (hosted at kit.openiap.dev/mcp)
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
│   └── _claude-context/  # Compiled context for Claude Code
├── scripts/           # Monorepo-wide automation
└── .github/workflows/ # CI/CD workflows
```

## Required Pre-Work

**CRITICAL**: Before writing or editing anything in a package or library:

1. **Read the relevant knowledge files** from `knowledge/internal/`
   - When the GraphQL schema adds or changes an API, follow the **SDK Parity Checklist** in [`knowledge/internal/04-platform-packages.md`](knowledge/internal/04-platform-packages.md#sdk-parity-checklist-critical--prevents-declared-but-not-implemented) to avoid phantom interfaces (declared in types but never wired end-to-end — the class of bug behind GitHub issue #104).
2. **Check the package-specific CONVENTION.md**:
   - [`packages/gql/CONVENTION.md`](packages/gql/CONVENTION.md)
   - [`packages/google/CONVENTION.md`](packages/google/CONVENTION.md)
   - [`packages/apple/CONVENTION.md`](packages/apple/CONVENTION.md)
   - [`packages/docs/CONVENTION.md`](packages/docs/CONVENTION.md)
   - [`packages/kit/CONVENTION.md`](packages/kit/CONVENTION.md) — kit is a deployable SaaS (not a library); has its own Convex schema and isn't part of the GQL type-sync chain
3. **For framework libraries, read the library-specific CLAUDE.md**:
   - [`libraries/react-native-iap/CLAUDE.md`](libraries/react-native-iap/CLAUDE.md) — Yarn 3, Nitro Modules, useIAP hook semantics, error handling
   - [`libraries/expo-iap/CLAUDE.md`](libraries/expo-iap/CLAUDE.md) — Bun, Expo Modules, iOS podspec 13.4 workaround, tvOS 16.0 requirement
   - [`libraries/flutter_inapp_purchase/CLAUDE.md`](libraries/flutter_inapp_purchase/CLAUDE.md) — Flutter/Dart, generated types.dart, fetchProducts generic API
   - [`libraries/godot-iap/CLAUDE.md`](libraries/godot-iap/CLAUDE.md) — GDScript conventions, GDExtension (iOS), AAR plugin (Android)
   - [`libraries/kmp-iap/CLAUDE.md`](libraries/kmp-iap/CLAUDE.md) — Kotlin Multiplatform, Flow-based API, CocoaPods iOS integration
   - [`libraries/maui-iap/CLAUDE.md`](libraries/maui-iap/CLAUDE.md) — .NET MAUI / C# 12, generated Types.cs, Android/iOS bindings

## Key Rules Summary

### Public Collaboration Language

All repository-authored public GitHub content must be written in English.
Before posting or editing issues, pull requests, reviews, discussions, commits,
release notes, or GitHub Releases, follow the mandatory language guard in
[`knowledge/internal/06-git-deployment.md`](knowledge/internal/06-git-deployment.md#public-github-communication-language).

### KISS and SSOT

KISS and SSOT are mandatory release criteria. The canonical rules live in
[`knowledge/internal/03-coding-style.md`](knowledge/internal/03-coding-style.md#0-kiss-and-ssot-are-release-requirements).
Apply that section before implementation and during every review.

### Comment Style

Keep comments short — default to one line. AI-authored comments over-explain by
default, so trim before committing: no restating the code, no narrating the
change or its history (that belongs in the commit message), no explaining
well-known APIs. Keep only what the code cannot show: platform quirks, non-obvious
constraints, and why an obvious alternative was rejected. Full checklist in
[`knowledge/internal/03-coding-style.md`](knowledge/internal/03-coding-style.md#keep-them-short--especially-ai-generated-ones).

### Reader-First Documentation

Write every user-facing document for scanning and action. Lead with the outcome,
state each fact once, and remove filler, implementation narration, repeated
cross-package boilerplate, and detail that does not change user behavior. Keep
required compatibility, migration, safety, and platform caveats. Apply the
canonical standard in
[`knowledge/internal/05-docs-patterns.md`](knowledge/internal/05-docs-patterns.md#reader-first-writing-standard),
including its stricter release-note limits.

### Platform Function Naming

- **iOS functions**: Must end with `IOS` suffix (e.g., `syncIOS`, `getReceiptDataIOS`)
- **Android functions in packages/google**: NO `Android` suffix (it's Android-only)
- **Cross-platform functions**: NO suffix

### Webhook Direction Guardrail

- The only supported webhook direction is **store → IAPKit**: Apple App Store
  Server Notifications and Google Play RTDN enter IAPKit and update its backend
  state.
- Never add an **IAPKit → SDK/mobile** webhook stream, SSE endpoint, WebSocket,
  push relay, or long-poll event feed. Mobile SDKs use bounded request/response
  verification and scoped status or entitlement reads.
- If a product needs device push notifications, the developer's authenticated
  backend owns that delivery. Do not expose project-wide lifecycle events or a
  secret key to a shipped app.
- `bun audit:parity` enforces the removed outbound-stream files and public
  identifiers. Do not weaken that audit to reintroduce the feature.

### Auto-Generated Files (DO NOT EDIT)

- `packages/gql/src/generated/*` - All generated type files (SSOT)
- `packages/apple/Sources/Models/Types.swift` - Synced from GQL
- `packages/google/openiap/src/main/java/dev/hyo/openiap/Types.kt` - Synced from GQL
- `libraries/react-native-iap/src/types.ts` - Synced from GQL
- `libraries/expo-iap/src/types.ts` - Synced from GQL
- `libraries/flutter_inapp_purchase/lib/types.dart` - Synced from GQL
- `libraries/godot-iap/addons/godot-iap/types.gd` - Synced from GQL
- `libraries/kmp-iap/library/src/commonMain/kotlin/io/github/hyochan/kmpiap/openiap/Types.kt` - Synced from GQL
- `libraries/maui-iap/src/OpenIap.Maui/Types.cs` - Synced from GQL
- `openiap-versions.json` - Tracks only `spec`, `google`, and `apple`. Google
  and Apple are CI-managed. `spec` must equal the lower semantic version of
  `google` and `apple`; it is never bumped directly in a feature PR or docs
  deployment. Native version writers update their native key and the derived
  `spec` atomically, then the sync workflow propagates package metadata.
  Release-state, docs, parity, and sync audits reject floor drift.

Framework library package versions (React Native, Expo, Flutter, Godot, KMP,
MAUI) live in their own package metadata / release workflows. Do not add
framework-library version keys to `openiap-versions.json`.

When writing release notes or `Package Releases` lists, verify framework
versions from each library's metadata and verify published links with GitHub
release tags. Do not infer framework versions from `openiap-versions.json` or
copy nearby release blocks without checking the actual package/tag.

Regenerate and sync types:

```bash
cd packages/gql && bun run generate  # Generate every language and sync every manifest target
```

### GQL Code Generation System

Type generation has two guarded lanes over the same schema inventory and
contract metadata:

```text
GraphQL Schema ─┬─► graphql-codegen + AST guards ─► TypeScript
                └─► Parser → IR → language plugins ─► Swift/Kotlin/Dart/GDScript/C#
                                                        ↓
                                             generated-sync-manifest.mjs
```

**Language plugins handle:**

- **Swift**: Codable protocol, ErrorCode custom initializer, platform defaults
- **Kotlin**: sealed interface, fromJson/toJson with nullable patterns
- **Dart**: sealed class, factory constructors, extends/implements
- **GDScript**: \_init() pattern, Variant type for unions
- **C#**: sealed records, per-enum JsonConverter, [JsonPolymorphic] unions

### Git Commit Format

- With tag: `feat: add new feature` (lowercase after tag)
- Without tag: `Add new feature` (uppercase first letter)

### Release Branch Policy

- `main` is stable-only. Stable package releases and production docs deploy
  from `main`; `bun run audit:release-state` rejects prerelease metadata there.
- `next` is an on-demand prerelease integration branch for unusual release
  trains. RC and npm `next` releases run from `next` only.
- Do not merge prerelease version-only commits from `next` into `main`. Promote
  reviewed source changes through a clean `main` PR, then release stable from
  `main` using the bump type relative to its stable metadata.
- Read `.claude/commands/release.md` before any package deployment.

## Using Claude Code with Context

```bash
cd scripts/agent

# Compile for AI assistants (no Ollama required)
bun run compile:ai

# Or compile for both Claude Code + Local RAG
bun run compile

# Use with Claude Code
claude --context knowledge/_claude-context/context.md
```

## Codex Compatibility

`AGENTS.md` is the root project instruction SSOT. `CLAUDE.md` and `GEMINI.md`
are symlinks to `AGENTS.md`, so Claude Code, Gemini, and Codex read the same
root instructions. The `.claude/commands/` files remain the workflow SSOT for
slash-command-style tasks.

Codex supports Skills through `SKILL.md` folders. This repo provides
Codex-compatible local skills in `.codex/skills/`, including
`openiap-workflows` for mapping Claude slash-command workflows and `review-self`
for repeated self-review of current work.

Codex discovers `review-self` and `loop-review` from this repository. Install
the globally unique skills (`openiap-workflows` and `generate-doc`) into your
local Codex home when needed:

```bash
./.codex/scripts/install-skills.sh
```

After installation, ask Codex normally (for example, "review PR 65" or
"resolve issue 88"), or explicitly mention `$openiap-workflows` or
`$review-self`.

Keep `$review-self` and `$loop-review` repo-local. Their review, merge, and
release-safety policies are project-specific; globally linking them could apply
the wrong repository workflow elsewhere.

## Claude Code Compatibility

Claude Code gets the same workflow surface without any install step:

- **Slash commands**: `.claude/commands/*.md` load automatically as
  `/review-pr`, `/verify-all`, and so on.
- **Skills**: `.claude/skills/<name>/SKILL.md` are Claude Code adapters for
  the `.codex/skills/<name>/SKILL.md` bodies. The Codex file stays the
  canonical procedure; the Claude adapter points at it and adds only
  Claude-specific notes (browser tooling, wake-up mechanism, subagents).
  When you change a skill under `.codex/skills/`, check whether the matching
  `.claude/skills/` adapter needs the same update.
- **MCP server**: the root `.mcp.json` registers the hosted IAPKit MCP
  endpoint (`https://kit.openiap.dev/mcp`) as a project-scoped server.
  Export `IAPKIT_API_KEY` before launching Claude Code to authenticate.

For consumers outside this repo, `.claude-plugin/marketplace.json` publishes
the `plugins/openiap` plugin as a Claude Code marketplace:

```bash
claude plugin marketplace add hyodotdev/openiap
claude plugin install openiap@openiap
```

`plugins/openiap` is dual-manifest: `.codex-plugin/plugin.json` (Codex, MCP
config at `.codex-plugin/mcp.json`) and `.claude-plugin/plugin.json` (Claude
Code, inline MCP config). The `skills/` folder is shared by both agents, so
keep its wording agent-neutral.

## Cursor Compatibility

Cursor reads the root `AGENTS.md` and `CLAUDE.md`; because `CLAUDE.md` is a
symlink, both resolve to this SSOT. `.cursor/rules/openiap-ssot.mdc` is only a
short always-applied router to the root and docs SSOT. Keep detailed project
rules in `AGENTS.md` or `knowledge/internal/` instead of copying them into
Cursor-specific files.

## Available Skills (Slash Commands / Codex Workflows)

| Skill                | Description                                        | Usage                                 |
| -------------------- | -------------------------------------------------- | ------------------------------------- |
| `$review-self`       | Review and improve current work until stable       | `$review-self` or `$review-self <PR>` |
| `$loop-review`       | Start from current main, review, PR, and merge     | `$loop-review`                        |
| `$rebase-main`       | Pull main and safely rebase the current branch     | `$rebase-main`                        |
| `/review-pr`         | Review PR comments, fix issues, resolve threads    | `/review-pr 65` or `/review-pr <url>` |
| `/audit-code`        | Audit code against knowledge rules and latest APIs | `/audit-code`                         |
| `/compile-knowledge` | Compile knowledge base for Claude context          | `/compile-knowledge`                  |
| `/resolve-issue`     | Analyze an issue, label it, and fix/comment        | `/resolve-issue 88`                   |
| `/verify-all`        | Run the full monorepo health check                 | `/verify-all`                         |
| `/e2e-tests`         | Run device-backed OpenIAP regression tests         | `/e2e-tests PR 162`                   |
| `/release`           | Release stable packages or an on-demand RC train   | `/release all stable`                 |
| `/commit`            | Branch, commit, push, and optionally create PR     | `/commit --all --pr`                  |

### $review-self Workflow

1. Reviews the complete current diff, including staged, unstaged, and untracked
   work, against the original request and repository conventions
2. Fixes validated in-scope findings and runs path-specific verification
3. Rechecks through a real recurring wake-up at the user's requested interval,
   defaulting to five minutes
4. Finishes after two consecutive clean snapshots, or reports the exact blocker

`review-self` does not grant commit, push, PR, merge, deploy, or release authority
that was not already present in the user's request.

### /review-pr Workflow

1. Fetches unresolved PR review threads
2. For each comment:
   - **Valid issue** → Fix code
   - **Invalid/wrong** → Reply with explanation (don't resolve)
3. **Run lint, typecheck, tests** (BEFORE commit)
4. If all pass → Commit and push
5. Resolve fixed threads

## For More Details

All comprehensive rules are documented in [`knowledge/internal/`](knowledge/internal/):

1. **01-naming-conventions.md** - Function naming, prefixes, file naming, URL anchors
2. **02-architecture.md** - Monorepo structure, module patterns, async patterns
3. **03-coding-style.md** - TypeScript/Swift/Kotlin style rules, error handling
4. **04-platform-packages.md** - Apple/Google/GQL/Docs package workflows
5. **05-docs-patterns.md** - React modal patterns, component organization
6. **06-git-deployment.md** - Commit format, deployment workflows
7. **07-docs-consistency.md** - Docs/API/type consistency audits
