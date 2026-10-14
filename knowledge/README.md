# OpenIAP Shared Knowledge Base

The Single Source of Truth (SSOT) for project rules. `AGENTS.md` routes agents
here; `internal/` wins whenever it disagrees with `external/`.

## Folder Structure

```text
knowledge/
├── README.md                        # This file
├── internal/                        # MANDATORY - Project philosophy
│   ├── 01-naming-conventions.md    # Function/file naming rules
│   ├── 02-architecture.md          # Monorepo structure, module patterns
│   ├── 03-coding-style.md          # TypeScript/Swift/Kotlin style rules
│   ├── 04-platform-packages.md     # Apple/Google/GQL package workflows
│   ├── 05-docs-patterns.md         # Docs writing standard, page patterns, release notes
│   ├── 06-git-deployment.md        # Git conventions, deployment
│   ├── 07-docs-consistency.md      # Documentation SSOT audits
│   ├── 09-community-touchpoints.md # First-purchase notice, assistant note, README section
│   ├── 10-agent-tooling.md         # Per-tool agent setup, compiled context, skills
│   └── sandbox-subscription-billing-issue.md
├── external/                        # REFERENCE - External APIs
│   ├── amazon-iap-api.md           # Amazon Appstore SDK reference
│   ├── google-billing-api.md       # Google Play Billing reference
│   ├── horizon-api.md              # Meta Horizon billing reference
│   ├── storekit2-api.md            # Apple StoreKit 2 reference
│   └── webhook-mapping.md          # Cross-store webhook mapping
├── archive/                         # Historical references; not compiled
│   ├── expo-iap-api.md             # Archived legacy expo-iap API
│   └── react-native-iap-api.md     # Archived legacy react-native-iap API
├── research/                        # Research registry; see research/README.md
├── _agent-context/                  # COMPILED - Shared agent context
│   └── context.md                   # Auto-generated combined context
└── _claude-context -> _agent-context # Backward-compatible alias
```

## Priority

| Priority    | Source      | Purpose                                |
| ----------- | ----------- | -------------------------------------- |
| 1 (Highest) | `internal/` | Must be followed exactly               |
| 2           | `external/` | API reference; adapt to internal rules |

## Regenerating the Compiled Context

After editing `internal/` or `external/`:

```bash
cd scripts/agent && bun run compile:ai
```

This rewrites `_agent-context/context.md` and the docs `llms*.txt` files. See
[`scripts/agent/README.md`](../scripts/agent/README.md).
