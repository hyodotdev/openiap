# OpenIAP Shared Knowledge Base

This is the **Single Source of Truth (SSOT)** for all AI agents working on this project.

## Architecture: "Shared Brain, Dual Body"

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHARED KNOWLEDGE BASE                               │
│                           /knowledge/                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /internal/              /external/              /_claude-context/          │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐             │
│  │ Project     │        │ StoreKit 2  │        │ context.md  │             │
│  │ Philosophy  │        │ Google      │        │ (compiled)  │             │
│  │ Conventions │        │ Billing API │        │             │             │
│  └─────────────┘        └─────────────┘        └─────────────┘             │
│         │                      │                      │                     │
└─────────┼──────────────────────┼──────────────────────┼─────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
    ┌─────────────────────────────────┐    ┌─────────────────────┐
    │        LOCAL RAG AGENT          │    │    CLAUDE CODE      │
    │  ┌─────────────────────────┐    │    │                     │
    │  │       LanceDB           │    │    │  claude --context   │
    │  │  • internal_rule        │    │    │  context.md         │
    │  │  • external_api         │    │    │                     │
    │  │  • code_map             │    │    │                     │
    │  └─────────────────────────┘    │    │                     │
    │              │                   │    │                     │
    │              ▼                   │    │                     │
    │     benchmark-agent.ts          │    │                     │
    │              │                   │    │                     │
    │              ▼                   │    │                     │
    │      _generated/                │    │     (direct edit)   │
    └─────────────────────────────────┘    └─────────────────────┘
                   │                                  │
                   └──────────── COMPARE ────────────┘
```

## Folder Structure

```
knowledge/
├── README.md                        # This file
├── internal/                        # MANDATORY - Project philosophy
│   ├── 01-naming-conventions.md    # Function/file naming rules
│   ├── 02-architecture.md          # Monorepo structure, module patterns
│   ├── 03-coding-style.md          # TypeScript/Swift/Kotlin style rules
│   ├── 04-platform-packages.md     # Apple/Google/GQL package workflows
│   ├── 05-docs-patterns.md         # React modal patterns, components
│   └── 06-git-deployment.md        # Git conventions, deployment
├── external/                        # REFERENCE - External APIs
│   ├── storekit2-api.md            # Apple StoreKit 2 reference
│   ├── google-billing-api.md       # Google Play Billing reference
│   ├── expo-iap-api.md             # expo-iap API reference
│   └── react-native-iap-api.md     # react-native-iap API reference
└── _claude-context/                 # COMPILED - For Claude Code CLI
    └── context.md                   # Auto-generated combined context
```

## Usage

### Compile Both (Recommended)

```bash
cd scripts/agent

# Compile for both Claude Code + Local RAG
bun run compile
```

### For Claude Code Only

```bash
cd scripts/agent

# Compile context.md for Claude Code
bun run compile:claude

# Use with Claude Code
claude --context knowledge/_claude-context/context.md

# Or in an existing session
/context add knowledge/_claude-context/context.md
```

### For Local RAG Agent (Challenger)

```bash
cd scripts/agent

# Index knowledge + Code Map to LanceDB
bun run compile:local

# Run benchmark agent
bun run benchmark --prompt "Add iOS subscription validation"

# Output goes to: _generated/
```

## Knowledge Priority

| Priority | Type | Source | Purpose |
|----------|------|--------|---------|
| 1 (Highest) | `internal_rule` | `/internal/` | MUST follow exactly |
| 2 | `code_map` | Project scan | Code structure reference |
| 3 | `external_api` | `/external/` | API reference (adapt to internal rules) |

## Workflow: Hybrid Mode Testing

1. **Define Task**: Write the feature request
2. **Run Both**:
   - Claude Code with `--context knowledge/_claude-context/context.md`
   - Local Agent: `bun run benchmark --prompt "..."`
3. **Compare**: Check `_generated/` vs Claude Code's output
4. **Evaluate**: Does local agent follow all `internal_rule`?
5. **Iterate**: Improve knowledge files if needed

## Regenerating Context

After modifying any files in `internal/` or `external/`:

```bash
cd scripts/agent

# Regenerate for both targets
bun run compile

# Or individually:
bun run compile:claude  # Claude Code context.md
bun run compile:local   # Local RAG LanceDB index
```
