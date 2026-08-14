# OpenIAP Conformance Suite

A versioned behavioral contract for OpenIAP implementations, plus a runner that
executes it against any implementation through an adapter and emits a
compatibility report.

The GraphQL schema in `packages/gql` defines what the API _is_. The capability
matrix defines which stores must implement each behavior. This package defines
what each behavior must **do**.

```text
packages/gql/src/*.graphql            API shape and types
packages/gql/src/capability-matrix.mjs   which stores must implement what
packages/conformance/src/spec/        what each behavior must do   <- you are here
```

## Versioning

A report states two versions, and neither is optional:

| Field          | Meaning                                                           |
| -------------- | ----------------------------------------------------------------- |
| `suiteVersion` | Version of this behavior suite (`src/spec/suite-version.mjs`)     |
| `specVersion`  | OpenIAP spec version validated, read from `openiap-versions.json` |

"Conformant" without both attached is exactly the unverifiable claim this suite
exists to replace.

Suite version bumps: **major** when a behavior is added or tightened (previously
passing runs may fail), **minor** when a capability-gated behavior is added,
**patch** for wording or tooling only.

Behavior ids are permanent public identifiers. Renaming one is a breaking change
— retire it and add a new id instead.

## Running the suite

```js
import { runConformance, formatReport } from "openiap-conformance";

const report = await runConformance(myAdapter);
console.log(formatReport(report));
process.exit(report.conformant ? 0 : 1);
```

See the reference run:

```bash
npx openiap-conformance-report          # from an install
bun run --cwd packages/conformance report   # from this repo
```

The reference client intentionally excludes server-side lifecycle behaviors,
so its report is labelled **partial** and is not a conformance verdict. Passing
only `options.behaviors` subsets always produces a partial report;
`report.conformant` can be true only when the full canonical behavior inventory
was evaluated without failures.

## Writing an adapter

An adapter binds your implementation to behavior ids. Each entry is a function
that **throws on violation** — any assertion library, or none.

```js
export const myAdapter = {
  implementation: "my-iap-sdk@2.1.0", // appears in the report
  store: "Google", // must be an IapStore the matrix knows

  behaviors: {
    "products.fetch-returns-requested-skus": async () => {
      const products = await mySdk.fetchProducts({ skus: ["premium", "nope"] });
      assert.deepEqual(
        products.map((p) => p.id),
        ["premium"],
      );
    },
    // ... one entry per applicable behavior
  },

  // Optional: for behaviors gated on a capability your store does NOT support,
  // prove the documented absence instead of skipping.
  absenceChecks: {
    "purchases.pending-purchase-is-not-delivered-as-purchased": async () => {
      assert.equal(await mySdk.canProducePendingPurchases(), false);
    },
  },
};
```

### Rules the runner enforces

- **A missing MUST behavior is a failure, not a skip.** An adapter that
  implements nothing is reported non-conformant, not compliant.
- **Capability gating comes from the matrix, not the adapter.** An
  implementation cannot excuse itself from its own store's requirements. A
  behavior gated on a capability your store must support is required; one gated
  on a capability your store cannot support becomes an absence check. An
  optional capability is checked when implemented and otherwise reported as
  not applicable.
- **Unknown stores fail closed.** If `store` is not in the capability matrix,
  the runner rejects the adapter instead of silently treating gated behaviors
  as not applicable.

### Outcomes

| Outcome          | Meaning                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------- |
| `pass`           | Behavior verified                                                                         |
| `fail`           | MUST behavior violated or unimplemented — including `NOT_IMPLEMENTED`; blocks conformance |
| `warn`           | SHOULD behavior violated or unimplemented                                                 |
| `not-applicable` | Store cannot support the gating capability, or an optional capability is not implemented  |

## Fake store

Real purchases cannot happen in CI. `FakeStore` is a deterministic in-memory
store backend that lets purchase, completion, and restoration flows run
anyway. It models the _store_, not OpenIAP — it speaks store-shaped results and
knows nothing about normalized types, so the normalization the suite asserts is
still your implementation's job.

```js
import { FakeStore, StoreOutcome } from "openiap-conformance/fake-store";

const store = new FakeStore({ catalog: [{ sku: "premium", type: "subs" }] });
store.forceOutcome("premium", StoreOutcome.UserCancelled);
```

`src/fake-store/reference-implementation.mjs` and
`src/adapters/reference-adapter.mjs` are a worked example of the whole contract.
**A passing reference run says nothing about any shipped SDK** — it proves the
suite is executable, and shows adapter authors the expected shape.

## Cross-language use

_Repository tooling — these scripts read monorepo paths and are not published._

Behavior ids are exported to Kotlin and Swift so native suites assert against
the same spec:

```bash
node packages/conformance/scripts/generate-behavior-ids.mjs          # write
node packages/conformance/scripts/generate-behavior-ids.mjs --check  # CI drift gate
```

| Language | Generated file                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------ |
| Kotlin   | `packages/google/openiap/src/conformanceTest/java/dev/hyo/openiap/conformance/ConformanceBehaviors.kt` |
| Swift    | `packages/apple/Tests/OpenIapTests/ConformanceBehaviors.swift`                                         |

## Current coverage

Honest status — not every behavior is exercised against every implementation yet.

Run `node scripts/coverage-report.mjs` for the current matrix.

| Implementation                         | Bound to spec                                                | Notes                                                                              |
| -------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| expo-iap                               | products, purchases, restoration, subscriptions, identifiers | Real SDK over a fake native module                                                 |
| react-native-iap                       | + completion                                                 | Real SDK over a fake Nitro module                                                  |
| Android stores (Play, Horizon, Amazon) | subscriptions, errors, identifiers                           | Real flavor code, one suite for all three                                          |
| Apple client                           | errors, identifiers, verification, capabilities              | Purchase flows need a live StoreKit session (StoreKitTest), unavailable to SwiftPM |
| IAPKit webhooks (Apple, Google)        | `lifecycle.*`                                                | Real normalizers + state machine                                                   |
| Reference (fake store)                 | all client-side behaviors                                    | Proves the suite runs; **not a shipped SDK**                                       |
| Flutter, KMP, MAUI, Godot              | —                                                            | Adapters not yet written                                                           |

Adding an implementation means writing an adapter, not another test suite.
