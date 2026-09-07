# Build a purchase-to-access backend with AI

Implement the OpenIAP Commerce Protocol in my repository. Start with one working
purchase flow and prove each milestone before adding the next.

## Read these first

Use my project's package manager to install `openiap-commerce-protocol`.
For example, with npm:

```sh
npm install openiap-commerce-protocol
```

The equivalent commands are `pnpm add`, `yarn add`, or `bun add` followed by the
same package name. Read these files from the installed package directory
(normally `node_modules/openiap-commerce-protocol/`):

- `SPEC.md`: normative behavior, authorization, lifecycle, and delivery rules.
- `generated/openapi/commerce-protocol.openapi.json`: REST request/response API.
- `generated/bindings/http-binding.json`: operations, roles, and schema pointers.
- `generated/schemas/commerce-protocol.bundle.schema.json`: offline validation.
- `conformance/` and `vectors/`: portable checks and signature fixtures.

For architecture, use the [implementation guide](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/main/docs/build/README.md)
and [whitepaper](https://openiap.dev/commerce-protocol-rationale.pdf). Package 0.1.0
does not include `DESIGN.md`; read that optional file only when it exists in
your installed version.

The package supplies the contract and test artifacts, not a running backend.
Implement the backend in my project. Do not require an OpenIAP or IAPKit checkout,
and do not invent request fields, response shapes, role rules, or enum values.
Follow my repository's instructions. Keep work uncommitted for review.

## Start with a reviewable local result

Use the stack already in my repository. If this is an empty project, choose a
small HTTP/JSON backend and SQLite; the protocol does not require a specific
language or runtime. Use an explicitly fictional fixture store and a controlled
clock first. No real purchases, production credentials, or cloud resources.

Build these milestones in order:

1. **Contract:** serve capabilities and validate requests and responses against
   the generated artifacts. Start with an empty persistent database. Advertise
   only demonstrated support; do not claim partially implemented profiles.
   Package 0.1.0 (protocol 1.0) requires a nonempty event list. Until an event emitter exists,
   treat this as unfinished scaffolding, not a provider ready for integration.
   Core discovery cannot use `UNSUPPORTED_PROFILE` as a valid fallback.
2. **Verification:** accept known fixture evidence, reject invalid evidence, and
   distinguish an upstream outage from a negative verdict. Persist a purchase
   without binding a user or granting account access.
3. **Ownership and access:** bind through an authenticated server role. Obtain
   the user identity from the backend session and its ownership policy. Refuse
   cross-user transfer, including concurrent requests. Return tokenless status
   and entitlement responses; verification credentials cannot enumerate users.
4. **Lifecycle:** process cancellation and expiry. Cancellation preserves the
   remaining paid period. Access closes at the expiry boundary even before an
   expiry notification arrives. Store state, observation deduplication, and
   outbound event bytes in one transaction. Prove rollback under a write failure.
5. **Delivery:** sign the exact persisted bytes, authenticate raw bytes at the
   receiver, and insert into a durable inbox before acknowledging. Demonstrate
   503 → retry → success, lost-ack redelivery, tamper rejection, and a bounded
   dead-letter path. Retry with unchanged event/body/delivery identity and a
   fresh signature. Mark loopback transport as a local test exception; a real
   events profile requires the public HTTPS destination protections in the spec.
6. **Recovery:** reopen the databases with pending deliveries, resume processing,
   and prove that neither ownership nor receiver deduplication disappears.

After each milestone, run it. Show the command, actual API result, storage
change, and passing assertions. Capture the working screen. Do not manufacture
logs, screenshots, conformance counts, or claims about capabilities not tested.

## Deliver

- A runnable local backend and small inspection UI.
- One command that verifies the demonstrated flow and exits nonzero on failure.
- A short visual walkthrough, with real captured results for each milestone.
- The exact scope and remaining work, including real store validation,
  authentication, erasure, multi-tenant isolation, public HTTPS delivery,
  operations, and full profile conformance. Keep the main explanation short;
  link the specification for details.

## Then extend toward a production provider

Ask me which real store, backend identity system, and deployment environment to
integrate before using credentials or external services. Implement the remaining
operations of each chosen profile, including erasure for `accountLifecycle`.
Run the portable conformance runner for every advertised binding and profile;
also run real store sandbox, recovery, isolation, and load tests. Treat IAPKit as
an implementation example, never as a replacement for the protocol's contract.

Recorded local example and reproduction instructions:
https://github.com/hyodotdev/openiap-commerce-protocol-example

## Review each visible result

Inspect the running UI and the actual response and storage changes after every
milestone. Keep a short record of the issue, the code or design correction, and
the result of repeating the same check. Keep failed attempts as evidence. Do
not invent failures for the story or mark a milestone complete from a screenshot
alone. Save each runnable source checkpoint before adding the next feature.
