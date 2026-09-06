# Research Agenda

## What exists and what is proposed

The protocol's [design rationale](../../specs/commerce-protocol/DESIGN.md)
explains why the contract's boundaries sit where they do. It reports no
measured result and is not the subject of this agenda.

This agenda proposes the evaluation a research paper on the Commerce Protocol
would need. Updated on 2026-09-05 against repository snapshot
`100557091077dddcd8e1f22128f80bd2b9747912`. The assessments below come from
source inspection. A separate
[execution record](commerce-protocol-evaluation.md) reports what the existing
offline tests establish; E1-E3 remain proposed and none has been run.

The project's primary paper effort is now the
[issue corpus study](issue-corpus-study.md), not a Commerce Protocol paper.

**Research question:** Can a vendor-neutral executable contract preserve the
meaning of purchase verification and current entitlements across store,
provider, and transport boundaries, including partial failures and delayed
subscription events?

The subject of any such paper would be the
[Commerce Protocol](../../specs/commerce-protocol/SPEC.md), with IAPKit as an
implementation used to evaluate it. The narrower
[SDK query study](sdk-query-study.md) remains a supporting failure-preservation
experiment; running it is not a prerequisite for that evaluation.

## Central argument

The protocol separates three observations that integrations must preserve:

| Observation            | Meaning and boundary                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purchase verification  | `isValid` states whether the provider accepts submitted store evidence at verification time; it neither binds an account nor establishes every current entitlement. |
| Subscription lifecycle | Renewal, cancellation, grace, expiry, and revocation describe arrangements and changes over time.                                                                   |
| Current access         | `subscription.active` and scoped entitlement reads express access at a stated observation time, subject to expiry and freshness.                                    |

An unsuccessful attempt to obtain a verification verdict is an operation
error, while a store rejection is a successful response with `isValid: false`
(SPEC §4.1, §8). Turning off auto-renew does not itself revoke a paid period
(§2.3). An authentic event received after its entitlement deadline must not
reopen access (§2.3, §9.4.4). Cryptographic authenticity, evidence acceptance,
and current access therefore need separate checks.

The intended contributions are a precise contract for these distinctions,
portable executable checks, and an empirical evaluation of how consumers
preserve decisions across implementations. Their value must be measured
against existing tests and alternative integration approaches.

## Citation plan

Each citation supports a specific claim. Full scholarly references and reading
status live in [bibliography.md](bibliography.md).

| Claim a paper would make                                         | Source                                                                   | How to use it and its limit                                                                                                                                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Motivation: payment validation crosses a trust boundary           | [mulliner2014virtualswindle](bibliography.md#mulliner2014virtualswindle) | Historical evidence of attacks against on-device Android billing verification. Do not present its measured rate as a current StoreKit or Play Billing statistic.                        |
| Motivation: payment SDK and integration design affect security    | [yang2017showme](bibliography.md#yang2017showme)                         | Evidence from third-party Android payment systems. Its security rules motivate a threat model; it does not evaluate OpenIAP or modern store subscriptions.                              |
| Design: duplicate delivery requires deliberate handling           | [helland2007transactions](bibliography.md#helland2007transactions)       | Explain application-level idempotence and remembered message state. This position paper supplies design reasoning, not a proof of our delivery or ordering guarantees.                  |
| Method: derive tests from an explicit behavior model              | [utting2012taxonomy](bibliography.md#utting2012taxonomy)                 | Describe the chosen model, test selection, oracle, and adapter. Model-based testing itself is established prior work.                                                                   |
| Evaluation: compare implementations using specified semantics     | [ma2026apidiffer](bibliography.md#ma2026apidiffer)                       | Compare our approach with specification-guided differential testing, including permitted differences and shared wrong answers. Its Ethereum results cannot establish IAP effectiveness. |
| Failure experiment: preserve errors through implementation layers | [yuan2014simpletesting](bibliography.md#yuan2014simpletesting)           | Motivate error injection; the SDK supporting study supplies related local examples. Do not borrow distributed-system failure rates.                                                     |

Use standards and vendor documentation as a separate source class:

- [Google subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
  supplies current store obligations for cancellation, grace, and expiry.
- [Apple subscription status](https://developer.apple.com/documentation/appstoreservernotifications/status?changes=___5_1&language=objc)
  defines status relative to the signed observation. Pin the
  relevant Apple renewal/expiry rules before constructing each case.
- [CloudEvents 1.0.2](https://github.com/cloudevents/spec/blob/v1.0.2/cloudevents/spec.md)
  is related event-interchange work. Compare its envelope responsibilities
  with the domain semantics in this protocol; do not imply OpenIAP implements
  CloudEvents or that a common envelope alone supplies entitlement semantics.

The targeted literature review supports topic selection, not a claim of
exhaustive novelty. Before submission, inspect the cited work and its relevant
references in full, then search citing work on payment verification, API
interoperability, protocol testing, and event consistency. Record search/date,
inclusion reason, exact supporting section, publication status, and limits.
Use completed experiments to substantiate OpenIAP's own performance or safety
claims. Citations alone cannot establish those results.

## Bounded first evaluation

Study Apple and Google Play auto-renewing subscriptions. The operation core is
`verifyPurchase`, `subscriptionStatus`, and `entitlements`, with capability and
role checks as preconditions. Establish identities and purchase bindings in
test setup through the allowed server boundary. Verification itself must not
read or mutate account state.

Evaluate REST and GraphQL with equivalent input, provider state, credentials,
and observation time. Compare acceptance, operation-error category, scoped
access, and relevant expiry. Do not require byte-identical documents or
provider-assigned identifiers.

The event path is store → provider → developer backend. Use bounded status
reads when a consumer cannot establish current state from received events.
The evaluated subset does not introduce a mobile webhook stream or prescribe
a complete transition machine; SPEC §14 explicitly leaves the latter open.

## What existing evidence establishes

| Inspected artifact                                                                       | Evidence available                                                                     | Additional evidence needed                                                            |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Authored contract](../../specs/commerce-protocol/schema/05-operations.graphql) and SPEC | Verification/error distinctions, operations, trust roles, lifecycle meaning.           | Independently reviewed obligations and comparison with store semantics.               |
| [Portable runner and mock](../../specs/commerce-protocol/conformance/index.mjs)          | Executable vectors and an IAPKit-free mock demonstrate contract implementability.      | A mock is not a second store-integrated provider or independent external replication. |
| [IAPKit route conformance](../../packages/kit/server/api/commerce/conformance.test.ts)   | Real REST/GraphQL routes with an in-memory Convex substitute and fixture verification. | Actual store-verification and persistence paths must be exercised separately.         |
| [IAPKit commerce tests](../../packages/kit/convex/commerce/spec.conformance.test.ts)     | Real mapping, state, and event-building functions are checked against the protocol.    | Independent expectations, longer fault sequences, and qualified store evidence.       |
| [Protocol limits](../../specs/commerce-protocol/SPEC.md) §11.3, §13–14                   | The contract documents receipt-validation and provider-switching limits.               | Report results within those limits instead of extending claims beyond the tests.      |

Generated schemas and vectors may share an authoring mistake. Add a reviewed
set of expected outcomes derived from normative prose and pinned store rules;
do not generate the evaluation oracle from the implementation under test.

## Experiments and baselines

**E1 — Receipt verification.** Exercise the actual verifier with controlled
sandbox evidence, appropriately scoped valid/invalid cases, and injected
verifier unavailability. Record store, environment, identity/product binding,
validation path, version, expected result, and observed result. Distinguish
store rejection from inability to obtain a verdict. Synthetic well-formed
tokens in the existing conformance vectors establish transport behavior only.
Keep real evidence and credentials out of public artifacts; publish synthetic
reproducers and the procedure for recreating authorized sandbox cases.

**E2 — Meaning across events and reads.** Pin the following scenarios with
independent expected outcomes:

| Scenario                                         | Property to evaluate                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Accepted, rejected, and unavailable verification | The caller distinguishes a verdict from an operation failure.                                               |
| Auto-renew disabled before the paid deadline     | Access remains valid until the applicable deadline, absent another revoking fact.                           |
| Grace window and exact expiry boundary           | Access follows the specified state/time predicate.                                                          |
| Duplicate event delivery                         | Reprocessing one emitter's event creates no repeated substantive effect.                                    |
| Older or delayed access snapshot                 | It cannot overwrite newer correlated state or grant beyond a present deadline.                              |
| Insufficient correlation or equal timestamps     | The consumer preserves ambiguity or performs an authoritative read; timestamps do not invent a total order. |

Eventual delivery is not guaranteed by this protocol. Test retry exhaustion
and read recovery separately; deduplication does not solve missing events,
ordering, or provider-cutover overlap.

**E3 — Consumer portability.** Run one unchanged downstream consumer against
IAPKit and a separately implemented minimal provider with no shared business
logic. Use the same controlled source facts, bindings, and clock. Record the
consumer code hash and configuration changes. A fixture-based second provider
supports a bounded contract-portability claim; production interoperability
needs store-integrated implementations and further evidence.

Limit switching claims to consumer behavior under compatible contracts.
Historical-data migration, credential transfer, and duplicate suppression
across emitter identifier spaces remain operational work under SPEC §13.
Do not claim an automatic or exactly-once cutover.

Compare schema-only validation, existing package/conformance tests, and plain
output comparison with the proposed semantic checks. Keep scenarios and
execution budgets equal when measuring oracle benefit. Use existing tests as
the main baseline. A schema-only baseline alone would be too weak.

Measure distinct confirmed defects, false alarms on valid variations,
implementation-mutant detection, runtime, and consumer/adapter changes. Keep
historical regressions, new defects, and mutants separate; record exclusions
and count shared root causes once. Freeze rules and development cases before
evaluating additional cases. Have another human review expectations and
classifications, including cases where current implementations agree.

## What the existing documents cover

[DESIGN.md](../../specs/commerce-protocol/DESIGN.md) sits next to the
specification and covers the trust model, the design decisions, the reasoning
behind each boundary, its limits, and its references. It reports no measured
result, and the experiments proposed in this agenda are not part of it. [commerce-protocol-evaluation.md](commerce-protocol-evaluation.md) owns
the commands, environment, observed counts, substitutions, and exclusions.

## Next deliverable and paper management

Extend the preliminary execution record with an independent expected-outcome table,
one reproduced verification-failure case, cancellation/expiry/duplicate
scenarios, and an unchanged-consumer run across two declared implementations.
Label every run as simulated, implementation-backed, or store-integrated.
Document unsupported cases and negative results. If only the transport checks
turn out to be reproducible, any paper written from this agenda would have to
be scoped to a protocol and tool design paper until the stronger verification
and portability evidence exists.

This agenda owns the claim-to-evidence plan for a proposed Commerce Protocol
evaluation. The project's primary paper effort is the
[issue corpus study](issue-corpus-study.md).
[bibliography.md](bibliography.md) owns scholarly references;
[backlog.md](backlog.md) owns engineering tasks when promoted. Keep experimental
commands, revisions, environments, inputs, observations, exclusions, and
interpretations together under the existing research owner and link them here
when they exist. No new deployment or protocol behavior is authorized by a
planned experiment.
