# Commerce Protocol conventions

Rules for changing the OpenIAP Commerce Protocol. Read `SPEC.md` first; this
file covers how to modify it safely.

## The GraphQL contract is the source of truth

Edit the layers under `schema/` — one file per logical surface, assembled in
filename order by `scripts/assemble-schema.mjs` into the generated single-file
`generated/commerce-protocol.graphql` (exported at the package path
`./commerce-protocol.graphql` for consumers), which is generated and never
edited. The custom
directives preserve the patterns, bounds, maps, open-object policy,
omission/nullability distinction, and conditional invariants that plain
GraphQL SDL cannot express.

`scripts/build-json-schemas.mjs` compiles the SDL into the modular files under
`generated/schemas/`; `scripts/build-bundle.mjs` then creates the offline
bundle. `scripts/build-lifecycle-vectors.mjs` writes only to
`generated/vectors/`, and `scripts/build-operations.mjs` compiles the Query and
Mutation surface into `generated/bindings/`, `generated/openapi/`, and
`generated/vectors/operations.json`. Every file under `generated/` is committed
for consumers that should not need GraphQL tooling, but is never edited
directly. `bun run test` byte-compares every generated artifact and rejects
drift.

`src/index.mjs` reads the generated runtime artifacts. Never restate a contract
value in code or prose that could drift from the SDL. If runtime code needs an
event-type list, read it from
`commerceEventSchema.properties.eventType.examples` — the space is open, so the
schema documents the known values rather than closing the set.
A second hand-maintained list is the defect this rule exists to prevent.

Do not add this SDL to `packages/gql/schema-files.mjs` or generate client SDK
types from it. `packages/gql` owns the client purchase API and its executable
Query, Mutation, and Subscription surface. This package independently owns the
server-to-server commerce contract; its own Query and Mutation types are
operation containers for the portable server surface, compiled into the REST
and GraphQL bindings and nothing else. A Subscription root stays forbidden —
the compiler rejects one — because the operation surface is bounded
request/response, never a stream a shipped app could hold open.

## Never add a central dependency

This specification must stay implementable and verifiable with no request to
anything the OpenIAP project operates. That rules out: an issued identifier or
credential in any schema; a registry lookup; a hosted validation or conformance
service; telemetry of any kind; and a schema `$ref` that resolves off the local
document.

The last one is subtle and already bit us: a relative `$ref` resolves against
the absolute `$id`, so the modular schemas alone would have sent a validator to
`openiap.dev`. `generated/schemas/commerce-protocol.bundle.schema.json` exists
to close that and is generated from the canonical SDL. Edit the SDL, never the
bundle or modular outputs.

`test/decentralization.test.mjs` guards this section. Adding a rule here without
a test there means the rule is decoration.

## This package specifies; it does not implement

Nothing here may import a backend, a database client, or IAPKit. The published
runtime has no dependencies and must keep none — the GraphQL parser is a
development-only compiler dependency. An implementation in Go or Rust gets the
same generated artifacts as a TypeScript one.

`src/index.mjs` is a convenience binding over the schemas. It is not privileged.

`conformance/` is verification tooling, not a backend: the runner drives any
provider through the generated vectors via an injected `fetch`, and the mock
provider exists to prove the runner needs no IAPKit code. Neither may import a
backend, and the runner takes its JSON Schema validator by injection so the
published runtime keeps zero dependencies.

## Changing the contract

Every change answers one question first: **is this MAJOR or MINOR?** The table
in `SPEC.md` §12 decides it.

A MINOR change requires:

1. The SDL edit, in the owning `schema/` layer.
2. `bun run build` to regenerate JSON Schema artifacts.
3. An example exercising it, added to `examples/`.
4. A test in `test/schemas.test.mjs` proving both that the valid shape passes and
   that the invalid shape fails. A rule with no rejection test is not enforced.
   An operation or binding change proves itself in `test/operations.test.mjs`
   instead, including a compiler rejection for a new @operation rule.
5. The matching prose in `SPEC.md`. `test/operations.test.mjs` pins §3, §6.1,
   and §8 to the generated manifest, so prose and contract cannot drift apart.

A MAJOR change additionally requires a migration note in `SPEC.md` stating what
breaks and what a consumer pinned to the previous major should do.

## Do not specify what is not implemented

A capability may enter the specification only when a real implementation emits
it and a test proves it. `SPEC.md` §14 exists to hold the rest: an honestly
listed gap is useful, a specified-but-absent feature is a lie a consumer will
build against.

## The deployed wire format constrains us

Event schema version 1.0 is deployed and its payload shape is published. A
change to an existing member is a live break for receivers already decoding it,
including receivers this repository cannot see.

`SubscriptionState` is PascalCase while event types are lowercase-dotted. That
inconsistency is inherited, recorded here, and stays until a major
version. Do not "fix" it in place.

## Keeping IAPKit honest

`packages/kit/convex/commerce/spec.conformance.test.ts` validates payloads that
IAPKit actually builds against the schemas published here, and compares the two
vocabularies directly. It fails when either side drifts.

That test belongs to kit, not to this package: the specification does not depend
on its implementation. When a spec change makes it fail, the correct fix is
usually in kit — unless the spec change was wrong.

## Verification

```bash
bun run test                                       # from specs/openiap-kit
cd ../../packages/kit && npx vitest run convex/commerce/  # the conformance proof
```
