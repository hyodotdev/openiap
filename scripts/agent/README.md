# Agent Context Compiler

Compiles the OpenIAP knowledge base into one shared reference for AI agents and
the public `llms` files. Run it after editing anything under `knowledge/`.

```bash
cd scripts/agent
bun install
bun run compile:ai
```

It writes:

- `knowledge/_agent-context/context.md` from `knowledge/internal/` and
  `knowledge/external/`
- `packages/docs/public/llms.txt` and `llms-full.txt` from package metadata,
  the Commerce Protocol spec, and `knowledge/external/`

`knowledge/_claude-context` and the root `llms.txt` / `llms-full.txt` are
symlinks to these outputs. `context-files.ts` is the single list of inputs and
outputs; the pre-commit hook and CI use it to fail when the checked-in output is
stale.

`bun run test` runs the unit tests and `bun run typecheck` the type check.

How each agent picks up the instructions is described in
[`knowledge/internal/10-agent-tooling.md`](../../knowledge/internal/10-agent-tooling.md).
