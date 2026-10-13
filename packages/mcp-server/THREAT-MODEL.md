# MCP Server Threat Model

Gap review of the hosted IAPKit MCP server against the MCP lifecycle threat
model (hou2025mcplandscape) and the measured vulnerability classes of 1,899
open-source servers (hasan2025mcpfirstglance) — sources in
[`knowledge/research/bibliography.md`](../../knowledge/research/bibliography.md)
(backlog R7). Re-run this review when a tool is added or auth changes.

Last reviewed: 2026-10-13.

## Public showcase endpoint

The docs site hosts a separate, stateless MCP endpoint at `openiap.dev/mcp`.
It does not use IAPKit keys, sessions, or customer storage. Its three tools list
submission choices, submit an app to a private queue, and read a receipt's status.
It has no tool for listing private submissions, approving, or rejecting them.

| Threat                                 | Control                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unreviewed publication                 | New records always start pending; only the website's GitHub-authenticated maintainer can approve. Reviews atomically require pending status.                             |
| Contact disclosure                     | Public reads select approved records and remove contact email and consent fields. Receipt lookups return status alone.                                                   |
| Submission injection                   | Static tool descriptions, strict schema, HTTPS links, explicit ownership consent, and no submitted HTML rendering or arbitrary server-side URL fetches.                  |
| Anonymous spam and resource exhaustion | 32 KB bodies, persistent per-client and global quotas, expiring HMAC IP buckets, and no MCP session allocation. Configure Vercel Firewall for additional abuse controls. |
| Forged admin or cross-site review      | Auth.js encrypted sessions, current GitHub account ID allowlist, same-origin review POSTs with a custom header, and no public CORS on admin routes.                      |
| Secret leakage                         | Storage failures return static errors; database and OAuth credentials remain server-only.                                                                                |

Reviewed 2026-10-09. Tests live in `test/showcase.test.ts` and the docs site's
`server/showcase.test.ts`; the latter exercises the SQL approval boundary.

## Creation

| Threat                                                                 | Status                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool description injection (descriptions carrying hidden instructions) | **Covered.** All tool descriptions are static strings authored in `src/mcp.ts` and reviewed like code. Rule: never interpolate remote or user content into a tool name, description, or schema. |
| Overbroad tool scope                                                   | **Covered.** Every tool declares `readOnlyHint`/`destructiveHint` annotations; destructive operations (product remove, sync push, webhook simulation) are marked and require the admin key.     |
| Secret material in source                                              | **Covered.** No keys in the repo; the server only forwards the caller's bearer key to kit.                                                                                                      |

## Deployment

| Threat                                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential theft via weak auth                     | **Covered.** MCP administration accepts only typed secret keys (`openiap-kit_sk_...`, `src/auth.ts`); publishable and legacy keys are rejected with a scope error. The hosted endpoint also confirms the key is an active secret key in Convex before it creates a session (`authenticate` in `src/web.ts`, wired in kit's `server/mcp.ts`).                                                                                                                      |
| Unauthenticated use of the operator's key          | **Covered.** Both HTTP transports require `Authorization: Bearer` on every request and never fall back to `IAPKIT_API_KEY`. Only stdio, where the operator runs the process, uses the environment key.                                                                                                                                                                                                                                                            |
| Local HTTP server reachable from the network       | **Covered.** `iapkit-mcp-http` binds `127.0.0.1` unless `HOST` says otherwise, and rejects a `Host` header outside `IAPKIT_MCP_ALLOWED_HOSTS` (loopback names by default), so a DNS-rebinding page cannot reach it.                                                                                                                                                                                                                                               |
| Requests from kit's network position (SSRF)        | **Covered.** The hosted server calls only kit's own base URL (`IAPKIT_BASE_URL`); the per-call `baseUrl` argument is ignored there, so a tool call cannot reach Fly-internal or metadata hosts. Every kit call refuses redirects, times out after 30 s, and stops reading past 1 MiB (`fetchKit` in `src/kit-client.ts`).                                                                                                                                         |
| Upstream redirection via caller-supplied `baseUrl` | **Accepted on local transports.** stdio and local HTTP keep the argument so self-hosted kits work; it can only send the caller's own key to a host the caller chose, from the caller's own machine.                                                                                                                                                                                                                                                               |
| Session exhaustion / DoS                           | **Covered.** Sessions need a bearer (hosted: a confirmed key). `BoundedSessionStore` caps sessions at 256 (16 per tenant — kit's project id from `authenticate`, in-flight initializes included; a tenant's own oldest goes first) with a 15-minute idle TTL and, when full, evicts the least recently used session instead of refusing; its client gets a 404 and re-initializes (`src/session-store.ts`). Request bodies are capped at 1 MiB while they stream. |
| Supply-chain integrity                             | **Covered elsewhere.** Release SBOM + provenance pipeline (docs `security/overview`).                                                                                                                                                                                                                                                                                                                                                                             |

## Operation

| Threat                                | Status                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt injection through tool RESULTS | **Gap (accepted, tracked).** Store-derived fields (product titles, descriptions) flow into the caller's LLM context unmarked. A hostile product title could carry instructions. Mitigation today: all mutating tools need the admin key the caller already holds, so injected text gains no privilege the caller lacks. Candidate hardening: delimit store-derived strings in tool results as untrusted data. |
| Rate limiting                         | **Delegated.** kit's `/v1` enforces rate limits; the MCP layer forwards `x-ratelimit-*` headers rather than duplicating a limiter (`src/http.ts`).                                                                                                                                                                                                                                                            |
| Error-message leakage                 | **Covered.** `kit-client` normalizes failures into a uniform shape instead of relaying upstream internals.                                                                                                                                                                                                                                                                                                    |
| Loopback trust marker                 | **Reviewed.** `x-iapkit-mcp-loopback` only tags kit-bound requests originating from the co-hosted server; it grants no authority by itself — kit-side handling is part of kit's `/v1` contract review.                                                                                                                                                                                                        |

## Maintenance

| Threat                 | Status                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Stale dependency drift | **Covered.** Dependabot + dependency snapshot validation cover this package like the rest of the monorepo.                  |
| Unreviewed tool growth | **Process rule.** A new tool must add: annotations, a `test/` case, and a row in this document's Creation/Operation tables. |

## Open items

1. Untrusted-content delimiting for store-derived strings in tool results
   (Operation gap above) — design note before implementation.
2. Periodic re-review trigger: wire a checklist line into `/audit-iapkit`.
