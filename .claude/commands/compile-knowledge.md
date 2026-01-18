# Compile Knowledge Base

Compile the OpenIAP knowledge base to generate context files for AI assistants.

> **Full documentation:** See `scripts/agent/README.md` for detailed setup and troubleshooting.

## Quick Reference

### Output Files

| Output | Location | Purpose |
|--------|----------|---------|
| `context.md` | `knowledge/_claude-context/` | Claude Code context |
| `llms.txt` | `packages/docs/public/` | AI assistant quick reference |
| `llms-full.txt` | `packages/docs/public/` | AI assistant full reference |

### Commands

```bash
cd scripts/agent

# For AI Assistants (no Ollama required)
bun run compile:ai

# For Local RAG (Ollama required)
bun run compile:local

# Full compile (AI + Local RAG)
bun run compile
```

## When to Run

- When `knowledge/internal/` or `knowledge/external/` files are modified
- When new API documentation is added
- When naming conventions or rules change

## Ollama Setup (for Local RAG)

```bash
# Install
brew install ollama

# Pull embedding model (required)
ollama pull nomic-embed-text

# Pull LLM model (for agent usage)
ollama pull qwen2.5-coder:14b

# Start server
ollama serve
```

| Model | Purpose | Size |
|-------|---------|------|
| `nomic-embed-text` | Vector embeddings | ~274MB |
| `qwen2.5-coder:14b` | Code generation | ~9GB |

## Compile Steps

### 1. Navigate & Run

```bash
cd scripts/agent
bun run compile:ai
```

### 2. Verify Output

```bash
ls -la ../../knowledge/_claude-context/
ls -la ../../packages/docs/public/llms*.txt
```

### 3. Commit Changes

```bash
git add knowledge/_claude-context/context.md
git add packages/docs/public/llms.txt
git add packages/docs/public/llms-full.txt

git commit -m "docs: update compiled knowledge base

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

## SST (Single Source of Truth)

```
knowledge/
├── internal/     ─┐
└── external/     ─┴─► compile:claude ─┬► context.md (Claude Code)
                                       ├► llms.txt (Quick Ref)
                                       └► llms-full.txt (Full Ref)
```
