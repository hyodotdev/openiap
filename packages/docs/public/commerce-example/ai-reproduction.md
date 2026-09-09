# A new project built from the AI brief

A separate AI, with no conversation history, received the implementation page’s
brief with the product and service placeholders filled in. It started in an
empty directory and built **Field Notes**, a browser app with a local commerce
backend and signed event receiver. It used the public example and the installed
contract, choosing Node.js 24 and SQLite. The example itself uses Bun.

The AI produced new implementation source; it did not run the existing example
as the completed product. Another AI reviewed the result, tested the browser,
and repeated installation and checks in a clean source-only copy.

## What passed

- All 13 local test groups, including 100 published lifecycle cases, signatures,
  ownership isolation, retry/deduplication, rollback and orderly recovery.
- 29 separate HTTP assertions: verification alone grants no access; binding
  selects the owner; Bob cannot claim Alice’s purchase; canceling renewal keeps
  access; expiry closes access and the protected note exactly at the deadline.
- Clean `npm ci --ignore-scripts` and `npm test`, without installed dependencies,
  runtime databases, output directories or application environment variables.
- Reload checks after purchase, cancellation and expiry, plus a mobile layout
  check. The parent reviewer also exercised purchase, ownership rejection,
  cancellation and expiry in the browser.
- All 46 portable conformance cases, with every earlier case retained.
- Account erasure: transaction rollback, in-flight delivery, other-user isolation,
  session revocation, recipient cleanup and retry/restart behavior.
- A deliberate `<` → `<=` expiry regression made three related test groups fail.
  The disposable copy was restored and its source hashes checked afterward.

## What the review caught

The first clean replay failed three test groups because output directories had
been created during development but were not created by the test command. A
reload also displayed a free-plan banner for an active Premium account. Both
were fixed and the same checks were repeated. The builder’s first portable
runner attempt additionally caught an input-validation ordering error, which
was corrected. Failed reports remain in the source package.

The completion review then implemented account erasure and finished the fixture
profile declarations. A reduced-profile declaration would have skipped earlier
cases, so the final tests also require all original case IDs to remain covered.
The current brief now requires these completion gates. The original prompt is
preserved in the record rather than rewritten to match the later instructions.

This was an AI implementation and review exercise, not a claim of a perfect
first attempt. No human supplied implementation fixes during the run.

## Run and inspect it

[Source and recorded evidence](ai-reproduction-source.tar.gz) ·
[Machine-readable results and exact prompt](ai-reproduction.json)

Extract the source into an empty directory. With Node.js 24 and npm installed:

```sh
npm ci --ignore-scripts
npm test
npm start
```

Open `http://127.0.0.1:5197`. Start as Alice, buy Premium, switch to Bob and try
Alice’s purchase, then return to Alice to cancel renewal and advance to expiry.
Open Account deletion to remove her provider identity and the app’s event copies.
`README.md` explains how to start another fresh database without deleting a run.
`REPORT.md` and `evidence/` contain source revisions, commands, failures and fixes.

## Scope

The published portable conformance runner reports **46/46 passing**, exit code 0,
for all four profiles and REST in the local fixture environment. The descriptor
says `fixtureOnly: true` and explains fixture-only support in its store notes.
It does not establish a live Google integration. Notification, reconciliation,
and revenue integrations remain undeclared as implemented.

Purchases, users and time are fictional. Real store validation, real login,
tenant isolation, public HTTPS operations and crash recovery were not tested.
The exercise uses one host and separate AI conversation contexts; it is not
independent company validation. Provider erasure covers its own records; the
app demonstrates separate cleanup of its received copies.

The documentation was also read as two imagined first-time readers: an app
owner and an event-service builder. The revised walkthrough follows a purchase one step at a time,
explains each term where it is used, and separates reference pages from the
reading path. The build guide orders service choices, the expandable AI brief,
and customer checks. Twelve routes were inspected on desktop and mobile. This is an AI reader simulation, not a study with human users.
