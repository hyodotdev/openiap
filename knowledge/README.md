# OpenIAP Shared Knowledge Base

This is the **Single Source of Truth (SSOT)** for all AI agents working on this project.

## Architecture: One Shared Brain

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SHARED KNOWLEDGE BASE                               │
│                           /knowledge/                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  /internal/              /external/              /_agent-context/           │
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
    │        LOCAL RAG AGENT          │    │   AI ASSISTANTS     │
    │  ┌─────────────────────────┐    │    │                     │
    │  │       LanceDB           │    │    │  AGENTS.md (SSOT)   │
    │  │  • internal_rule        │    │    │  CLAUDE.md symlink  │
    │  │  • external_api         │    │    │  GEMINI.md symlink  │
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
│   ├── 06-git-deployment.md        # Git conventions, deployment
│   ├── 07-docs-consistency.md      # Documentation SSOT audits
│   └── sandbox-subscription-billing-issue.md
├── external/                        # REFERENCE - External APIs
│   ├── amazon-iap-api.md           # Amazon Appstore SDK reference
│   ├── google-billing-api.md       # Google Play Billing reference
│   ├── horizon-api.md              # Meta Horizon billing reference
│   ├── storekit2-api.md            # Apple StoreKit 2 reference
│   └── webhook-mapping.md          # Cross-store webhook mapping
├── archive/                         # Historical references; not indexed
│   ├── expo-iap-api.md             # Archived legacy expo-iap API
│   └── react-native-iap-api.md     # Archived legacy react-native-iap API
├── research/                        # Research registry; see research/README.md
├── _agent-context/                  # COMPILED - Shared agent context
│   └── context.md                   # Auto-generated combined context
└── _claude-context -> _agent-context # Backward-compatible alias
```

## Usage

### Compile Both (Recommended)

```bash
cd scripts/agent

# Compile for AI assistants + Local RAG
bun run compile
```

### For AI Assistants

```bash
cd scripts/agent

# Compile the shared context.md
bun run compile:ai

# Repository-aware assistants discover the root instruction files:
# AGENTS.md (Codex and Grok), CLAUDE.md, and GEMINI.md.
# CLAUDE.md and GEMINI.md are symlinks to the AGENTS.md SSOT.
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

| Priority    | Type            | Source       | Purpose                                 |
| ----------- | --------------- | ------------ | --------------------------------------- |
| 1 (Highest) | `internal_rule` | `/internal/` | MUST follow exactly                     |
| 2           | `code_map`      | Project scan | Code structure reference                |
| 3           | `external_api`  | `/external/` | API reference (adapt to internal rules) |

## Workflow: Hybrid Mode Testing

1. **Define Task**: Write the feature request
2. **Run Both**:
   - Any repository-aware assistant from the repository root. Codex and Grok
     discover `AGENTS.md`; Claude Code and Gemini follow the compatibility
     symlinks to the same SSOT.
   - Local Agent: `bun run benchmark --prompt "..."`
3. **Compare**: Check `_generated/` against the selected assistant's output
4. **Evaluate**: Does local agent follow all `internal_rule`?
5. **Iterate**: Improve knowledge files if needed

## Regenerating Context

After modifying any files in `internal/` or `external/`:

```bash
cd scripts/agent

# Regenerate for both targets
bun run compile

# Or individually:
bun run compile:ai      # Shared agent context.md
bun run compile:local   # Local RAG LanceDB index
```
