# OpenIAP Monorepo - Agent Guidelines

This document provides an overview for AI agents working across the OpenIAP monorepo.

**All detailed rules are in the `knowledge/internal/` folder** - this is the Single Source of Truth (SSOT).

## Quick Reference

| Topic | File |
|-------|------|
| Naming Conventions | [`knowledge/internal/01-naming-conventions.md`](knowledge/internal/01-naming-conventions.md) |
| Architecture | [`knowledge/internal/02-architecture.md`](knowledge/internal/02-architecture.md) |
| Coding Style | [`knowledge/internal/03-coding-style.md`](knowledge/internal/03-coding-style.md) |
| Platform Packages | [`knowledge/internal/04-platform-packages.md`](knowledge/internal/04-platform-packages.md) |
| Docs Patterns | [`knowledge/internal/05-docs-patterns.md`](knowledge/internal/05-docs-patterns.md) |
| Git & Deployment | [`knowledge/internal/06-git-deployment.md`](knowledge/internal/06-git-deployment.md) |

## Monorepo Structure

```text
openiap/
├── packages/
│   ├── docs/          # Documentation site (React/Vite/Vercel)
│   ├── gql/           # GraphQL schema & type generation
│   ├── google/        # Android library
│   └── apple/         # iOS/macOS library
├── libraries/         # Framework SDK implementations
│   ├── react-native-iap/  # React Native (npm)
│   ├── expo-iap/          # Expo (npm)
│   ├── flutter_inapp_purchase/  # Flutter (pub.dev)
│   ├── godot-iap/         # Godot 4.x (GitHub Release)
│   └── kmp-iap/           # Kotlin Multiplatform (Maven Central)
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
2. **Check the package-specific CONVENTION.md**:
   - [`packages/gql/CONVENTION.md`](packages/gql/CONVENTION.md)
   - [`packages/google/CONVENTION.md`](packages/google/CONVENTION.md)
   - [`packages/apple/CONVENTION.md`](packages/apple/CONVENTION.md)
3. **For framework libraries, read the library-specific CLAUDE.md**:
   - [`libraries/react-native-iap/CLAUDE.md`](libraries/react-native-iap/CLAUDE.md) — Yarn 3, Nitro Modules, useIAP hook semantics, error handling
   - [`libraries/expo-iap/CLAUDE.md`](libraries/expo-iap/CLAUDE.md) — Bun, Expo Modules, iOS podspec 13.4 workaround, tvOS 16.0 requirement
   - [`libraries/flutter_inapp_purchase/CLAUDE.md`](libraries/flutter_inapp_purchase/CLAUDE.md) — Flutter/Dart, generated types.dart, fetchProducts generic API
   - [`libraries/godot-iap/CLAUDE.md`](libraries/godot-iap/CLAUDE.md) — GDScript conventions, GDExtension (iOS), AAR plugin (Android)
   - [`libraries/kmp-iap/CLAUDE.md`](libraries/kmp-iap/CLAUDE.md) — Kotlin Multiplatform, Flow-based API, CocoaPods iOS integration

## Key Rules Summary

### Platform Function Naming

- **iOS functions**: Must end with `IOS` suffix (e.g., `syncIOS`, `getStorefrontIOS`)
- **Android functions in packages/google**: NO `Android` suffix (it's Android-only)
- **Cross-platform functions**: NO suffix

### Auto-Generated Files (DO NOT EDIT)

- `packages/gql/src/generated/*` - All generated type files (SSOT)
- `packages/apple/Sources/Models/Types.swift` - Synced from GQL
- `packages/google/openiap/src/main/Types.kt` - Synced from GQL
- `libraries/react-native-iap/src/types.ts` - Synced from GQL
- `libraries/expo-iap/src/types.ts` - Synced from GQL
- `libraries/flutter_inapp_purchase/lib/types.dart` - Synced from GQL
- `libraries/godot-iap/addons/godot-iap/types.gd` - Synced from GQL
- `openiap-versions.json` - Managed by CI/CD workflows only

Regenerate and sync types:

```bash
cd packages/gql && bun run generate  # Generate types from GraphQL schema
cd ../.. && ./scripts/sync-versions.sh  # Sync to all packages and libraries
```

### GQL Code Generation System

The type generation uses an **IR-based (Intermediate Representation)** architecture:

```text
GraphQL Schema → Parser → IR → Language Plugins → Generated Code
                              ↓
         codegen/core/     codegen/plugins/
         ├── types.ts      ├── swift.ts
         ├── parser.ts     ├── kotlin.ts
         └── transformer.ts├── dart.ts
                           └── gdscript.ts
```

**Language plugins handle:**
- **Swift**: Codable protocol, ErrorCode custom initializer, platform defaults
- **Kotlin**: sealed interface, fromJson/toJson with nullable patterns
- **Dart**: sealed class, factory constructors, extends/implements
- **GDScript**: _init() pattern, Variant type for unions

### Git Commit Format

- With tag: `feat: add new feature` (lowercase after tag)
- Without tag: `Add new feature` (uppercase first letter)

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

## Available Skills (Slash Commands)

| Skill | Description | Usage |
|-------|-------------|-------|
| `/review-pr` | Review PR comments, fix issues, resolve threads | `/review-pr 65` or `/review-pr <url>` |
| `/audit-code` | Audit code against knowledge rules and latest APIs | `/audit-code` |
| `/compile-knowledge` | Compile knowledge base for Claude context | `/compile-knowledge` |

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
