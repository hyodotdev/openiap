# OpenIAP Client Specification Guide

The client specification's canonical instructions live in:

- `specs/client/CONVENTION.md` — schema organization, marker/deprecation
  contracts, supported generation commands, and generated-file rules.
- `knowledge/internal/04-platform-packages.md` — platform sync and SDK parity.
- `knowledge/internal/07-docs-consistency.md` — documentation and generated
  API SSOT requirements.

Do not duplicate those rules here. Read all three before changing
`specs/client/`, then use the repository-owned `bun run generate` workflow.
