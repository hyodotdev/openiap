# Annotated Bibliography

Sources that ground OpenIAP design decisions. The public-facing summary of
this registry is the docs page `/docs/foundation/research`. Follow the conventions in
[`README.md`](README.md); keep entries alphabetical by cite key inside each
area.

## Payment security

### chen2019devils

Yi Chen, Luyi Xing, Yue Qin, Xiaojing Liao, XiaoFeng Wang, Kai Chen, Wei Zou.
_Devils in the Guidance: Predicting Logic Vulnerabilities in Payment
Syndication Services through Automated Documentation Analysis._ USENIX
Security 2019, pp. 747-764.
<https://www.usenix.org/conference/usenixsecurity19/presentation/chen-yi>

- Finding: automated analysis of payment-service documentation predicts logic
  vulnerabilities, including integration requirements that become unenforceable
  because the guidance loses visibility of the parameters a check would need.
- OpenIAP relevance: evidence that stating an obligation in prose guidance is
  not enough; it must be a check a conforming implementation can fail.
- Limit: the studied services are payment syndication providers, not App Store
  or Play subscriptions, and the result is about documentation, not our SDKs.
- Reviewed: publisher record and abstract, 2026-09-06.
- Applied: `specs/commerce-protocol/DESIGN.md` reference 22;
  `knowledge/research/issue-corpus-study.md` motivation.

### mulliner2014virtualswindle

Collin Mulliner, William Robertson, Engin Kirda. _VirtualSwindle: An Automated
Attack Against In-App Billing on Android._ ACM AsiaCCS 2014.
DOI: 10.1145/2590296.2590335.

Paper: <https://seclab.nu/static/publications/asiaccs2014virtualswindle.pdf>

Author slides:
<https://www.mulliner.org/collin/publications/virtualswindle_asiaccs2014_mulliner.pdf>

- Finding: first fully automated attack on Android in-app billing; 60% of 85
  popular apps were cracked automatically.
- OpenIAP relevance: client-only purchase validation is a measured failure
  mode, not a theoretical one. Grounds the server-side verification
  requirement.
- Limit: the evaluated apps and on-device attack model are historical; the
  results do not measure modern StoreKit/Play Billing or certify OpenIAP.
- Reviewed: paper abstract and introduction, 2026-09-05.
- Applied: docs `features/validation` security callout;
  `verification.forged-token-is-invalid` in
  `packages/conformance/src/spec/behaviors.mjs` and
  `knowledge/research/misuse-catalog.md` (backlog R2, R6);
  `knowledge/research/research-agenda.md` verification motivation;
  `specs/commerce-protocol/DESIGN.md` reference 1;
  `knowledge/research/issue-corpus-study.md` prior-work boundary.

### reynaud2012freemarket

Daniel Reynaud, Eui Chul Richard Shin, Thomas R. Magrino, Edward X. Wu, Dawn
Song. _FreeMarket: Shopping for free in Android applications._
NDSS 2012.
<https://www.ndss-symposium.org/ndss2012/ndss-2012-programme/freemarket-shopping-free-android-applications/>

- Finding: automatic rewriting made on-device purchase verification return
  success, defeating in-app billing checks in a large share of the tested apps.
- OpenIAP relevance: the earliest of the on-device-verification results behind
  the rule that a client-side check is not evidence; predates VirtualSwindle.
- Limit: the studied apps and billing library are historical, and the result
  says nothing about a server-side verifier's accuracy today.
- Reviewed: programme entry and abstract, 2026-09-06.
- Applied: `specs/commerce-protocol/DESIGN.md` reference 11;
  `knowledge/research/issue-corpus-study.md` prior-work boundary.

### shi2021breaking

Shangcheng Shi, Xianbo Wang, Wing Cheong Lau. _Breaking and Fixing Third-Party
Payment Service for Mobile Apps._ ACNS 2021, LNCS 12727, pp. 3-26.
DOI: 10.1007/978-3-030-78375-4_1.
<https://doi.org/10.1007/978-3-030-78375-4_1>

- Finding: the third-party payment flaw class persists a decade after the first
  results; the authors propose fixes against the exploits they found.
- OpenIAP relevance: prevents citing the 2011-2017 results as closed history,
  and supports stating integration obligations in a contract.
- Limit: the studied services are third-party payment SDKs, not App Store or
  Play subscriptions; it measures neither.
- Reviewed: publisher metadata and abstract, 2026-09-06.
- Applied: `specs/commerce-protocol/DESIGN.md` reference 13;
  `knowledge/research/issue-corpus-study.md` prior-work boundary.

### wang2011shopfree

Rui Wang, Shuo Chen, XiaoFeng Wang, Shaz Qadeer. _How to Shop for Free Online:
Security Analysis of Cashier-as-a-Service Based Web Stores._ IEEE Symposium on
Security and Privacy 2011, pp. 465-480. DOI: 10.1109/SP.2011.26.
<https://doi.org/10.1109/SP.2011.26>

- Finding: logic flaws at the merchant-cashier boundary let a shopper pay less
  than the price, or nothing, with no cryptography broken.
- OpenIAP relevance: the canonical trust-boundary result behind separating a
  provider's acceptance of evidence from a backend's authority to bind it.
- Limit: web checkout with a third-party cashier is a different mechanism from
  store-issued purchase evidence.
- Reviewed: publisher metadata and abstract, 2026-09-06.
- Applied: `specs/commerce-protocol/DESIGN.md` reference 12;
  `knowledge/research/issue-corpus-study.md` prior-work boundary.

### yang2017showme

Wenbo Yang, Yuanyuan Zhang, Juanru Li, Hui Liu, Qing Wang, Yueheng Zhang, Dawu
Gu. _Show Me the Money! Finding Flawed Implementations of Third-party In-app
Payment in Android Apps._ NDSS 2017.
<https://www.ndss-symposium.org/wp-content/uploads/2017/09/ndss2017_05A-2_Yang_paper.pdf>

- Finding: payment vulnerabilities trace back to the payment SDKs themselves —
  flawed SDK design, ambiguous documentation, and vulnerable sample code led
  merchants into security mistakes; the study examines seven security-rule
  violations and four attack types.
- OpenIAP relevance: the core thesis that SDK and documentation quality is the
  security bottleneck is exactly OpenIAP's reason to exist (one audited spec,
  consistent SDKs, conformance).
- Limit: third-party Android payment services in the studied Chinese market
  differ from modern App Store and Play subscription integrations.
- Reviewed: paper abstract and introduction, 2026-09-05.
- Applied: docs `features/validation` security callout; conformance verification
  behaviors and `misuse-catalog.md` (backlog R2, R6);
  `knowledge/research/research-agenda.md` trust-boundary motivation;
  `specs/commerce-protocol/DESIGN.md` reference 2;
  `knowledge/research/issue-corpus-study.md` prior-work boundary.

## Differential and conformance testing

### atlidakis2019restler

Vaggelis Atlidakis, Patrice Godefroid, Marina Polishchuk. _RESTler: Stateful
REST API Fuzzing._ ICSE 2019, pp. 748-758. DOI: 10.1109/ICSE.2019.00083.
<https://doi.org/10.1109/ICSE.2019.00083>

- Finding: stateful request sequences derived from an OpenAPI description, with
  inferred inter-request dependencies, reach states single requests do not.
- OpenIAP relevance: prior art for generating tests from a machine-readable
  interface description, and the boundary of it — structure carries no meaning.
- Limit: it tests for crashes and rule violations at the transport level; it
  does not decide whether a domain answer is semantically correct.
- Reviewed: publisher metadata and abstract, 2026-09-06.
- Applied: `specs/commerce-protocol/DESIGN.md` reference 15.

### bishop2005rigorous

Steve Bishop, Matthew Fairbairn, Michael Norrish, Peter Sewell, Michael Smith,
Keith Wansbrough. _Rigorous specification and conformance testing techniques
for network protocols, as applied to TCP, UDP, and Sockets._ SIGCOMM 2005, pp. 265-276. DOI: 10.1145/1080091.1080123.
<https://doi.org/10.1145/1080091.1080123>

- Finding: a post-hoc behavioral specification of TCP, UDP and Sockets, made
  executable so that real implementation traces can be checked against it.
- OpenIAP relevance: the closest lineage for an executable contract; their
  specification was validated post-hoc against existing implementations, and
  they still left an uninfluenced implementation to future work.
- Limit: transport protocols with a mature installed base; the method's cost
  and its independence from the implementations do not transfer for free.
- Reviewed: publisher metadata and abstract, 2026-09-06.
- Applied: `specs/commerce-protocol/DESIGN.md` reference 21.

### boushehrinejadmoradi2015xchecker

Nader Boushehrinejadmoradi, Vinod Ganapathy, Santosh Nagarakatte, Liviu Iftode.
_Testing Cross-Platform Mobile App Development Frameworks._ ASE 2015,
pp. 441–451. DOI: 10.1109/ASE.2015.21.
<https://www.csa.iisc.ac.in/~vg/papers/ase2015/>

- Finding: X-Checker uses differential testing to find API behavior
  inconsistencies between mobile platforms in Xamarin.
- OpenIAP relevance: direct prior art for testing SDK translation boundaries;
  cross-platform comparison itself is not a new contribution.
- Limit: the evaluated Xamarin APIs do not establish IAP failure behavior.
- Reviewed: author-hosted abstract and publication metadata, 2026-09-05.
- Applied: `knowledge/research/sdk-query-study.md` topic selection and
  contribution boundary.

### brubaker2014frankencerts

Chad Brubaker, Suman Jana, Baishakhi Ray, Sarfraz Khurshid, Vitaly Shmatikov.
_Using Frankencerts for Automated Adversarial Testing of Certificate
Validation in SSL/TLS Implementations._ IEEE S&P 2014.
<https://www.cs.columbia.edu/~suman/docs/frankencert.pdf>

- Finding: running many implementations of one spec on the same mutated inputs
  makes disagreement a cheap source of candidate defects; 8.1M inputs surfaced
  208 implementation discrepancies. A disagreement is a candidate, not a
  verdict — the authors allow that some are benign where behavior is
  unspecified.
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

### ma2026apidiffer

Jie Ma, Ningyu He, Jinwen Xi, Mingzhe Xing, Liangxin Liu, Jiushenzi Luo,
Xiaopeng Fu, Chiachih Wu, Haoyu Wang, Ying Gao, Yinliang Yue.
_When Specifications Meet Reality: Uncovering API Inconsistencies in Ethereum
Infrastructure._ Proceedings of the ACM on Programming Languages 10,
OOPSLA1, Article 111, 2026. DOI: 10.1145/3798219.
<https://arxiv.org/abs/2603.06029>

- Finding: APIDiffer combines specification-guided API testing with
  specification-aware filtering of permitted implementation differences.
- OpenIAP relevance: close prior art for the proposed contract oracle and
  false-alarm evaluation.
- Limit: the study concerns Ethereum; its discussion also identifies misses
  when all implementations produce the same erroneous result.
- Reviewed: arXiv metadata and abstract, and HTML sections 4.4 and 6.2,
  2026-09-05.
- Applied: `knowledge/research/research-agenda.md` contribution boundary and
  semantic comparison; `knowledge/research/sdk-query-study.md` shared-error
  comparison; `specs/commerce-protocol/DESIGN.md` reference 9.

### seriot2016json

Nicolas Seriot. _Parsing JSON is a Minefield._ Practitioner study, 2016.
<https://seriot.ch/security/parsing_json.html>

- Finding: of 34 JSON parsers, no two behave identically; loose spec corners
  become implementation divergence.
- OpenIAP relevance: why behavior specs must pin down what the schema alone
  leaves open — the exact gap `packages/conformance` exists to close.
- Applied: `packages/conformance/README.md` prior-art section.

### utting2012taxonomy

Mark Utting, Alexander Pretschner, Bruno Legeard. _A Taxonomy of Model-Based
Testing Approaches._ Software Testing, Verification and Reliability 22(5),
2012, pp. 297–312. DOI: 10.1002/stvr.456.
<https://researchcommons.waikato.ac.nz/entities/publication/eb140299-43b5-4d35-8aae-5fcd8d519b90>

- Finding: classifies model-based testing by the models and choices used to
  derive and execute tests.
- OpenIAP relevance: structure for describing the protocol model, scenario
  selection, oracle, and implementation adapter.
- Limit: a taxonomy of methods supplies neither IAP-specific safety results
  nor a proof that generated vectors cover every behavior.
- Reviewed: university-hosted abstract and publication metadata, 2026-09-05.
- Applied: `knowledge/research/research-agenda.md` method and citation plan;
  `specs/commerce-protocol/DESIGN.md` reference 8.

## API evolution and versioning

### brito2018why

Aline Brito, Laerte Xavier, Andre Hora, Marco Tulio Valente. _Why and How Java
Developers Break APIs._ SANER 2018.
<https://arxiv.org/abs/1801.05198>

- Finding: breaking changes are mostly deliberate — motivated by new features,
  API simplification, and maintainability — not accidents.
- OpenIAP relevance: intentional breaks still ship unlabeled; detection must be
  mechanical, not trust-based. Supports a schema-diff release guard.
- Applied: `specs/client/scripts/audit-schema-semver.mjs` (backlog R1).

### li2023gosemver

Wenke Li, Feng Wu, Cai Fu, Fan Zhou. _A Large-Scale Empirical Study on
Semantic Versioning in Golang Ecosystem._ ASE 2023.
<https://arxiv.org/abs/2309.02894>

- Finding: semver compliance measured across 124K Go libraries and 532K
  clients; violations persist even in an ecosystem with tooling support.
- OpenIAP relevance: cross-ecosystem baseline showing tooling alone is
  insufficient without release-gate enforcement.
- Applied: `specs/client/scripts/audit-schema-semver.mjs` (backlog R1).

### ochoa2022breakingbad

Lina Ochoa, Thomas Degueule, Jean-Rémy Falleri, Jurgen Vinju. _Breaking Bad?
Semantic Versioning and Impact of Breaking Changes in Maven Central._
Empirical Software Engineering, 2022.
<https://dl.acm.org/doi/10.1007/s10664-021-10052-y>

- Finding: 20.1% of non-major upgrades contain breaking changes; 7.9% of
  clients are actually impacted.
- OpenIAP relevance: quantifies the risk our floor policy in
  `openiap-versions.json` and release-state audits exist to prevent.
- Applied: `specs/client/scripts/audit-schema-semver.mjs` (backlog R1).

### raemaekers2017semver

Steven Raemaekers, Arie van Deursen, Joost Visser. _Semantic Versioning and
Impact of Breaking Changes in the Maven Repository._ Journal of Systems and
Software, 2017.
<https://dl.acm.org/doi/10.1016/j.jss.2016.04.008>

- Finding: about one third of releases across 22K Maven libraries introduce at
  least one breaking change; semver labels are unreliable.
- OpenIAP relevance: original evidence base for treating version labels as
  claims to verify, not facts.
- Applied: `specs/client/scripts/audit-schema-semver.mjs` (backlog R1).

## API learnability and misuse

### amann2016mubench

Sven Amann, Sarah Nadi, Hoan A. Nguyen, Tien N. Nguyen, Mira Mezini. _MUBench:
A Benchmark for API-Misuse Detectors._ MSR 2016.
<https://dl.acm.org/doi/10.1145/2901739.2903506>

- Finding: a dataset of 89 API misuses from 33 projects and a survey supports
  detector benchmarking; 61 of the 89 cause crashes. The paper's 95.5% figure
  is for a subset, not the whole dataset, and the percentages it prints for
  61 of 89 do not match that fraction.
- OpenIAP relevance: method template for an IAP misuse catalog (unfinished
  transactions, unhandled pending purchases, missing restore) feeding lint
  rules and conformance behaviors.
- Limit: this corpus does not establish IAP misuse prevalence or severity;
  the often-quoted 9.1% figure belongs to Amann's 2018 dissertation.
- Reviewed: author-hosted abstract and publication metadata, 2026-09-05.
- Applied: `knowledge/research/misuse-catalog.md` and
  `scripts/mine-iap-issues.mjs` (backlog R5, R6);
  `knowledge/research/sdk-query-study.md` reproducible case design;
  `knowledge/research/issue-corpus-study.md` coding scheme.

### amareen2024graphqlso

Saleh Amareen, Obed Soto Dector, Ali Dado, Amiangshu Bosu. _GraphQL Adoption
and Challenges: Community-Driven Insights from StackOverflow Discussions._
arXiv:2408.08363, 2024.
<https://arxiv.org/abs/2408.08363>

- Finding: taxonomy of where developers actually get stuck adopting GraphQL.
- OpenIAP relevance: checklist of confusion points the schema docs should
  answer preemptively.
- Applied: not yet.

### fontao2018governance

Awdren Fontão, Bruno Ábia, Igor Wiese, Bernardo Estácio, Marcelo Quinta,
Rodrigo Pereira dos Santos, Arilo Claudio Dias-Neto. _Supporting governance of
mobile application developers from mining and analyzing technical questions in
Stack Overflow._ Journal of Software Engineering
Research and Development, 2018. DOI: 10.1186/s40411-018-0052-6.
<https://doi.org/10.1186/s40411-018-0052-6>

- Finding: pending. Developer questions mined from Stack Overflow are analysed
  to support platform governance; the treatment of in-app purchase questions
  within that corpus has not been read.
- OpenIAP relevance: the nearest prior work to the issue corpus study, and the
  reason its novelty claim is narrowed to maintainer-resolved threads across
  frameworks.
- Limit: Stack Overflow questions are a different population from
  maintainer-resolved issue threads, and the finding line above is unverified.
- Reviewed: publisher metadata only, 2026-09-06. Not read.
- Applied: `knowledge/research/issue-corpus-study.md` prior-work boundary.

### robillard2009apis

Martin P. Robillard. _What Makes APIs Hard to Learn? Answers from Developers._
IEEE Software 26(6), 2009, pp. 27-34.
<https://www.cs.mcgill.ca/~martin/papers/software2009a.pdf>
Follow-up field study: Martin P. Robillard, Robert DeLine. _A field study of
API learning obstacles._ Empirical Software Engineering 16(6), 2011,
pp. 703-732. DOI: 10.1007/s10664-010-9150-8.
<https://www.microsoft.com/en-us/research/publication/field-study-api-learning-obstacles/>

- Finding: the 2009 article reports a survey and interviews of Microsoft
  developers identifying documentation as the dominant API-learning obstacle.
  The 2011 field study, across more than 440 professional developers, is the
  source of the documentation factors: intent, code examples, scenario
  matching, penetrability, and format.
- OpenIAP relevance: independent validation of the reader-first documentation
  standard in `knowledge/internal/05-docs-patterns.md`.
- Applied: `scripts/mine-iap-issues.mjs` (backlog R5);
  `knowledge/research/issue-corpus-study.md` method basis.

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
- OpenIAP relevance: the client specification uses GraphQL as a server-less
  IDL (type SSOT only) — a usage pattern essentially absent from this corpus.
  The Commerce Protocol's GraphQL binding is a served surface and is not what
  this comparison covers.
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

## Error handling and fault injection

### yuan2014simpletesting

Ding Yuan, Yu Luo, Xin Zhuang, Guilherme Renna Rodrigues, Xu Zhao, Yongle
Zhang, Pranay U. Jain, Michael Stumm. _Simple Testing Can Prevent Most Critical
Failures: An Analysis of Production Failures in Distributed Data-Intensive
Systems._ OSDI 2014, pp. 249–265.
<https://www.usenix.org/conference/osdi14/technical-sessions/presentation/yuan>

- Finding: analysis of failures in distributed data systems connects serious
  outcomes to error-handling mistakes and motivates testing those paths.
- OpenIAP relevance: methodological basis for injecting lower-layer errors
  and inspecting how SDK callers observe them.
- Limit: the systems studied are not IAP SDKs; their failure rates and
  prevention estimates cannot be transferred to OpenIAP.
- Reviewed: publisher abstract and citation metadata, 2026-09-05.
- Applied: `knowledge/research/research-agenda.md` fault-injection rationale;
  `knowledge/research/sdk-query-study.md` supporting experiment;
  `specs/commerce-protocol/DESIGN.md` reference 10.

## Distributed event processing

### helland2007transactions

Pat Helland. _Life beyond Distributed Transactions: an Apostate's Opinion._
CIDR 2007. Position paper.
<https://www.cidrdb.org/cidr2007/papers/cidr07p15.pdf>

- Finding: explains application-level handling of asynchronous messages,
  including remembered processing state for nontrivial idempotent effects.
- OpenIAP relevance: rationale for duplicate-event cases and explicit
  consumer deduplication in the Commerce Protocol evaluation.
- Limit: design reasoning, not a measured IAP study; idempotence alone does
  not establish delivery, ordering, or safe provider cutover.
- Reviewed: paper abstract and idempotent-message discussion, 2026-09-05.
- Applied: `knowledge/research/research-agenda.md` event-processing rationale;
  `specs/commerce-protocol/DESIGN.md` reference 6.

### helland2012idempotence

Pat Helland. _Idempotence Is Not a Medical Condition._ ACM Queue 10(4), 2012,
pp. 30-46. DOI: 10.1145/2181796.2187821.
<https://doi.org/10.1145/2181796.2187821>

- Finding: separates operations that are naturally idempotent from those that
  need remembered state, and treats at-least-once delivery as the normal case.
- OpenIAP relevance: closer fit than the 2007 position paper for the duplicate
  delivery and stable event identity rules in the webhook contract.
- Limit: design reasoning about messaging in general; no measurement, and
  nothing specific to purchase events.
- Reviewed: publisher metadata and abstract, 2026-09-06.
- Applied: `specs/commerce-protocol/DESIGN.md` reference 14.

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
