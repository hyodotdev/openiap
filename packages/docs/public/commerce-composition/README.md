# Compose services and inspect the boundary

Run the same app-backend client against two separately implemented fixture
providers, and send both providers' events to the same receiver implementation.
Only connection configuration changes. The runner records the results and source
hashes, and fails when a compared outcome differs.

With Bun 1.3.13 and Node.js 24 / npm installed, run from the repository root
(or the extracted source archive):

```sh
npm ci --ignore-scripts
bun composition/run.mjs
bun composition/run.mjs --record composition-report.json
```

No environment variables, `.env` file, store accounts, or IAPKit credentials are
required. The runner creates its fixture credentials, webhook keys, temporary
databases, and local HTTP ports, then cleans up after itself. Installing
dependencies needs registry access; the composition run uses loopback HTTP only.

The seven-step dashboard, including account deletion, remains available through `npm start` at
`http://127.0.0.1:5181`. Set `COMMERCE_LAB_PORT` only to change that port.

## Follow the code

| Part                  | Source                            | Responsibility                                                                                       |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| App backend           | `composition/commerce-client.mjs` | Validate calls, verify evidence, bind to the authenticated user, read access                         |
| Host/paywall callback | `composition/purchase-flow.mjs`   | Purchase → backend fulfillment → finish; display pending, canceled, failed, or fulfilled             |
| Provider A            | `provider.mjs`                    | Existing SQLite purchase and ownership implementation                                                |
| Provider B            | `composition/memory-provider.mjs` | Separate Map-based handlers and event signer; shares contract metadata, no Provider A business logic |
| Event consumer        | `webhooks.mjs`                    | Authenticate raw bytes and persist one inbox effect per event                                        |
| Reproduction          | `composition/run.mjs`             | Start isolated HTTP listeners, run both configurations, compare results and failure cases            |

The app backend holds the server credential and selects `userId` from its own
authenticated session. The host adapter receives a fulfillment callback; never
ship `commerce-client.mjs` or its credential to an app. Real SDK pending results
resume through the app's purchase-update listener. This fixture exercises the
callback boundary, not a particular paywall SDK or mobile purchase runtime.

## What the run demonstrates

Both configurations save verification without granting access, bind only once,
reject another owner, preserve access after cancellation, and close it exactly
at expiry even before a notification. Both emit signed events; a 503 retries,
redelivery has one inbox effect, altered bodies and another emitter's key fail,
and an optional `extensions["partner.segment"]` string survives storage without editing the
consumer. The consumer also rejects a malformed successful API response.

Each emitter/project has its own configured endpoint, secret, and inbox
database in this baseline run. For the IAPKit replacement run, `startAppBackend`
keeps one application endpoint and one receiver alive. Configure that receiver
with named emitters and separate signing keys bound to each project ID; equal
event IDs from different providers then remain distinct in the same inbox.
This does not identify duplicate real-world facts across a provider cutover.

## Make and verify one change

Change the `extensions["partner.segment"]` string in `composition/run.mjs`, rerun
the command, and inspect its storage check. The purchase flow, client, and
receiver modules stay the same. For a provider implementation
change, retain the expected access results and rerun against both providers;
do not edit the expected outcome merely to make an incompatible result pass.

`bun composition/export.mjs <output-directory>` also runs a negative control
inside a temporary copy: changing the SQLite access deadline from `<` to `<=`
must fail the deadline check. It leaves the original source unchanged.

## Bring another implementation

Use `createCommerceClient({ baseUrl, credential })` for a disposable test account.
Supply a provider-owned setup/transition adapter in the runner for its fixture
purchase, cancellation, and expiry; those controls are not protocol operations.
Keep the client, receiver, and expected outcomes unchanged. Record the exact
revision, configuration fields changed (never secret values), commands, result
report, and any required code changes. A changed adapter is evidence of work
needed, not a reason to hide the change.

Run the published protocol conformance runner separately for every claimed
profile/binding. This demo advertises no complete profiles. External teams can
publish their own report without an OpenIAP account or hosted checker.

## Scope

The services communicate over real loopback HTTP in one Bun process. Provider A
uses SQLite; Provider B keeps state in memory. Store evidence, users, clock, and
purchase callbacks are fixtures. Both implementations were authored within this
project: this is reproducible implementation evidence, not independent company
validation. It proves neither real store verification nor production reliability.

Both providers start empty. Moving ownership/history, rotating credentials,
cutover overlap, process-crash recovery, and a real SDK purchase need separate
tests. The baseline receiver stores events; it does not compute a revenue ledger
or grant access from webhook arrival.
