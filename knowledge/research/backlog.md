# Research-Driven Engineering Backlog

Candidate work items derived from [`bibliography.md`](bibliography.md). Each
item names its evidence, owning surface, and a concrete first step. Items are
proposals: promote one into an issue or PR only on maintainer instruction.

Status values: `proposed` → `in progress` → `shipped (link)` or
`rejected (reason)`.

## R1 — Schema semver-diff release guard

- Evidence: raemaekers2017semver, ochoa2022breakingbad, brito2018why,
  li2023gosemver — version labels are unreliable claims; ~1/3 of releases and
  20.1% of non-major upgrades break clients.
- Owner: `specs/openiap/client` + `scripts/`.
- What: diff the GraphQL schema between the release base and head, classify
  each change (breaking / additive / neutral), and fail the release lane when
  the classification exceeds the declared bump type.
- First step: prototype a schema-AST diff over two git revisions of
  `specs/openiap/client/src/*.graphql` and print the classification table.
- Status: shipped — `specs/openiap/client/scripts/audit-schema-semver.mjs`
  (`bun run audit:schema-semver`; PR-gated in `.github/workflows/ci.yml`
  test-gql).

## R2 — Security behavior class in the conformance suite

- Evidence: mulliner2014virtualswindle, yang2017showme — client-only
  validation is a measured failure mode; SDK design gaps become app
  vulnerabilities.
- Owner: `packages/conformance`.
- What: behaviors asserting the trust boundary — e.g. an adapter that grants
  entitlements from unverified local state is non-conformant; verification
  errors must not be treated as invalid purchases.
- First step: draft behavior ids and required evidence in
  `src/spec/behaviors.mjs`, gated by the capability matrix.
- Status: shipped — `verification.forged-token-is-invalid` and
  `verification.infrastructure-error-is-not-a-verdict` in
  `packages/conformance/src/spec/behaviors.mjs`, reference checks in the
  adapter plus real-implementation checks in the react-native-iap and
  expo-iap conformance suites (coverage gate: 37/37), suite 3.0.0 (ungated
  MUST additions are a major bump). Behaviors
  stay ungated like the existing verification behavior because the matrix has
  no verifyPurchase capability yet.

## R3 — Metamorphic relations for store E2E

- Evidence: chen2018metamorphic — oracle-free services are verified through
  relations between executions, not expected outputs.
- Owner: `packages/conformance` + the device E2E workflows.
- What: phrase store-facing checks as named MRs: repeated `fetchProducts`
  consistency, purchase→restore entitlement equivalence, local vs IAPKit
  verification agreement.
- First step: write the MR list into the conformance spec docs and map each
  existing E2E assertion onto one.
- Status: shipped — `packages/conformance/src/spec/metamorphic-relations.mjs`
  (7 relations mapped onto suite behaviors; `unverifiedRelations()` lists the
  two only a live store can exercise).

## R4 — Cross-SDK differential runner and fake-store mutation engine

- Evidence: brubaker2014frankencerts, kallus2024httpgarden, seriot2016json —
  disagreement between implementations of one spec is a bug oracle.
- Owner: `packages/conformance`.
- What: run the same (mutated) fake-store scenario through every SDK adapter
  and report divergences instead of per-adapter pass/fail only.
- First step: teach the runner to execute two adapters side by side and diff
  their normalized behavior evidence.
- Status: partially shipped — `packages/conformance/src/runner/differential.mjs`
  runs N adapters and reports divergences as the bug oracle; a seeded-mutant
  test proves the oracle catches a forged-token acceptance bug. The fake-store
  mutation engine and real cross-SDK runs still depend on more adapters
  existing (see the adapter table in `packages/conformance/README.md`).

## R5 — Issue-mining pipeline into troubleshooting docs

- Evidence: robillard2009apis, amann2016mubench — documentation is the top
  API-learning obstacle; misuse catalogs are buildable from real reports.
- Owner: `scripts/` + `packages/docs`.
- What: mine and classify the issue backlog across the six SDK repositories
  into a failure-mode taxonomy; feed high-frequency classes back into
  troubleshooting docs and conformance behaviors.
- First step: export issue titles/labels/bodies for the six repos into a
  local dataset and hand-classify a 100-issue sample to seed the taxonomy.
- Status: shipped (pipeline) — `scripts/mine-iap-issues.mjs`
  (`bun run research:mine-issues`) exports all 2,265 issues across the six
  archives into `knowledge/research/_datasets/` (gitignored) with
  keyword-seeded candidate categories. Hand classification is the remaining
  manual pass.

## R6 — IAP misuse catalog and lint rules

- Evidence: amann2016mubench — misuse is rare but almost always severe.
- Owner: to be decided (`scripts/` or a conformance sub-tool).
- What: catalog concrete OpenIAP misuse patterns (missing
  `finishTransaction`, unhandled pending purchases, missing restore path,
  entitlements from unverified state) and detect them statically in consumer
  code.
- First step: write the catalog as markdown with one minimal bad/good example
  per pattern; defer tooling until the catalog stabilizes.
- Status: shipped (catalog) — [`misuse-catalog.md`](misuse-catalog.md) with 10
  patterns, each naming the conformance behavior that detects it. Lint tooling
  stays deferred until the catalog stabilizes, per this item's design.

## R7 — MCP server threat-model review

- Evidence: hasan2025mcpfirstglance, hou2025mcplandscape — measured
  vulnerability patterns across 1,899 MCP servers; lifecycle threat model.
- Owner: `packages/mcp-server` + `packages/kit`.
- What: map the papers' threat categories onto the hosted IAPKit MCP surface
  (tool scoping, auth, prompt-injection resistance, key handling) and record
  the resulting checklist next to the server code.
- First step: one-page gap review of `packages/mcp-server` against the
  lifecycle threat model in hou2025mcplandscape.
- Status: shipped — `packages/mcp-server/THREAT-MODEL.md` (linked from the
  package README). One accepted gap tracked: untrusted-content delimiting for
  store-derived strings in tool results.
