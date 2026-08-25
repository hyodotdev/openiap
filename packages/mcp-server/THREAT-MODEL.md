# MCP Server Threat Model

Gap review of the hosted IAPKit MCP server against the MCP lifecycle threat
model (hou2025mcplandscape) and the measured vulnerability classes of 1,899
open-source servers (hasan2025mcpfirstglance) — sources in
[`knowledge/research/bibliography.md`](../../knowledge/research/bibliography.md)
(backlog R7). Re-run this review when a tool is added or auth changes.

Last reviewed: 2026-08-25.

## Creation

| Threat                                                                 | Status                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tool description injection (descriptions carrying hidden instructions) | **Covered.** All tool descriptions are static strings authored in `src/mcp.ts` and reviewed like code. Rule: never interpolate remote or user content into a tool name, description, or schema. |
| Overbroad tool scope                                                   | **Covered.** Every tool declares `readOnlyHint`/`destructiveHint` annotations; destructive operations (product remove, sync push, webhook simulation) are marked and require the admin key.     |
| Secret material in source                                              | **Covered.** No keys in the repo; the server only forwards the caller's bearer key to kit.                                                                                                      |

## Deployment

| Threat                                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential theft via weak auth                     | **Covered.** MCP administration accepts only typed secret keys (`openiap-kit_sk_...`, `src/auth.ts`); publishable and legacy keys are rejected with a scope error.                                                                                                                                                                                                                                                                                                                       |
| Session exhaustion / DoS                           | **Covered.** `BoundedSessionStore` caps sessions at 256 with a 15-minute idle TTL and a retry-after on capacity (`src/session-store.ts`).                                                                                                                                                                                                                                                                                                                                                |
| Upstream redirection via caller-supplied `baseUrl` | **Gap (accepted, tracked).** `baseUrl` is a per-tool argument so self-hosted kit deployments work, and `normalizeKitBaseUrl` only restricts the scheme — a prompt-injected tool call could point kit traffic, including the caller's own `Authorization` key, at an arbitrary host. The key at risk is the caller's own, so this is exfiltration of self-supplied credentials, not privilege escalation. Candidate hardening: operator-only override with the per-call argument removed. |
| Supply-chain integrity                             | **Covered elsewhere.** Release SBOM + provenance pipeline (docs `security/overview`).                                                                                                                                                                                                                                                                                                                                                                                                    |

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
2. Restrict `baseUrl` to an operator-configured allowlist instead of a
   per-call argument (Deployment gap above) — needs a product decision on
   how self-hosted kit deployments configure the endpoint.
3. Periodic re-review trigger: wire a checklist line into `/audit-iapkit`.
