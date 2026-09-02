# OpenIAP Commerce Protocol

A vendor-neutral specification for the **server side** of in-app purchases.

OpenIAP normalizes the client-side purchase API across stores. This normalizes
the server side: one commerce vocabulary, one portable operation surface with
REST and GraphQL bindings, one event envelope, one webhook contract — so a
backend or an analytics pipeline can verify purchases, read entitlements, and
handle renewals, refunds, and entitlement changes from Apple, Google, Meta
Horizon, and Amazon without parsing any store-native payload, and can replace
the provider behind those calls without rewriting the integration.

Nothing in this contract routes through infrastructure the OpenIAP project
operates. Two parties exchange events directly, using a secret they share
between themselves, and validate offline. The project distributes the contract;
it does not sit in the path of anyone's commerce.

**[Read the specification →](./SPEC.md)**

## Reviewing a change

Review only the authored surfaces, in this order:

1. [`SPEC.md`](./SPEC.md) — behavior, operations, bindings, lifecycle,
   transport, and compatibility.
2. [`schema/`](./schema/) — the authored contract layers: wire structure, the
   operation surface, and validation directives.
   [`generated/commerce-protocol.graphql`](./generated/commerce-protocol.graphql)
   is their generated single-file assembly (also exported at the package path
   `openiap-commerce-protocol/commerce-protocol.graphql`).
3. [`examples/`](./examples/) — representative documents and store mappings.
4. [`vectors/signatures.json`](./vectors/signatures.json) — hand-authored
   cryptographic truth cases.
5. [`conformance/`](./conformance/) — the portable runner and its independent
   mock provider.

Ignore `generated/` during a human review. It is compiler output, kept only for
validators and drift checks.

## What ships here

| Path                      | Contents                                                                    |
| ------------------------- | --------------------------------------------------------------------------- |
| `schema/`                 | Authored type, operation, and validation contract layers — edit these       |
| `SPEC.md`                 | Normative meaning, operations, bindings, transport, and compatibility rules |
| `generated/`              | Compiler output: schemas, binding manifests, OpenAPI, and vectors           |
| `examples/`               | Canonical documents that must validate                                      |
| `vectors/signatures.json` | Signature vectors every implementation must reproduce                       |
| `conformance/`            | Portable conformance runner plus an IAPKit-free mock provider               |
| `src/index.mjs`           | Runtime access to the generated schemas and their derived constants         |

The `schema/` layers govern wire structure. Their custom directives retain
patterns, bounds, maps, open objects, and conditional rules that standard SDL
cannot express. `bun run build` compiles that source into the JSON Schemas a Go,
Python, or other backend executes against incoming webhook bodies. `SPEC.md`
governs meaning and transport.

Do not add this SDL to `packages/gql/schema-files.mjs`. `packages/gql` owns the
client purchase API and the SDK types compiled from it; this file independently
owns the server-to-server commerce contract. Its Query and Mutation types are
the portable server operation surface — compiled into the REST and GraphQL
bindings, never into client SDK types — and it defines no Subscription root:
the operation surface is bounded request/response by rule.

## Receiving events

An endpoint you register receives one JSON event per request. Verify the
signature — `SPEC.md` §9.4.2 states the rule and `vectors/signatures.json` pins
it — then handle the event; `SPEC.md` §9.5 walks a consumer end to end.

Three rules that are easy to get wrong, all specified in detail in `SPEC.md`:

- **Sign the bytes you received.** Re-serializing the JSON before verifying
  changes key order and whitespace, and the signature will not match.
- **Read `subscription.active`, not `state`.** A canceled subscription keeps
  access until its paid period ends — `subscription.canceled` means auto-renew
  was turned off, not that access was revoked.
- **A missing amount means unknown.** It never means zero.

## Calling a provider

Every conforming provider serves the same six operations — verify a purchase,
read status and entitlements, bind a purchase to your own user id, erase a
user, and read the provider's capability descriptor — over REST
(`/commerce/v1/...`, described by the generated OpenAPI document) or GraphQL
(the generated schema projection), with one shared error-code space. `SPEC.md`
§4–§8 define the surface; a backend written against it keeps working when the
provider behind it changes.

## Certifying a provider

```js
import Ajv from "ajv/dist/2020.js";
import {
  createRestAdapter,
  createGraphqlAdapter,
  runConformance,
} from "openiap-commerce-protocol/conformance";

const report = await runConformance({
  adapters: [
    createRestAdapter({ baseUrl, fetch, credentials }),
    createGraphqlAdapter({ url: graphqlUrl, fetch, credentials }),
  ],
  Ajv,
  // The same role-to-credential map the adapters use — required, so the
  // runner can reject an error message that echoes a credential.
  credentials,
  // Required when your capability descriptor declares the events profile:
  // your outbound webhook implementation, driven through SPEC.md §9's
  // signing, verification, delivery, response, entitlement, and emission
  // vectors.
  eventsAdapter,
});
```

The runner is offline, needs no hosted service, and imports no implementation;
supply the Ajv 2020 class yourself, since the published runtime carries zero
dependencies. It certifies the transport contract — never real store receipt
validity (`SPEC.md` §11.3). A provider that declares the `events` profile must
also pass an `eventsAdapter` covering the full `EventsAdapter` surface
(`conformance/index.d.ts`); a signing-only adapter fails.

## Validating

```bash
bun install
bun run test
```

The suite recompiles every schema and binding artifact, validates every
example, checks that each rejection case is actually rejected, reproduces
every signature vector using an implementation written only from `SPEC.md`,
and certifies an independent mock provider on both bindings.

## Relationship to the rest of OpenIAP

```
       OpenIAP Commerce Protocol       ← this package: the server-side contract
                     │
      ┌──────────────┼──────────────┐
      │              │              │
   IAPKit      vendor backend   custom backend
 (reference)
      │              │              │
      └──────────────┼──────────────┘
                     ↓
        normalized commerce events
                     ↓
      ┌──────────────┼──────────────┐
      │              │              │
    SaaS        analytics     enterprise
```

No box in that diagram is required to be operated by the OpenIAP project. An
adopter may self-host IAPKit, use a hosted conforming provider, or implement the
contract in the backend they already have — and a consumer supports _the
specification_, so any of the three can feed it.

## Status

Version 0.1.0, specifying protocol version 1.0. The event vocabulary,
envelope, webhook contract, operation surface, REST and GraphQL bindings, and
portable conformance runner are implemented and tested. `SPEC.md` §14 lists
what is deliberately not in this version.

## License

MIT
