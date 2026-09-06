# Primary Study: What Actually Goes Wrong in In-App Purchase Integrations

## Study topic

**A nine-year issue study of in-app purchase integration failures across six
framework SDKs and four stores**

Status: primary empirical study, scoped 2026-09-06. The corpus is mined and
measured; no issue has been classified yet and no result is reported here.
The protocol's
[design rationale](../../specs/commerce-protocol/DESIGN.md) reports no measured
result; its boundary table is a source of hypotheses for this study rather than
a result.

**Research question:** When developers integrate in-app purchases, which
failures do they actually hit, how are those failures distributed across
store, platform and framework, and where does responsibility sit — the SDK,
the store, or the integration?

## Why this topic and not the protocol paper

A Commerce Protocol paper would have no measured result to report. Its
evaluation would be the project's own passing tests, its central distinction
between lifecycle and current access is one that several purchase and
entitlement implementations already draw, and its specification, generators,
tests and reference implementation share one author. Those problems are
structural, and no amount of writing fixes them.

This study has a different shape. The issues are public, so anyone could
re-mine them; what is unusual is that one maintainer has carried the same
purchase semantics across an ecosystem that grew over nine years, from one
React Native library to six frameworks and four stores, so the same failure
can be traced across framework boundaries within one project's conventions
wherever their histories overlap. That is the comparison this corpus supports and a
single-framework corpus does not.

Prior work supports the method and leaves this specific question open.
`robillard2009apis` establishes documentation as the leading API-learning
obstacle; `amann2016mubench` shows a misuse catalogue can be built from real
reports and used as a detector benchmark; `chen2019devils` shows that payment
integration requirements can become unenforceable through the guidance
channel itself. The payment-security lineage — `reynaud2012freemarket`,
`wang2011shopfree`, `mulliner2014virtualswindle`, `yang2017showme`,
`shi2021breaking` — reports what an attacker can do, and `yang2017showme` also
investigates documentation and sample code as causes.

In-app purchase failures are not untouched territory, and the novelty claim
must be narrowed accordingly. Developer-question mining has covered mobile
development broadly and touched in-app purchases within it, for example
`fontao2018governance`. The narrow claim this study can make is a
longitudinal, cross-framework taxonomy built from maintainer-resolved
threads, and that distinction is provisional until the related-work search is done
properly. `fontao2018governance` is registered from publisher metadata and
has not been read. Whether store vendors have published failure statistics
that would bear on this question is itself unchecked, and checking it is part
of the outstanding search.

## The corpus

Mined with `scripts/mine-iap-issues.mjs` on 2026-09-06. Counts are the full
issue history of each source repository, not a sample. Medians are the
conventional median, averaging the two middle values for an even count.

The export these numbers come from is not committed and is not preserved: it
was written to a temporary directory, and the repository's ignored export is
an older one holding 2,265 issues. Reproduce them by running the miner and
counting records per `library`, body length in UTF-16 units, and `comments`,
then compare against this table. Expect small differences: the corpus grows.
The re-export required before coding must record a retrieval timestamp and a
content hash per record precisely so this stops being true.

| Repository               |    n | Closed | Years     | Median body | Median comments |
| ------------------------ | ---: | -----: | --------- | ----------: | --------------: |
| `react-native-iap`       | 1624 |  99.9% | 2017-2026 |       838.5 |               3 |
| `flutter_inapp_purchase` |  408 |  99.8% | 2018-2026 |         614 |               2 |
| `expo-iap`               |  125 |  99.2% | 2024-2026 |        1134 |               3 |
| `openiap` (monorepo)     |   92 |  96.7% | 2025-2026 |        2072 |               2 |
| `godot-iap`              |   15 |  60.0% | 2025-2026 |        1437 |               2 |
| `kmp-iap`                |    6 |  83.3% | 2025-2026 |       336.5 |             1.5 |
| **Total**                | 2270 |  99.4% | 2017-2026 |       836.5 |               3 |

Only 16 issues have an empty body. A no-CJK-character heuristic leaves 2250
of 2270 issues, which is a weak proxy for language and not a language
identification; the share written in English has to be measured with a real
classifier before it is reported. Platform is partly recoverable from labels
today — 497 iOS, 395 Android, 22 Amazon, 1 Meta — which is a starting point,
not the platform variable itself. Two stale-label variants exist and together
cover 253 unique issues.

The distribution is uneven by design and by history. `react-native-iap` is
72% of the corpus and the only library with a full nine years. `kmp-iap` and
`godot-iap` are too small to support per-framework claims and will be
reported as counts only.

### The export is not yet sufficient

The current export records a comment **count**, not comment text, and caps
each body at 4,000 UTF-16 units, the unit JavaScript's `slice` uses. 119
bodies reach that cap. Reaching it is not proof of truncation, because the
original lengths were not recorded; the re-export below has to record them. Because 95% of
issues carry at least one comment and responsibility is usually established
in the thread rather than the report, the corpus as exported cannot support
the resolution coding this study depends on.

Before any coding begins, the miner must archive the full thread for each
issue, the linked commits, pull requests and releases, and a retrieval
timestamp and content hash per record, and it must stop truncating bodies.
Recording the miner's commit is not enough: GitHub threads are editable, so
the archived copy is the object of study and it has to be fixed and
verifiable. This is a precondition, not future work.

### What the archive may hold, and what may be released

An in-app purchase tracker is not ordinary issue text. Reporters paste purchase
tokens, order and transaction ids, receipt payloads, signed JWS blobs, sandbox
account addresses and raw store logs into bodies and comments. Public origin is
not consent to republish, and some of those values still authenticate.

So the raw archive stays private: not committed, not published, not copied into
a transcript, an issue or a commit. Before release the corpus is reduced to what
the coding needs — the failure, the resolution, and the coded variables — and
anything matching a credential, token, receipt or address pattern is removed by
rule, with the removal recorded; a coder who meets one the rule missed removes
it and extends the rule. The issue number stays, so this is not anonymisation:
anyone can open the thread. What the release avoids is republishing those
strings in a form easier to mine than the tracker itself.

Deleting the archive on publication would break the promise to make the coding
disputable, because the threads it was coded from are editable and the raw
hashes cannot reconstruct what was deleted. So the release carries, for every
coded issue, the redacted excerpt its codes rest on and that excerpt's content
hash: that is the evidence a disputant reads. The raw archive stays private
until the coded corpus is published and any correction round on it has closed,
and is deleted then, or twelve months after publication if no correction round
opens.

## Coding scheme

The seed is [`misuse-catalog.md`](misuse-catalog.md), which already names ten
misuse patterns with an outcome class attached — for example
`misuse.error-treated-as-invalid` (entitlement),
`misuse.pending-treated-as-purchased` (revenue),
`misuse.finish-before-grant` (entitlement). Those ten are the deductive part
of the scheme. Open coding on a first sample extends it; a pattern that
survives the second coder enters the codebook with a definition, a positive
example and a negative one.

Each issue receives:

- **Exclusion status**, decided first and separately from the failure
  variables: in scope, or excluded as a feature request or support question
  that describes no failure. A question can describe a genuine failure, so
  the question label is not itself an exclusion. A report of a failure someone
  else already reported is **not** excluded: it is a report, and dropping it
  would remove the very frequency this study measures. Repeat reports are
  linked to their root-cause group instead, which is what the distinct-defect
  view collapses. Only an accidentally duplicated export record, the same
  issue appearing twice in the archive, is excluded.
- **Failure mode**, one or more codebook entries. Multiple labels are
  allowed; agreement on a multi-label variable is measured per label.
- **Attributed responsibility**: integration, SDK, store, shared, or
  undetermined. Assigned from the archived resolution, never from the
  reporter's opinion, and reported as *attributed*, not as established cause,
  unless the independent audit below is run.
- **Store** and **platform** as two separate variables, because a store and
  the operating system it runs on are not the same axis and a single issue can
  name one without the other.
- **Framework**, multi-valued. An issue in a library repository carries that
  library. A monorepo issue carries every framework its evidence names; failing
  that, `native` when the evidence points at the Apple or Google package with no
  consuming framework named, `backend` when it is about IAPKit or the
  specification, and `undetermined` when the evidence settles neither. Those
  three are values, not absences: a large share of monorepo issues name no
  framework at all, and a rule that let those fall out of the variable would
  quietly shrink the denominator. A distribution by framework
  counts an issue once per framework it carries, states that denominator, and
  reports the `native`, `backend` and `undetermined` counts beside it together
  with how many issues carry more than one framework.

`candidateCategories` in the mined records is a keyword triage aid used for
stratified sampling only. It never becomes a label. Its distribution
(subscription-state 1077, purchase-flow 691, product-fetch 615,
error-handling 600, receipt-validation 540, unclassified 339) counts keyword
matches, not topics: the categories overlap, one issue can match several, and
none of them is validated. It shows which candidate categories have enough
material to sample from, and nothing about how topics are actually
distributed.

## Method

1. Re-export the corpus with full threads and linked resolution evidence,
   freeze it at a recorded commit, and publish the mining command, the record
   schema, the content hashes and the exact counts.
2. Predefine the stratified sample: the allocation across strata, the
   agreement threshold that has to be met per variable, and the confidence
   interval to be reported with each kappa. Rare categories will not be
   estimable from a proportional sample and need either oversampling or an
   explicit statement that they are not estimated.
3. Two coders label the sample independently. Report Cohen's kappa per
   variable with its interval. Resolve disagreements by discussion, record
   both the pre-adjudication disagreement and the resolution, and revise the
   codebook.
4. Validate the revised codebook on fresh cases coded independently, not on
   the cases used to build it. Stabilisation means the new cases need no
   further codebook change.
5. Code the remainder against the frozen codebook. Re-measure agreement on a
   held-out slice at the end to detect drift.
6. Report distributions, not just totals: failure mode by framework, by
   store, and over time. Nine years spans two Apple receipt APIs and two Play
   Billing generations, so each issue also carries the SDK version and, where
   recoverable, the store API generation. Without those, a temporal or
   cross-framework difference cannot be separated from a migration effect.
7. Release the coded corpus and the codebook so the classification can be
   disputed.

## Threats to validity

**The researcher is the maintainer.** The same person wrote the SDKs, closed
most of these issues, and is proposing the taxonomy. Maintainer authorship
does not make the study invalid, and independence does not require a coder
ignorant of the codebase. What it does make impossible is validating a
diagnosis with agreement alone: if the maintainer wrote the resolution that
both coders read, high agreement measures the clarity of that resolution and
nothing else. Responsibility is therefore reported as *attributed
responsibility* unless a sample is independently audited against the fix,
the reproducer, or the store's own documentation, with that evidence
preserved.

**Reported issues are not a defect population.** They are the failures a
developer could not resolve alone and chose to report on GitHub, in whatever
language, which the corpus section notes has not been measured.
Frequency in this corpus measures reporting, not incidence. Every claim must
be phrased about reports.

**Selection.** All six repositories belong to one project and one maintainer.
Conventions, documentation quality and issue-template design are shared, so
the corpus cannot separate a property of in-app purchase integration from a
property of these libraries. Comparing against an unrelated IAP library's
issues would bound this, and is the obvious extension.

**Survivorship and resolution quality.** Older issues were closed under
different labelling practice, and 253 carry a stale label across two
variants. Where responsibility is not recoverable from the archived thread,
`undetermined` is used rather than inferred.

**Shared underlying defects.** One upstream bug can produce many issues
across frameworks and years, so a report count and a distinct-defect count
are different measurements. Both are reported, never mixed: report frequency
keeps every issue as its own unit, and the distinct-defect view counts each
root-cause group once. Each is stated with its own denominator, and for a
group spanning several frameworks or years the rule for which bucket it
falls in is fixed before coding starts.

**Framework imbalance.** The archived histories are very uneven:
`react-native-iap` reaches back 8.9 years and `flutter_inapp_purchase` 8.1,
`expo-iap` 2.0, while `openiap`, `kmp-iap` and `godot-iap` are all under two
years. Cross-framework comparison is honest only between the first two and,
with care, `expo-iap`.

## First milestone and decision gate

Re-export the corpus with full threads, then code a stratified sample of 150
issues with two coders. 150 is a pilot for the codebook, not a basis for
precise per-category estimates: at proportional allocation a category holding
1% of the corpus yields about one and a half examples, so rare categories are
oversampled or explicitly not estimated.

The gate has three parts, all fixed before coding starts. The codebook must
stabilise, meaning fresh independently coded cases need no further change.
Agreement must meet the predefined threshold per variable, reported with
intervals. Responsibility must be recoverable often enough to be a variable
at all, measured as the share of in-scope issues receiving a value other than
`undetermined` — high agreement on `undetermined` would not pass this.

If the codebook does not stabilise, or responsibility is not recoverable, the
study is a descriptive corpus paper rather than a taxonomy paper. That is
worth knowing before coding 2,270 issues.

No result from this study may be cited anywhere in the repository until the
sample is coded and the agreement figures are recorded here.
