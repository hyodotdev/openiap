# Research Registry

Peer-reviewed and practitioner research that grounds OpenIAP design decisions.
Like `knowledge/archive/`, this folder
is background reference: it is intentionally **not** compiled into
`_agent-context` or `llms*.txt`.

## Why this exists

A project that calls itself a specification needs sources. This registry keeps
two loops honest:

1. **Docs** — user-facing claims ("always validate server-side") cite measured
   evidence instead of asserting it.
2. **Code** — engineering work motivated by research is tracked in
   [`backlog.md`](backlog.md) together with the paper behind it.

## The evidence loop

```text
paper found → entry in bibliography.md (stable cite key)
           → applied as a docs citation or backlog item
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

## Files

| File                                     | Contents                                      |
| ---------------------------------------- | --------------------------------------------- |
| [`bibliography.md`](bibliography.md)     | Annotated bibliography with stable cite keys  |
| [`backlog.md`](backlog.md)               | Research-driven engineering backlog (R-items) |
| [`misuse-catalog.md`](misuse-catalog.md) | IAP misuse patterns with detection mapping    |
