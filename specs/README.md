# OpenIAP specifications

OpenIAP keeps its portable contracts together here. These directories may
publish installable artifacts, but they are not deployed services and never
own production credentials, data, or migrations.

| Directory                                    | Contract                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`client/`](./client/)                       | Client purchase API and generated TypeScript, Swift, Kotlin, Dart, GDScript, and C# types |
| [`commerce-protocol/`](./commerce-protocol/) | Server operations, REST and GraphQL bindings, lifecycle events, webhooks, and conformance |

The two contracts share the OpenIAP namespace, not a generation pipeline.
Client SDK generation reads only `client/src/*.graphql`. Commerce artifacts
are compiled only from `commerce-protocol/schema/`, with generated output kept
under `commerce-protocol/generated/`.

Deployable implementations remain under `packages/`. In particular,
[`packages/kit`](../../packages/kit/) implements the Commerce Protocol and is
not part of this specification tree.
