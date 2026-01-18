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
├── knowledge/         # Shared knowledge base (SSOT)
│   ├── internal/      # Project philosophy (HIGHEST PRIORITY)
│   ├── external/      # External API reference
│   └── _claude-context/  # Compiled context for Claude Code
├── scripts/           # Monorepo-wide automation
└── .github/workflows/ # CI/CD workflows
```

## Required Pre-Work

**CRITICAL**: Before writing or editing anything in a package:

1. **Read the relevant knowledge files** from `knowledge/internal/`
2. **Check the package-specific CONVENTION.md**:
   - [`packages/gql/CONVENTION.md`](packages/gql/CONVENTION.md)
   - [`packages/google/CONVENTION.md`](packages/google/CONVENTION.md)
   - [`packages/apple/CONVENTION.md`](packages/apple/CONVENTION.md)

## Key Rules Summary

### Platform Function Naming

- **iOS functions**: Must end with `IOS` suffix (e.g., `syncIOS`, `getStorefrontIOS`)
- **Android functions in packages/google**: NO `Android` suffix (it's Android-only)
- **Cross-platform functions**: NO suffix

### Auto-Generated Files (DO NOT EDIT)

- `packages/apple/Sources/Models/Types.swift`
- `packages/google/openiap/src/main/Types.kt`

Regenerate with: `./scripts/generate-types.sh`

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
| `/sync-*` | Sync changes to platform SDKs | `/sync-expo-iap`, `/sync-flutter-iap`, etc. |

### /review-pr Workflow

1. Fetches unresolved PR review threads
2. For each comment:
   - **Valid issue** → Fix code, commit, resolve thread
   - **Invalid/wrong** → Reply with explanation (don't resolve)
3. Runs tests to verify fixes
4. Pushes changes and resolves fixed threads

## For More Details

All comprehensive rules are documented in [`knowledge/internal/`](knowledge/internal/):

1. **01-naming-conventions.md** - Function naming, prefixes, file naming, URL anchors
2. **02-architecture.md** - Monorepo structure, module patterns, async patterns
3. **03-coding-style.md** - TypeScript/Swift/Kotlin style rules, error handling
4. **04-platform-packages.md** - Apple/Google/GQL/Docs package workflows
5. **05-docs-patterns.md** - React modal patterns, component organization
6. **06-git-deployment.md** - Commit format, deployment workflows
