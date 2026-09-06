# Commerce Protocol Preliminary Evaluation

Execution record for the checks the
[design rationale](../../specs/commerce-protocol/DESIGN.md) refers to, 5 September 2026. This record reports existing offline tests, not the
proposed store-verification or independent-provider experiments in the
[research agenda](research-agenda.md).

## Source and environment

| Item                              | Recorded value                                                         |
| --------------------------------- | ---------------------------------------------------------------------- |
| Repository                        | `hyodotdev/openiap`                                                    |
| Code revision                     | `100557091077dddcd8e1f22128f80bd2b9747912`                             |
| Protocol version                  | `1.0`                                                                  |
| Protocol package version          | `openiap-commerce-protocol@0.1.0`                                      |
| OS                                | macOS 26.6.2, build 25G83                                              |
| Node.js                           | 22.22.0                                                                |
| Bun                               | 1.3.13                                                                 |
| Vitest                            | 4.1.11                                                                 |
| Start time, protocol              | 2026-09-05 19:24:52 Asia/Seoul                                         |
| Start time, IAPKit                | 2026-09-05 19:24:51 Asia/Seoul                                         |
| Repetitions                       | One invocation of each command; run concurrently                       |
| Working-tree changes at execution | Research Markdown only; runtime source and test expectations unchanged |

Dependencies were already installed in the workspace; no clean dependency
installation was performed for this run. The code revision identifies the
evaluated implementation, while the design rationale and this record are local
additions after that commit.

## Commands and observed results

Run the protocol command from `specs/commerce-protocol`:

```sh
bun run test
```

It performs five generated-artifact drift checks, a package formatting
check, and `vitest run test`. Captured output, with the absolute repository
path shortened:

```text
assembled contract is current
generated JSON Schemas are current
bundle is current
lifecycle vectors are current
generated operation artifacts are current
Checking formatting...
All matched files use Prettier code style!

 RUN  v4.1.11 specs/commerce-protocol

 Test Files  9 passed (9)
      Tests  336 passed (336)
   Start at  19:24:52
   Duration  1.92s (transform 333ms, setup 0ms, import 1.05s, tests 2.88s, environment 0ms)
```

Observed process exit status: `0`.

Run the selected IAPKit suites from `packages/kit`:

```sh
bun run test -- \
  server/api/commerce/conformance.test.ts \
  convex/commerce/spec.conformance.test.ts \
  convex/webhooks/conformance.test.ts \
  convex/subscriptions/stateMachine.test.ts
```

Captured output, with the absolute repository path shortened:

```text
 RUN  v4.1.11 packages/kit

 Test Files  4 passed (4)
      Tests  248 passed | 1 skipped (249)
   Start at  19:24:51
   Duration  659ms (transform 450ms, setup 0ms, import 936ms, tests 162ms, environment 0ms)
```

Observed process exit status: `0`.

The runner reports durations with overlapping work; their components need
not sum to elapsed duration. These single-run timings are not a benchmark.

## Evidence classification

| Artifact                                                                                   | Executed boundary                                                                                                      | Substitutions and limits                                                                                                           |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Protocol tests](../../specs/commerce-protocol/test/)                                      | Generation, schemas, vectors, bindings, portable runner, and mock-provider behavior                                    | Synthetic evidence; assertions include existing deliberate adapter violations. This is not a new mutation experiment.              |
| [Route conformance](../../packages/kit/server/api/commerce/conformance.test.ts)            | Real Hono REST/GraphQL routes, adapters, shared handlers, authorization, validation; selected production event helpers | In-memory Convex substitute and fixture verification. Test reconstructs delivery envelopes and implements the receiver's verifier. |
| [Commerce conformance](../../packages/kit/convex/commerce/spec.conformance.test.ts)        | Production mapping, event construction, gate/emission logic, and specification agreement                               | Synthetic inputs and fake persistence context; no deployed database.                                                               |
| [Webhook conformance](../../packages/kit/convex/webhooks/conformance.test.ts)              | Production Apple/Google normalization and subscription transitions                                                     | Preconstructed notification payloads; no store signature validation or network delivery.                                           |
| [Subscription state machine](../../packages/kit/convex/subscriptions/stateMachine.test.ts) | Production transition and entitlement behavior under the declared unit cases                                           | No store integration or downstream consumer execution.                                                                             |

The `pause -> resume` scenario is skipped for the Apple fixture adapter.
Source inspection identifies `Pause: null` and `Resume: null` in that
adapter's abstract-event map; the suite calls `it.skip` for scenarios
requiring unsupported events. This explanation is based on the test
definition, because the captured default reporter lists only aggregate
counts. It is not an independently measured statement about every Apple
subscription capability.

## Claims supported and excluded

Supported: the five generated-artifact checks and formatting check passed;
the two commands passed 584 test-runner cases across 13 files, skipped one,
and failed none at the recorded revision and environment.

Excluded from these results:

- Real Apple/Google purchase-evidence acceptance or rejection accuracy.
- Production persistence, actual webhook delivery, retries, or destination safety.
- A downstream consumer's response to delayed, duplicate, or missing deliveries.
- Interoperability between independent store-integrated providers or safe migration.
- Incremental defect detection, false-alarm rates, security certification, or exhaustive semantic coverage.

The counts are not distinct requirements, independent defects, or receipts.
Some checks share generated inputs and expectations. No new defects were
observed, no independent oracle was evaluated, and no production service or
store was contacted by these fixture-backed test executions.
