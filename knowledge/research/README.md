# Research Registry

Peer-reviewed and practitioner research that grounds OpenIAP design decisions.
Like `knowledge/archive/`, this folder
is background reference: it is intentionally **not** compiled into
`_agent-context` or `llms*.txt`.

## Why this exists

A project that calls itself a specification needs sources. This registry keeps
three loops honest:

1. **Docs** — user-facing claims ("always validate server-side") cite measured
   evidence instead of asserting it.
2. **Code** — engineering work motivated by research is tracked in
   [`backlog.md`](backlog.md) together with the paper behind it.
3. **Original research** — [`research-agenda.md`](research-agenda.md) records
   the research questions, evaluation plan, and evidence gaps, and the
   [execution record](commerce-protocol-evaluation.md) states what the current
   checks actually establish. Neither reports a measured research result. The
   protocol's design rationale sits next to the specification it explains, in
   [`specs/commerce-protocol/DESIGN.md`](../../specs/commerce-protocol/DESIGN.md).

## The evidence loop

```text
paper found → entry in bibliography.md (stable cite key)
           → applied as a docs citation, research plan, or backlog item
           → the entry's "Applied" line updated in the same change
```

## Conventions

- Cite keys are `firstauthorYYYYkeyword` (for example
  `mulliner2014virtualswindle`). Keys are permanent; fix a wrong entry in
  place rather than re-keying it.
- Every entry records the full citation, a link, a one-line finding, a
  one-line OpenIAP relevance, and where it is applied. No entry without a
  relevance line — this is a working registry, not a reading list.
- Prefer the publisher or author PDF link; arXiv is fine when it is the
  canonical open version.
- English only, like all repository-authored public content.
- For preprints and anything else not peer reviewed, record what was reviewed,
  when, and the limits of applying its findings to OpenIAP. Separate planned
  experiments from results.
- Connect each claim on this surface to its supporting source and experiment.
  Distinguish scholarly evidence from standards and current store documentation.

## Files

| File                                                                 | Contents                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`bibliography.md`](bibliography.md)                                 | Annotated bibliography with stable cite keys                 |
| [`backlog.md`](backlog.md)                                           | Research-driven engineering backlog (R-items)                |
| [`misuse-catalog.md`](misuse-catalog.md)                             | IAP misuse patterns with detection mapping                   |
| [`research-agenda.md`](research-agenda.md)                           | Evaluation a Commerce Protocol paper would need; none is being written |
| [`commerce-protocol-evaluation.md`](commerce-protocol-evaluation.md) | Reproducible offline baseline and evidence limits            |
| [`issue-corpus-study.md`](issue-corpus-study.md)                     | Primary study: nine-year IAP issue corpus and coding plan     |
| [`sdk-query-study.md`](sdk-query-study.md)                           | Supporting SDK query-failure experiment                      |
