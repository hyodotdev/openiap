# Build a purchase-to-access backend with AI

Implement the OpenIAP Commerce Protocol in my repository. Start with one working
purchase flow and prove each milestone before adding the next.

## Read these first

Use my project's package manager to install `@hyodotdev/openiap-commerce-protocol`.
For example, with npm:

```sh
npm install @hyodotdev/openiap-commerce-protocol
```

The equivalent commands are `pnpm add`, `yarn add`, or `bun add` followed by the
same package name. Read these files from the installed package directory
(normally `node_modules/@hyodotdev/openiap-commerce-protocol/`):

- `SPEC.md`: normative behavior, authorization, lifecycle, and delivery rules.
- `generated/openapi/commerce-protocol.openapi.json`: REST request/response API.
- `generated/bindings/http-binding.json`: operations, roles, and schema pointers.
- `generated/schemas/commerce-protocol.bundle.schema.json`: offline validation.
- `conformance/` and `vectors/`: portable checks and signature fixtures.

For architecture, use the [implementation guide](https://github.com/hyodotdev/openiap-commerce-protocol-example/blob/main/docs/build/README.md)
and the installed `DESIGN.md` or [whitepaper](https://openiap.dev/commerce-protocol-rationale.pdf).

The package supplies the contract and test artifacts, not a running backend.
Implement the backend in my project. Do not require an OpenIAP or IAPKit checkout,
and do not invent request fields, response shapes, role rules, or enum values.
Follow my repository's instructions. Keep work uncommitted for review.

Read this example alongside [IAPKit's service source](https://github.com/hyodotdev/openiap/tree/main/packages/kit).
The [purchase walkthrough](https://openiap.dev/commerce-protocol/getting-started)
connects each step to both implementations and their checks. Use this example
to understand the small SQLite flow; use IAPKit to study real store adapters,
project authorization, account erasure, and the GraphQL adapter. Compare the
relevant code at each milestone without making either repository a runtime
dependency of the new project.

## Start with a reviewable local result

Use the stack already in my repository. If this is an empty project, choose a
small HTTP/JSON backend and SQLite; the protocol does not require a specific
language or runtime. Use an explicitly fictional fixture store and a controlled
clock first. No real purchases, production credentials, or cloud resources.

Build these milestones in order:

1. **Contract:** serve capabilities and validate requests and responses against
   the generated artifacts. Start with an empty persistent database. Advertise
   only demonstrated support; do not claim partially implemented profiles.
   Protocol 1.0 requires a nonempty event list. Until an event emitter exists,
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
7. **Account deletion:** remove provider identity and recipient copies, retry the
   same erasure after restart, and reject stale account requests and late events.

After each milestone, run it. Show the command, actual API result, storage
change, and passing assertions. Capture the working screen. Do not manufacture
logs, screenshots, conformance counts, or claims about capabilities not tested.

## Complete the local implementation

Before calling the result complete, implement erasure for the account lifecycle:
remove the user identity from provider records and event history, preserve other
users, and prevent a late retry from restoring erased recipient data. Keep
provider erasure separate from the recipient's responsibility for delivered
copies. Exercise erasure during delivery, on repetition, and after restart.

Run the portable conformance runner for every selected profile and binding.
Do not finish with tests that expect known conformance failures. Keep every
previously exercised case in the completed run; changing declarations must not
hide a failure. Describe fixture-only capabilities explicitly, without implying
that a real store API or notification channel was connected.

Copy only source and package metadata into an empty directory. Install, test,
and start it there, without the development database or output directories.
Check the visible app after purchase, cancellation, expiry, reload, and deletion.

## Deliver

- A runnable local backend and small inspection UI.
- One command that verifies the demonstrated flow and exits nonzero on failure.
- A short visual walkthrough, with real captured results for each milestone.
- The exact scope and remaining work, including real store validation,
  real authentication, multi-tenant isolation, public HTTPS delivery, and
  operations. Include the passing local conformance report and its fixture scope. Keep the main explanation short;
  link the specification for details.

## Match the selected store

Read the store table in the [integration brief](https://openiap.dev/commerce-example/integration-brief.md) before replacing the fixture. Exercise
all evidence shapes the provider advertises. Keep the app account distinct
from the Amazon/Meta store user, and reject a claim for someone else's store
account. Recheck ownership for Amazon/Horizon access; never invent subscription
or notification support to make their flow look like Apple/Google. Prove
negative rechecks, outages, conflicting bindings, erasure, and restart.

## Then extend toward a production provider

Ask me which real store, backend identity system, and deployment environment to
integrate before using credentials or external services. Replace fictional store and session adapters with the chosen integrations.
Keep the completed profile behavior and erasure checks passing.
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
