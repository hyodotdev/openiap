# Supporting Study: SDK Query Failures

## Study topic

**Silent Failures in In-App Purchase SDKs: Preserving Query Outcomes Across
Language Boundaries**

Status: supporting experiment; evaluation proposed. Scoped on 2026-09-05 against
repository snapshot `100557091077dddcd8e1f22128f80bd2b9747912`.
No experiments or new defects are reported in this plan.
This study is deferred. It was scoped as a supporting case for a Commerce
Protocol paper that is no longer being written; the project's primary study
is now the [issue corpus study](issue-corpus-study.md). The design below is
kept because the failure-preservation question stands on its own, not because
anything depends on it.

**Research question:** When a store or native bridge fails to answer a purchase
query, do framework SDKs preserve that failure, and how effectively can a
shared executable contract detect transformations into apparent success?

The intended contribution is an empirical study and reproducible benchmark of
purchase-query failures across SDK boundaries. The proposed method injects
faults below the code under test and checks outcomes against independently
specified rules. Its benefit over existing tests remains to be measured.

## Why this topic

[PR #276](https://github.com/hyodotdev/openiap/pull/276), commit
`791cd441876834fe1c01822a31420639d62d84e3`, changed native packages and framework
SDKs to preserve failed queries and reject malformed purchase batches. The
patch includes error-to-empty conversions and decoders that dropped individual
records. An app replacing its purchase view with these results could remove
previously visible purchases after a failed lookup.

[PR #395](https://github.com/hyodotdev/openiap/pull/395), commit
`34c6742e7b0214d2cd209f045cd72c1d2817584a`, later preserved errors in additional
React Native iOS query methods. Those methods are outside the initial pilot;
the patch motivates studying the boundary beyond one repaired call site.
Both patches were inspected during topic selection and are known development
evidence, never an unseen evaluation set. Their behavior has not been
independently replayed for this study.

This scope offers identifiable failure sites, public before/after source, and
existing regression tests. Issue mining supplies candidate cases. Whole
purchase lifecycles, transaction completion, webhook ordering, and AI-generated
integrations are deferred until this smaller contract has been evaluated.

## Prior work and contribution boundary

Full citations live in [bibliography.md](bibliography.md).

| Source | Established prior work | Implication |
| --- | --- | --- |
| [boushehrinejadmoradi2015xchecker](bibliography.md#boushehrinejadmoradi2015xchecker) | Differential testing of mobile framework API behavior. | Cross-platform comparison itself is not a new method. |
| [yuan2014simpletesting](bibliography.md#yuan2014simpletesting) | Error-handling mistakes explain serious failures in distributed systems. | Fault injection and error-path testing are established; its failure rates cannot be transferred to IAP. |
| [ma2026apidiffer](bibliography.md#ma2026apidiffer) | Specifications guide Ethereum API test generation and assessment of differences. | Specification-guided comparison and permitted-variation handling have close prior art. |
| [amann2016mubench](bibliography.md#amann2016mubench) | Reproducible API misuse examples support detector evaluation. | Build adjudicated examples with faulty and fixed revisions; issue labels alone do not establish bugs. |

APIDiffer also discusses the limitation of all implementations returning the
same wrong answer. OpenIAP's shared native dependencies make correlated
failures a relevant evaluation case. Neither this limitation nor adding an
independent oracle is claimed as a new testing principle.

The contribution to establish is the IAP-specific corpus, purchase-query
contract, and measured detection and portability across real bridge paths.
The literature search so far is targeted, not systematic; novelty is
provisional. Before drafting novelty claims, examine these papers' references
and citing work on exception translation, silent data loss, and SDK testing.
Record search query/date, inclusion reason, and relevant section for each
source. Search-result absence cannot establish a first-of-its-kind claim.

## Bounded scope

- Start with `getAvailablePurchases`. Add `getActiveSubscriptions` and
  `hasActiveSubscriptions` only after their distinct query and filtering
  contracts are recorded. Receipt verification and entitlement policy are
  outside this first paper.
- Pilot React Native IAP and Expo IAP; add Flutter InAppPurchase for a Dart
  boundary. Target Apple and Google Play configurations where the selected
  operation and injection seam are supported.
- Treat SDK/platform combinations as configurations. Shared native code and
  copied fixes do not create independent implementations or independent bugs.
- Inject query errors, failed required subqueries, malformed bridge records,
  and lost terminal responses. Include success-after-failure sequences with
  frozen store state and explicit retry budgets.
- Compare controlled observations for the same scope: store account, product
  filters, product type, query options, and data freshness. Apple and Google
  need not return identical inventories.

## Proposed oracle

Classify observations using the existing API contract. These are harness
categories, not proposed public API types:

| Observation | Required evidence |
| --- | --- |
| Successful result, including an empty list or `false` | The required query completed and its result is valid for the documented scope. |
| Failed query | A store, bridge, or decoding failure reaches the caller through the specified error channel. |
| Unsupported operation | The contract identifies the unsupported capability and its prescribed response. |
| Incomplete observation | Completion cannot be established within the test budget; diagnose before classifying a defect. |

A failed required lookup cannot become a successful empty result, successful
`false`, or a silently truncated list. For an API promising a complete list,
a malformed required record must not be dropped while the remaining records
are presented as complete. Legitimate filters, documented nullable results,
and explicitly permitted partial results retain their own semantics.
Check the specified error category as well as rejection: a lookup failure
must not acquire an unsupported item-absence verdict during translation.

Google's [PurchasesResponseListener](https://developer.android.com/reference/com/android/billingclient/api/PurchasesResponseListener)
passes query status separately from its purchase list. Record equivalent
source-level obligations for each Apple and bridge path before assigning
expected outcomes. A query over cached StoreKit data must not be assumed to
fail whenever the network is unavailable.

An app fixture may demonstrate the consequence by replacing a displayed
purchase list after successful refreshes and recording errors otherwise.
Label simulated loss of access as conditional on that fixture's policy.
A query failure supplies no new ownership verdict; a successful empty result
alone does not establish globally absent entitlements. Cache expiry, refunds,
revocation, and offline-access policy remain application/backend concerns.

## Existing assets and gaps

| Asset | Available at the inspected snapshot | Work needed |
| --- | --- | --- |
| [Conformance package](../../packages/conformance/README.md) | Shared behavior inventory and implementation-specific bindings. | Common purchase-query scenarios and observations. |
| [Differential runner](../../packages/conformance/src/runner/differential.mjs) | Compares per-behavior outcomes such as pass/fail. | It does not drive common injected inputs or compare purchase traces. |
| [Differential test](../../packages/conformance/test/differential.test.mjs) | A reference adapter callback deliberately throws. | This exercises reporting; it is not a mutation in a shipped SDK. |
| [React Native](../../libraries/react-native-iap/src/__tests__/conformance.test.ts) and [Expo](../../libraries/expo-iap/src/__tests__/conformance.test.ts) bindings | Real TypeScript wrappers over mocked native modules. | Faults below actual Swift/Kotlin bridges need separate execution seams. |
| [Flutter channel tests](../../libraries/flutter_inapp_purchase/test/flutter_inapp_purchase_channel_test.dart) | Malformed-batch and explicit-empty regression cases. | Shared adapter and native boundary execution. |
| [Issue mining](../../scripts/mine-iap-issues.mjs) and [misuse catalog](misuse-catalog.md) | Candidate discovery and initial vocabulary. | Root-cause review, deduplication, and reproducible cases. |

Extend `packages/conformance` for the eventual harness and keep language
adapters with their owning packages. Reuse existing contracts and validators;
specify missing rules through their canonical owner. Do not create a parallel
purchase schema or infer expected results from current SDK output.

## Evaluation

**RQ1 — Failure mechanisms.** Which boundary transformations lose query
failure or completeness information? Each case records its source issue/patch,
faulty and fixed revisions, operation, layer, minimal input, expected/observed
outcome, and root-cause cluster. A second human reviewer checks classifications;
retain disagreements. Count a shared native defect once and report downstream
exposure separately.

**RQ2 — Detection benefit.** Record versions and execution budgets for:

| Comparison | Purpose |
| --- | --- |
| Type generation and API parity | Establish which defects preserve interfaces; contextual, not the main baseline. |
| Existing package unit/regression and conformance tests | Measure additional detection against tests maintainers actually use. |
| SDK-output differential comparison under identical injected scenarios | Measure misses when implementations share an erroneous result. |
| Shared contract oracle under the same scenarios | Measure the benefit of independently specified outcomes. |

For historical bugs, report the tests available before the fix and added
regression tests separately. Do not remove existing tests to favor the method.
Use the same injected scenarios for comparable baseline and proposed checks
to distinguish input-generation gains from oracle gains.

Keep historical bugs, prospectively discovered bugs, and implementation
mutants in separate tables. A mutant must alter executed SDK/native code,
retain the type/interface contract, and be reviewed for reachability and
equivalence. A deliberately failing assertion is not a mutant. Report
equivalent and unbuildable exclusions.

**RQ3 — False alarms and cost.** Include successful empty and nonempty
results, filtered lists, documented optional absence, and unsupported
capabilities. Measure false alarms, distinct confirmed defects, mutation
detection among eligible mutants, runtime, and adapter effort. Report counts
and denominators by root-cause family and executed layer. Repeat deterministic
failures to confirm reproducibility. This selected corpus cannot estimate
ecosystem prevalence or production revenue loss.

Freeze development cases, oracle rules, mutation families, and baselines
before evaluating additional cases. Known patches above remain development
cases. Reserve cases reviewed independently after the freeze or collected
prospectively; disclose maintainer familiarity and any reuse across sets.

## First milestone and decision gate

The next deliverable is a pilot report, before a full manuscript:

1. Reproduce relevant parts of PR #276 on faulty and fixed revisions in
   isolated checkouts; retain build blockers in the report.
2. Cover an explicit empty result, complete nonempty result, native query
   failure, mixed malformed batch, failed required subquery, and recovery
   after transient failure. Establish each scenario's preconditions first.
3. Run two framework configurations with shared observations and execute at
   least one actual native-to-framework bridge with injection below it.
   Mocks replacing the bridge establish wrapper coverage only. Add Flutter
   after the first two adapters agree on the input format.
4. Compare existing tests and the proposed oracle, including a shared-error
   case where output comparison alone agrees on an incorrect result.

Proceed with a full empirical paper when independently reviewed cases extend
beyond replaying one known patch, benefits or limitations against strong
baselines are measurable, and the artifact reproduces across declared
boundaries. If it only repackages regression tests, publish a focused
engineering case study and benchmark with that narrower claim. Retain negative
results. Submission format and venue follow the evidence.

## Maintaining the paper

This file owns this supporting study's scope, questions, and experiment decisions.
[bibliography.md](bibliography.md) owns citations and source limitations;
[backlog.md](backlog.md) owns engineering tasks when promoted. Keep each
experiment's revision, environment, commands, inputs, raw outcomes, exclusions,
and interpretation together under the existing research owner; link it here
when it exists. Use explicit evidence statuses: proposed, reproduced,
independently checked, or superseded. Published claims need a linked result.

Further study priorities are maintained in the [research agenda](research-agenda.md).
