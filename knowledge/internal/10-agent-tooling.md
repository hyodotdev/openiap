# Agent Tooling

How the shared instructions reach each AI coding tool, and the workflows those
tools expose. Project rules stay in `AGENTS.md` and `knowledge/internal/`; the
files described here only route to them.

## One Instruction Source

`AGENTS.md` is the root instruction SSOT. Codex, Grok, Muse, and Cursor read it
directly; `CLAUDE.md` and `GEMINI.md` are symlinks to it. Every framework
library follows the same pattern with its own `AGENTS.md`.

`.claude/commands/`, `.claude/skills/`, `.codex/skills/`, and `.cursor/rules/`
are thin discovery adapters for hosts whose formats differ. They route back to
the shared instructions and must not copy project policy. Keep the canonical
`.codex/skills/` bodies agent-neutral: Codex, Muse, and the Claude adapters all
read the same text.
`bun run audit:agents` checks that every command and skill is wired for every
agent.

## Compiled Context

`knowledge/_agent-context/context.md` compiles `knowledge/internal/` and
`knowledge/external/` into one reference for audits and on-demand reading. The
same run writes `packages/docs/public/llms.txt` and `llms-full.txt`.
`knowledge/_claude-context` is a compatibility symlink to it.

```bash
cd scripts/agent && bun run compile:ai
```

Run it after editing anything under `knowledge/`. The pre-commit hook and CI
fail when the checked-in output is stale.

## Codex

Codex reads skills from `.codex/skills/<name>/SKILL.md`. It discovers the
repo-local skills directly. Install the globally named ones
(`openiap-workflows` and `generate-doc`) into your Codex home when needed:

```bash
./.codex/scripts/install-skills.sh
```

Then ask normally ("review PR 65", "resolve issue 88") or name a skill such as
`$openiap-workflows`. Keep `$review-self`, `$loop-review`, and `$ship-release`
repo-local: their review, merge, and release policies are specific to this
repository.

## Claude Code

- Slash commands in `.claude/commands/*.md` load as `/review-pr`,
  `/verify-all`, and so on.
- `.claude/skills/<name>/SKILL.md` adapts the canonical
  `.codex/skills/<name>/SKILL.md` body and adds only Claude-specific notes
  (browser tooling, wake-ups, subagents). When a Codex skill changes, check its
  adapter.
- Register the hosted IAPKit MCP endpoint (`https://kit.openiap.dev/mcp`) in
  `~/.claude.json` under `mcpServers`, and export `IAPKIT_API_KEY` before
  launching. The repo has no root `.mcp.json` because Muse fails on its
  `${VAR}` form.

Outside this repo, `.claude-plugin/marketplace.json` publishes
`plugins/openiap` as a marketplace:

```bash
claude plugin marketplace add hyodotdev/openiap
claude plugin install openiap@openiap
```

`plugins/openiap` carries two manifests: `.codex-plugin/plugin.json` (MCP
config in `.codex-plugin/mcp.json`) and `.claude-plugin/plugin.json` (inline
MCP config). Both agents share `skills/`, so keep its wording agent-neutral.
Installed plugins stay on their manifest version, and both manifests carry
`openiap-versions.json`'s `plugin` version (`bun run audit:plugins`). Never bump
them by hand: after a skills change lands, run the `P1. Release: OpenIAP plugin`
workflow, which raises all three.

## Grok

Grok Build reads the `AGENTS.md` hierarchy and the Claude Code command, skill,
and plugin layout. Do not add a `GROK.md`. See the
[xAI skills and plugins documentation](https://docs.x.ai/build/features/skills-plugins-marketplaces).

## Muse

Muse reads the `AGENTS.md` hierarchy and discovers `.codex/skills/*/SKILL.md`
as project skills (`muse skills list --source project`); no import step is
needed. Do not add a `MUSE.md` or `.muse/skills/` mirror. Where a skill names a
Codex-only tool, Muse uses its host equivalent or stops and asks.

To give Muse the IAPKit MCP server, add it to
`${XDG_CONFIG_HOME:-$HOME/.config}/muse/settings.json` under `mcpServers` as
`type: "streamable-http"`, `url: "https://kit.openiap.dev/mcp"`, with your key
in `headers.Authorization`. That file then holds a secret in plaintext:
`chmod 600` it and never commit or paste the key.

## Cursor

`.cursor/rules/openiap-ssot.mdc` is a short always-applied router to
`AGENTS.md`. Keep rules out of it.

## Skills and Commands

| Skill                       | Description                                                     | Usage                                 |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| `$github-labels`            | Apply relevant labels to issues, Discussions and PRs            | `$github-labels`                      |
| `$review-self`              | Review and improve current work until stable                    | `$review-self` or `$review-self <PR>` |
| `$loop-review`              | Start from current main, review, PR, and merge                  | `$loop-review`                        |
| `$ship-release`             | Merge, publish, document, and deploy a release                  | `$ship-release`                       |
| `$rebase-main`              | Pull main and safely rebase the current branch                  | `$rebase-main`                        |
| `$generate-doc`             | Write OpenIAP docs and pre-release release notes                | `$generate-doc`                       |
| `$add-showcase-app`         | Add apps to the "Apps built with OpenIAP" showcase              | `$add-showcase-app`                   |
| `$opencollective-steward`   | Manage OpenCollective profile and updates                       | `$opencollective-steward`             |
| `$iapkit-e2e-petgu`         | IAPKit product-sync E2E with the Petgu app                      | `$iapkit-e2e-petgu`                   |
| `$iapkit-e2e-martie`        | IAPKit local receipt-validation E2E with Martie                 | `$iapkit-e2e-martie`                  |
| `$e2e-matrix-runner`        | Full device matrix: 6 frameworks x iOS/Play/Amazon/Horizon/Vega | `$e2e-matrix-runner`                  |
| `$e2e-matrix-runner-google` | Android half: 6 frameworks x Play/Amazon/Horizon + Vega         | `$e2e-matrix-runner-google`           |
| `$e2e-matrix-runner-apple`  | Apple half: 6 frameworks x iOS + Onside build-only              | `$e2e-matrix-runner-apple`            |
| `/review-pr`                | Review PR comments, fix issues, resolve threads                 | `/review-pr 65` or `/review-pr <url>` |
| `/audit-code`               | Audit code against knowledge rules and latest APIs              | `/audit-code`                         |
| `/audit-security`           | Audit SBOM, provenance, and supply-chain posture                | `/audit-security`                     |
| `/audit-iapkit`             | Reconcile the IAPKit surface with OpenIAP updates               | `/audit-iapkit`                       |
| `/compile-knowledge`        | Compile the shared AI agent context                             | `/compile-knowledge`                  |
| `/resolve-issue`            | Analyze an issue, label it, and fix/comment                     | `/resolve-issue 88`                   |
| `/verify-all`               | Run the full monorepo health check                              | `/verify-all`                         |
| `/e2e-tests`                | Run device-backed OpenIAP regression tests                      | `/e2e-tests PR 162`                   |
| `/e2e-tests-google`         | Run Android-side device regression (Play/Amazon/Horizon/Vega)   | `/e2e-tests-google`                   |
| `/e2e-tests-apple`          | Run Apple-side device regression (iOS)                          | `/e2e-tests-apple`                    |
| `/release`                  | Release stable packages or an on-demand RC train                | `/release all stable`                 |
| `/commit`                   | Branch, commit, push, and optionally create PR                  | `/commit --all --pr`                  |

`$review-self` reviews the whole working tree (staged, unstaged, untracked)
against the request and conventions, fixes in-scope findings, rechecks at the
requested interval (five minutes by default), and stops after two consecutive
clean snapshots or a named blocker. It grants no commit, push, PR, merge,
deploy, or release authority the request did not already give.

`/review-pr` fixes each valid unresolved review thread, replies without
resolving when a comment is wrong, runs lint, typecheck, and tests before
committing, then pushes and resolves the fixed threads.
