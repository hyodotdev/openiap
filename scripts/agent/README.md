# OpenIAP Hybrid Mode: Shared Brain, Dual Body

A sophisticated architecture enabling **Claude Code** and a **Local RAG Agent** to share the same knowledge base, allowing side-by-side comparison testing.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          SHARED BRAIN: /knowledge/                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   /internal/              /external/              /_claude-context/             │
│   ┌──────────────┐       ┌──────────────┐       ┌──────────────┐               │
│   │ 01-naming.md │       │ storekit2.md │       │ context.md   │               │
│   │ 02-arch.md   │       │ billing.md   │       │ (compiled)   │               │
│   │ 03-style.md  │       │              │       │              │               │
│   └──────────────┘       └──────────────┘       └──────────────┘               │
│          │                      │                      │                        │
└──────────┼──────────────────────┼──────────────────────┼────────────────────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│        BODY 1: LOCAL RAG AGENT      │    │       BODY 2: CLAUDE CODE           │
│         (The Challenger)            │    │           (Main)                    │
├─────────────────────────────────────┤    ├─────────────────────────────────────┤
│                                     │    │                                     │
│   ┌─────────────────────────────┐   │    │   claude --context                  │
│   │          LanceDB            │   │    │   knowledge/_claude-context/        │
│   │  ┌─────────────────────┐    │   │    │   context.md                        │
│   │  │ internal_rule       │    │   │    │                                     │
│   │  │ external_api        │    │   │    │                                     │
│   │  │ code_map ◄──────────┼────┼───┼────┼── Code Graph Simulation            │
│   │  └─────────────────────┘    │   │    │                                     │
│   └─────────────────────────────┘   │    │                                     │
│              │                      │    │                                     │
│              ▼                      │    │                                     │
│   ┌─────────────────────────────┐   │    │                                     │
│   │    benchmark-agent.ts       │   │    │                                     │
│   │    • RAG Search             │   │    │                                     │
│   │    • Read existing code     │   │    │                                     │
│   │    • Generate code          │   │    │                                     │
│   └─────────────────────────────┘   │    │                                     │
│              │                      │    │              │                      │
│              ▼                      │    │              ▼                      │
│      _generated/                    │    │       Direct Edit                   │
│      └── {timestamp}/               │    │                                     │
│          ├── prompt.txt             │    │                                     │
│          ├── context.md             │    │                                     │
│          ├── files/                 │    │                                     │
│          └── diff.patch             │    │                                     │
└─────────────────────────────────────┘    └─────────────────────────────────────┘
                    │                                       │
                    └───────────── COMPARE ─────────────────┘
```

## Quick Start

### 1. Prerequisites

**Install Ollama and download models:**

```bash
# Install Ollama (macOS)
brew install ollama

# Or download directly: https://ollama.ai/download
```

**Required Models:**

| Model | Purpose | Size | Command |
|-------|---------|------|---------|
| `nomic-embed-text` | Vector embeddings | ~274MB | `ollama pull nomic-embed-text` |
| `qwen2.5-coder:14b` | Code generation (LLM) | ~9GB | `ollama pull qwen2.5-coder:14b` |

```bash
# Download models
ollama pull nomic-embed-text      # Embeddings (required)
ollama pull qwen2.5-coder:14b     # Code generation (for agent)

# Start Ollama server
ollama serve

# Verify installation
ollama list
```

**Environment Variables (optional):**

```bash
# Set in .env file or environment
OLLAMA_URL=http://localhost:11434      # default
EMBEDDING_MODEL=nomic-embed-text       # default
LLM_MODEL=qwen2.5-coder:14b            # default (for agent)
```

> **Note:** `compile:claude` can run without Ollama (generates text files only)

### 2. Setup

```bash
cd scripts/agent
bun install
cp .env.example .env
```

### 3. Compile Knowledge & Code Map

```bash
# Compile for AI assistants (no Ollama required)
bun run compile:ai
# → generates context.md, llms.txt, llms-full.txt

# Compile for Local RAG (Ollama required)
bun run compile:local
# → generates LanceDB vector index

# Full compile (AI + Local RAG)
bun run compile
```

### 4. Run Hybrid Mode Testing

**Step 1: Run Local Agent (Challenger)**
```bash
bun run benchmark --prompt "Add a function to validate iOS subscription status"
```

**Step 2: Run Claude Code (Main)**
```bash
# Use the same prompt with compiled context
claude --context knowledge/_claude-context/context.md

# Then give the same prompt:
# "Add a function to validate iOS subscription status"
```

**Step 3: Compare**
```bash
# Check local agent output
ls _generated/

# Compare files, check if local agent followed internal rules
```

### 5. Code Analysis with Local Agent

After updating knowledge files, re-index and analyze:

```bash
# Re-index with updated knowledge
bun run compile:local

# Analyze code for rule violations
bun run agent --prompt "Analyze the codebase for any violations of naming conventions"

# Or use interactive mode
bun run agent
```

**Example Prompts:**

| Purpose | Prompt |
|---------|--------|
| Naming conventions | `"Check if all iOS functions in packages/apple have IOS suffix"` |
| Architecture review | `"Find any code in packages/google that violates architecture rules"` |
| Code style | `"Review packages/gql for coding style issues"` |
| Full audit | `"List all rule violations in the codebase based on internal knowledge"` |
| Specific file | `"Analyze OpenIapModule.swift for compliance with internal rules"` |

**Workflow:**

```
1. Update knowledge/internal/*.md
          ↓
2. bun run compile:local (re-index)
          ↓
3. bun run agent --prompt "..."
          ↓
4. Review analysis results
```

## Folder Structure

```
openiap/
├── knowledge/                    # 🧠 SHARED BRAIN (SSOT)
│   ├── README.md                # Documentation
│   ├── internal/                # 🚨 MANDATORY RULES
│   │   ├── 01-naming.md        # Naming conventions
│   │   ├── 02-architecture.md  # Architecture principles
│   │   └── 03-coding-style.md  # Coding style
│   ├── external/                # 📚 API REFERENCE
│   │   └── storekit2-api.md    # External API docs
│   └── _claude-context/         # 🔗 COMPILED FOR CLAUDE
│       └── context.md          # Auto-generated context
├── _generated/                   # 📁 BENCHMARK OUTPUT (gitignored)
│   └── {timestamp}/
│       ├── prompt.txt
│       ├── context.md
│       ├── files/
│       └── diff.patch
└── scripts/agent/
    ├── indexer.ts               # Knowledge & Code Map indexer
    ├── benchmark-agent.ts       # The Challenger agent
    ├── agent-coder.ts           # Original coding agent
    └── ingest-knowledge.ts      # Legacy ingest script
```

## Scripts

| Script | Description | Ollama Required |
|--------|-------------|-----------------|
| `bun run compile` | Compile all (AI context + Local RAG) | Yes |
| `bun run compile:ai` | Generate context.md, llms.txt, llms-full.txt | No |
| `bun run compile:local` | Index knowledge + code map (LanceDB) | Yes |
| `bun run compile:local:knowledge` | Index only knowledge files | Yes |
| `bun run compile:local:code` | Build only code map | Yes |
| `bun run benchmark` | Run benchmark agent (challenger) | Yes |
| `bun run agent` | Run original coding agent | Yes |
| `bun run test` | Run unit tests | No |
| `bun run typecheck` | TypeScript type check | No |

## How It Works

### 1. Shared Knowledge Base

Both Claude Code and the local agent reference the same `/knowledge` folder:

```
/knowledge/internal/   →  HIGHEST PRIORITY rules
/knowledge/external/   →  Reference material (adapt to internal)
```

### 2. Code Map (Simulating Claude Code's Code Graph)

The `indexer.ts` scans your source code and extracts:
- File locations
- Function signatures
- Class/interface definitions
- Export relationships

This allows the local agent to find relevant code files just like Claude Code does.

### 3. Benchmark Testing Flow

```
┌─────────────────┐
│  Same Prompt    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│ Local │ │Claude │
│ Agent │ │ Code  │
└───┬───┘ └───┬───┘
    │         │
    ▼         ▼
┌───────┐ ┌───────┐
│_gener-│ │Direct │
│ ated/ │ │ Edit  │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│    COMPARE      │
│ • Style match?  │
│ • Rules follow? │
│ • Quality?      │
└─────────────────┘
```

## Priority System

The local agent follows this strict priority:

| Priority | Type | Source | Treatment |
|----------|------|--------|-----------|
| 1 | `internal_rule` | `/knowledge/internal/` | MANDATORY - Must follow |
| 2 | `code_map` | Project source scan | Reference for locations |
| 3 | `code_snippets` | Actual file contents | Style guide |
| 4 | `external_api` | `/knowledge/external/` | Adapt to internal rules |

## Example Benchmark Output

```
_generated/2024-01-15T10-30-00-000Z/
├── prompt.txt                    # "Add iOS subscription validation"
├── context.md                    # Retrieved context summary
│   • Internal Rules: 8 chunks
│   • Code Map: 5 files
│   • External Docs: 3 chunks
├── files/
│   └── packages/
│       └── apple/
│           └── Sources/
│               └── SubscriptionValidatorIOS.swift
└── diff.patch                    # Diff against existing files
```

## Configuration

### Environment Variables (.env)

```bash
# Ollama
OLLAMA_URL=http://localhost:11434
EMBEDDING_MODEL=nomic-embed-text
LLM_MODEL=qwen2.5-coder:14b
```

### Source Patterns (indexer.ts)

The code map scans these patterns by default:
```typescript
sourcePatterns: [
  "packages/apple/Sources/**/*.swift",
  "packages/google/openiap/src/main/**/*.kt",
  "packages/gql/src/**/*.ts",
  "packages/docs/src/**/*.{ts,tsx}",
]
```

## Evaluation Criteria

When comparing Local Agent vs Claude Code:

### Must Pass (Internal Rules)
- [ ] iOS functions end with `IOS` suffix
- [ ] Android functions in packages/google have NO `Android` suffix
- [ ] Cross-platform functions have NO suffix
- [ ] Explicit return types
- [ ] Follows architectural patterns

### Quality Metrics
- [ ] Code matches existing style
- [ ] Correct file location
- [ ] Proper imports
- [ ] Error handling matches project patterns

## Troubleshooting

### Ollama Connection Error

```bash
# Check if Ollama server is running
curl http://localhost:11434/api/tags

# If not running, start it
ollama serve
```

### "Model not found" Error

```bash
# Install required model
ollama pull nomic-embed-text

# Verify installed models
ollama list
```

### "Knowledge table not found"

```bash
bun run compile:local
```

### "No internal rules found"

Add documents to `/knowledge/internal/` and re-run:

```bash
bun run compile:local:knowledge
```

### "Code map is empty"

Verify `CONFIG.sourcePatterns` in `indexer.ts` matches your project structure.

### "input length exceeds context length" (Ollama 400 Error)

Large files exceed chunk size limit. Adjust `MAX_CHUNK_SIZE` in `indexer.ts`:

```typescript
const MAX_CHUNK_SIZE = 1500;  // default value
```

### AI context not updating

```bash
bun run compile:ai
```

### llms.txt is outdated

```bash
bun run compile:ai
# → regenerates packages/docs/public/llms.txt
```
