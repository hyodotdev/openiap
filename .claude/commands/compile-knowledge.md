---
name: compile-knowledge
description: Compile the OpenIAP knowledge base into the shared reference and public AI files. Use after editing anything under knowledge/, or when the user asks to compile, recompile, or refresh the knowledge base or agent context.
---

# Compile Knowledge Base

Compile the OpenIAP knowledge base into a shared reference and public AI files.

> **Full documentation:** See `scripts/agent/README.md`.

## Output Files

| Output          | Location                    | Purpose                      |
| --------------- | --------------------------- | ---------------------------- |
| `context.md`    | `knowledge/_agent-context/` | Generated shared reference   |
| `llms.txt`      | `packages/docs/public/`     | AI assistant quick reference |
| `llms-full.txt` | `packages/docs/public/`     | AI assistant full reference  |

## When to Run

- When `knowledge/internal/` or `knowledge/external/` files are modified
- When new API documentation is added
- When naming conventions or rules change

## Compile Steps

### 1. Navigate & Run

```bash
cd scripts/agent
bun run compile:ai
```

### 2. Verify Output

```bash
ls -la ../../knowledge/_agent-context/
ls -la ../../packages/docs/public/llms*.txt
```

### 3. Review Generated Changes

```bash
git -C ../.. add knowledge/_agent-context/context.md knowledge/_claude-context
git -C ../.. add packages/docs/public/llms.txt
git -C ../.. add packages/docs/public/llms-full.txt
```

Commit or push generated context only when the user requested publication or it
is part of an already-authorized product/docs PR. Otherwise keep internal AI
context changes local and report them.

## SSOT (Single Source of Truth)

```text
knowledge/
├── internal/     ─┐
└── external/     ─┴─► compile:ai ─┬► context.md (shared reference)
                                   ├► llms.txt (Quick Ref)
                                   └► llms-full.txt (Full Ref)
```
