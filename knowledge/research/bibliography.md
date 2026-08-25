# Annotated Bibliography

Sources that ground OpenIAP design decisions. The public-facing summary of
this registry is the docs page `/docs/foundation/research`. Follow the conventions in
[`README.md`](README.md); keep entries alphabetical by cite key inside each
area.

## Payment security

### mulliner2014virtualswindle

Collin Mulliner, William Robertson, Engin Kirda. _VirtualSwindle: An Automated
Attack Against In-App Billing on Android._ ACM AsiaCCS 2014.
<https://www.mulliner.org/collin/publications/virtualswindle_asiaccs2014_mulliner.pdf>

- Finding: first fully automated attack on Android in-app billing; 60% of 85
  popular apps were cracked automatically.
- OpenIAP relevance: client-only purchase validation is a measured failure
  mode, not a theoretical one. Grounds the server-side verification
  requirement.
- Applied: docs `features/validation` security callout;
  `verification.forged-token-is-invalid` in
  `packages/conformance/src/spec/behaviors.mjs` and
  `knowledge/research/misuse-catalog.md` (backlog R2, R6).

### yang2017showme

Wenbo Yang, Yuanyuan Zhang, Juanru Li, Hui Liu, Qing Wang, Yueheng Zhang, Dawu
Gu. _Show Me the Money! Finding Flawed Implementations of Third-party In-app
Payment in Android Apps._ NDSS 2017.
<https://www.ndss-symposium.org/wp-content/uploads/2017/09/ndss2017_05A-2_Yang_paper.pdf>

- Finding: payment vulnerabilities trace back to the payment SDKs themselves —
  flawed SDK design, ambiguous documentation, and vulnerable sample code led
  merchants into security mistakes; six exploit classes derived.
- OpenIAP relevance: the core thesis that SDK and documentation quality is the
  security bottleneck is exactly OpenIAP's reason to exist (one audited spec,
  consistent SDKs, conformance).
- Applied: docs `features/validation` security callout; conformance verification behaviors and `misuse-catalog.md` (backlog R2, R6).

## Differential and conformance testing

### brubaker2014frankencerts

Chad Brubaker, Suman Jana, Baishakhi Ray, Sarfraz Khurshid, Vitaly Shmatikov.
_Using Frankencerts for Automated Adversarial Testing of Certificate
Validation in SSL/TLS Implementations._ IEEE S&P 2014.
<https://www.cs.columbia.edu/~suman/docs/frankencert.pdf>

- Finding: running many implementations of one spec on the same mutated inputs
  turns any disagreement into a bug oracle; 8.1M inputs surfaced 208
  implementation discrepancies.
- OpenIAP relevance: six SDKs over one schema are a natural differential
  corpus. The conformance runner can grow a cross-SDK differential mode.
- Applied: `packages/conformance/src/runner/differential.mjs` (backlog R4);
  `packages/conformance/README.md` prior-art section.

### kallus2024httpgarden

Ben Kallus, Prashant Anantharaman, Michael Locasto, Sean W. Smith. _The HTTP
Garden: Discovering Parsing Vulnerabilities in HTTP/1.1 Implementations by
Differential Fuzzing of Request Streams._ arXiv:2405.17737, 2024.
<https://arxiv.org/abs/2405.17737>

- Finding: differential fuzzing across HTTP servers found 100+ parsing bugs;
  modern reference design for a differential harness.
- OpenIAP relevance: harness-design reference for a fake-store mutation engine
  feeding all SDK adapters.
- Applied: `packages/conformance/src/runner/differential.mjs` (backlog R4;
  mutation engine still open).

### seriot2016json

Nicolas Seriot. _Parsing JSON is a Minefield._ Practitioner study, 2016.
<https://seriot.ch/security/parsing_json.html>

- Finding: of 34 JSON parsers, no two behave identically; loose spec corners
  become implementation divergence.
- OpenIAP relevance: why behavior specs must pin down what the schema alone
  leaves open — the exact gap `packages/conformance` exists to close.
- Applied: `packages/conformance/README.md` prior-art section.

## API evolution and versioning

### brito2018why

Aline Brito, Laerte Xavier, Andre Hora, Marco Tulio Valente. _Why and How Java
Developers Break APIs._ SANER 2018.
<https://arxiv.org/abs/1801.05198>

- Finding: breaking changes are mostly deliberate — motivated by new features,
  API simplification, and maintainability — not accidents.
- OpenIAP relevance: intentional breaks still ship unlabeled; detection must be
  mechanical, not trust-based. Supports a schema-diff release guard.
- Applied: `packages/gql/scripts/audit-schema-semver.mjs` (backlog R1).

### li2023gosemver

Wenke Li, Feng Wu, Cai Fu, Fan Zhou. _A Large-Scale Empirical Study on
Semantic Versioning in Golang Ecosystem._ ASE 2023.
<https://arxiv.org/abs/2309.02894>

- Finding: semver compliance measured across 124K Go libraries and 532K
  clients; violations persist even in an ecosystem with tooling support.
- OpenIAP relevance: cross-ecosystem baseline showing tooling alone is
  insufficient without release-gate enforcement.
- Applied: `packages/gql/scripts/audit-schema-semver.mjs` (backlog R1).

### ochoa2022breakingbad

Lina Ochoa, Thomas Degueule, Jean-Rémy Falleri, Jurgen Vinju. _Breaking Bad?
Semantic Versioning and Impact of Breaking Changes in Maven Central._
Empirical Software Engineering, 2022.
<https://dl.acm.org/doi/10.1007/s10664-021-10052-y>

- Finding: 20.1% of non-major upgrades contain breaking changes; 7.9% of
  clients are actually impacted.
- OpenIAP relevance: quantifies the risk our floor policy in
  `openiap-versions.json` and release-state audits exist to prevent.
- Applied: `packages/gql/scripts/audit-schema-semver.mjs` (backlog R1).

### raemaekers2017semver

Steven Raemaekers, Arie van Deursen, Joost Visser. _Semantic Versioning and
Impact of Breaking Changes in the Maven Repository._ Journal of Systems and
Software, 2017.
<https://dl.acm.org/doi/10.1016/j.jss.2016.04.008>

- Finding: about one third of releases across 22K Maven libraries introduce at
  least one breaking change; semver labels are unreliable.
- OpenIAP relevance: original evidence base for treating version labels as
  claims to verify, not facts.
- Applied: `packages/gql/scripts/audit-schema-semver.mjs` (backlog R1).

## API learnability and misuse

### amann2016mubench

Sven Amann, Sarah Nadi, Hoan A. Nguyen, Tien N. Nguyen, Mira Mezini. _MUBench:
A Benchmark for API-Misuse Detectors._ MSR 2016.
<https://dl.acm.org/doi/10.1145/2901739.2903506>

- Finding: API misuse causes ~9.1% of real-world bugs but almost always
  produces crashes, data loss, or security issues; misuses can be catalogued
  as a benchmark.
- OpenIAP relevance: method template for an IAP misuse catalog (unfinished
  transactions, unhandled pending purchases, missing restore) feeding lint
  rules and conformance behaviors.
- Applied: `knowledge/research/misuse-catalog.md` and
  `scripts/mine-iap-issues.mjs` (backlog R5, R6).

### amareen2024graphqlso

Saleh Amareen, Obed Soto Dector, Ali Dado, Amiangshu Bosu. _GraphQL Adoption
and Challenges: Community-Driven Insights from StackOverflow Discussions._
arXiv:2408.08363, 2024.
<https://arxiv.org/abs/2408.08363>

- Finding: taxonomy of where developers actually get stuck adopting GraphQL.
- OpenIAP relevance: checklist of confusion points the schema docs should
  answer preemptively.
- Applied: not yet.

### robillard2009apis

Martin P. Robillard. _What Makes APIs Hard to Learn? Answers from Developers._
IEEE Software, 2009. (Field study follow-up: Robillard and DeLine, Empirical
Software Engineering, 2011.)
<https://www.cs.mcgill.ca/~martin/papers/software2009a.pdf>

- Finding: across 440+ professional developers, documentation is the dominant
  API-learning obstacle; key factors are documented intent, code examples,
  scenario matching, penetrability, and format.
- OpenIAP relevance: independent validation of the reader-first documentation
  standard in `knowledge/internal/05-docs-patterns.md`.
- Applied: `scripts/mine-iap-issues.mjs` (backlog R5).

## Ecosystem and supply chain

### zimmermann2019smallworld

Markus Zimmermann, Cristian-Alexandru Staicu, Cam Tenny, Michael Pradel.
_Small World with High Risks: A Study of Security Threats in the npm
Ecosystem._ USENIX Security 2019.
<https://www.usenix.org/conference/usenixsecurity19/presentation/zimmerman>

- Finding: a small number of packages and maintainer accounts can reach most
  of the npm dependency network; unmaintained packages keep shipping known
  vulnerabilities for years.
- OpenIAP relevance: evidence base for the SBOM, provenance, dependency
  snapshot, and Scorecard posture already shipped.
- Applied: docs `security/overview` monitoring section.

## Specification and schema design

### wittern2019graphql

Erik Wittern, Alan Cha, James C. Davis, Guillaume Baudart, Louis Mandel. _An
Empirical Study of GraphQL Schemas._ ICSOC 2019.
<https://link.springer.com/chapter/10.1007/978-3-030-33702-5_1>

- Finding: analysis of 16 commercial plus 8,399 open-source GraphQL schemas;
  naming conventions and structural risk patterns quantified.
- OpenIAP relevance: OpenIAP uses GraphQL as a server-less IDL (type SSOT
  only) — a usage pattern essentially absent from this corpus.
- Applied: not yet.

## Testing without an oracle

### chen2018metamorphic

Tsong Yueh Chen, Fei-Ching Kuo, Huai Liu, Pak-Lok Poon, Dave Towey, T. H. Tse,
Zhi Quan Zhou. _Metamorphic Testing: A Review of Challenges and
Opportunities._ ACM Computing Surveys, 2018.
<https://dl.acm.org/doi/10.1145/3143561>

- Finding: when the expected output is unknowable, verify relations between
  executions (metamorphic relations) instead of outputs.
- OpenIAP relevance: StoreKit sandbox and Play Billing are oracle-free
  environments; store E2E checks should be phrased as metamorphic relations.
- Applied: `packages/conformance/src/spec/metamorphic-relations.mjs`
  (backlog R3); `packages/conformance/README.md` prior-art section.

## AI agents and MCP

### chen2026mcpenterprise

Kehui Chen, Yicheng Sun, Jacky Keung, Zhenyu Mao, Xiaoxue Ma. _Understanding
How Enterprises Adopt the Model Context Protocol for LLM-Driven Software
Engineering._ QRS 2026.
<https://arxiv.org/abs/2606.09182>

- Finding: how enterprises actually wire MCP into engineering workflows.
- OpenIAP relevance: market context for positioning the hosted IAPKit MCP
  server as domain-specific commerce tooling.
- Applied: not yet.

### hasan2025mcpfirstglance

Mohammed Mehedi Hasan, Hao Li, Emad Fallahzadeh, Gopi Krishnan Rajbahadur,
Bram Adams, Ahmed E. Hassan. _Model Context Protocol (MCP) at First Glance:
Studying the Security and Maintainability of MCP Servers._ arXiv:2506.13538, 2025.
<https://arxiv.org/abs/2506.13538>

- Finding: first large-scale study of 1,899 open-source MCP servers; general
  and protocol-specific vulnerability patterns.
- OpenIAP relevance: audit checklist source for `packages/mcp-server`.
- Applied: `packages/mcp-server/THREAT-MODEL.md` (backlog R7).

### hou2025mcplandscape

Xinyi Hou, Yanjie Zhao, Shenao Wang, Haoyu Wang. _Model Context Protocol
(MCP): Landscape, Security Threats, and Future Research Directions._
arXiv:2503.23278, 2025 (accepted at ACM TOSEM).
<https://arxiv.org/abs/2503.23278>

- Finding: MCP server lifecycle decomposed into four phases and sixteen
  activities with a threat model per phase.
- OpenIAP relevance: structure for a recurring MCP threat-model review.
- Applied: `packages/mcp-server/THREAT-MODEL.md` (backlog R7).
