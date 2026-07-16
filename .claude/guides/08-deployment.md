# Deployment Guide

This file is a route map, not a second deployment specification.

## Canonical sources

- Stable and prerelease package order, workflow inputs, and registry checks:
  `.claude/commands/release.md`
- Branch guards, version ownership, tag formats, and docs deployment contract:
  `knowledge/internal/06-git-deployment.md`
- Package and generated-type rules: root `AGENTS.md` and
  `knowledge/internal/04-platform-packages.md`

## Deployment surfaces

| Surface                                | Canonical entrypoint                                                |
| -------------------------------------- | ------------------------------------------------------------------- |
| Apple, Google, and framework libraries | Sequential stable workflows listed in `.claude/commands/release.md` |
| Production docs and spec release       | Root `npm run deploy`, then `release.yml` with `version=current`    |
| IAPKit                                 | `.github/workflows/deploy-kit.yml` on relevant pushes to `main`     |

For the rare IAPKit manual fallback, follow the Convex-first sequence in
`packages/kit/README.md#deployment-convex--flyio`. IAPKit has its own Convex
schema and is not part of the `packages/gql` generated-type sync chain.
