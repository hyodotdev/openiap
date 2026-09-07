# Implementation review log

Each checkpoint was run before the next feature was added. The source archives
and patches record those actual code versions, without creating Git commits.

## Checkpoint 1: premature discovery response

**Observed:** the capabilities request returned HTTP 500. The full failing test
output is in `01-contract-first-attempt.txt`.

**Cause:** published package 0.1.0 (protocol 1.0) requires at least one entry in `eventTypes`.
The new backend could not emit any event yet, so its empty list was invalid.

**Initial workaround:** the recorded checkpoints 1–3 return
`UNSUPPORTED_PROFILE`. The external review correctly identified that this is
not allowed for core discovery. These snapshots are unfinished scaffolding,
not conformant providers. A real descriptor becomes available in checkpoint 4,
when the backend can emit events. The original source and screenshots remain
unchanged so the record does not hide the mistake.

## Checkpoint 4: long response lists hid the last result

**Observed:** the checkpoint 2 and 3 screenshots showed a scrolling raw-response
panel. The last request was below the visible area, making negative and
ownership-conflict results easy to miss.

**Correction:** each request now has its own disclosure row. All operation names
and HTTP statuses remain visible; readers open only the response they need.

**Recheck:** capture opens and closes the last response and checks its body is
visible, then checks desktop and mobile overflow. Its first test incorrectly
assumed the row was initially closed (`null !== ''` at `capture.mjs:59`). The
test now reads the initial state before exercising both transitions. That
browser failure appeared in the interactive tool session, but its output was
not saved to a file. The two `attempt-*.txt` files record the passing backend
verifier, not the complete browser attempt. Later capture code saves failures.

Checkpoints 1–3 call `verifyLab()` inside capture. Their attempt metadata calls
that suite `npm test`, its equivalent standalone entry point; those JSON files
are structured verification reports, not shell transcripts. Later checkpoints
name the actual capture command and verifier separately.

## External CLI review: final revision

Fable 5.1 at max effort reviewed both repositories read-only. The revised final
checkpoint adds `entitlement.granted` on the first active binding and tests that
outbox failure rolls ownership back. Earlier checkpoints omitted this event.
A premature expiry now raises a reconciliation error without consuming its id.
Overlapping HTTP requests test ownership outcomes, not multi-process locking.

The reviewer also found that global path replacement corrupted the first code
patch. All historical patches were regenerated from the unchanged source
archives with header-only normalization and hash comparison. `verification.json`
records applying the complete patch chain from an empty directory, extracting
every archive, and running `npm ci` and `npm test` outside both repositories.
These are new verification results; they are not backdated original attempts.
The local path prefix in the first failure log was redacted.

`06-recover-reviewed` preserves the corrected final source and new captures.
Its patch applies after the original `06-recover`, retained as review history.
The build brief exported to the site comes from the selected final archive,
and export refuses source drift or missing archive verification.

## Second external review

The next revision fixes late-expiry revocation and preserves the original store
occurrence when binding later. It preserves consecutive capture failures and
redacts local account paths. The build brief now handles package 0.1.0 without
`DESIGN.md`; architecture is linked separately from the normative contract.

Commerce Lab was an earlier internal prototype replaced by this repository.
The original checkpoints 1–6 contain a build-brief link to its removed kit path.
That link is historical; use the current root `BUILD.md` for new integrations.
Historical tooling may require Node.js as well as Bun. Current backend scripts
use Bun; recording tooling also needs npm, Git, tar, and Chrome.

`06-recover-reviewed-2` contains the second review fixes and a ready event
receiver for an existing backend. `consumer-run.json` records its real HTTP
checks separately and identifies its source hashes. The earlier reviewed
revision is retained, so every correction remains traceable.

## Product integration revision

The final revision adds a role-specific integration brief and an Apple/Google
request mapper for the app backend. The mapper uses the installed verification
schema and drops client identity claims. Its checks cover malformed evidence
and stores that require an additional adapter. The receiver remains independently
runnable. These are local connection checks, not a mobile paywall or store
sandbox test. Business roles do not introduce new protocol profiles.

The first mapper put store members inside an extra `evidence` object. The
installed schema rejected it during `npm test`; the captured failure is
[bridge-first-attempt.txt](06-recover-reviewed-3/bridge-first-attempt.txt). Moving
`apple`/`google` to the verification input's top level fixed the same check.
The final archive and its npm test log record the corrected source.

## Third CLI review

The ready receiver's loopback Host check refused a reverse proxy's public Host
header. The saved [proxy failure](06-recover-reviewed-4/proxy-first-attempt.txt)
reproduces that case. Signature authentication now protects the receiver
independently of Host, and the HTTP demo sends the public Host on health, valid,
duplicate, and tampered requests. The report records the observed duplicate
response. Equal-time cancellation and expiry now retain both transitions and
revoke access once.

The integration brief now contains absolute setup/source URLs. Modern Yarn uses
its node-modules linker. Capture verification skips unfinished directories while
retaining their failure logs; new checks cover completing one later. Current
console labels and fixture project IDs use Commerce Protocol Example, while
historical sources retain their original names.

## Publication preparation

`06-recover-reviewed-5` preserves the standalone setup and AI briefs used for
the first public commit. The README now leads with clone/run commands, a real
screenshot, expected outcomes, and role-specific entry points. Receiver and
recording guides live in this repository; setup no longer depends on an
unpublished documentation-site download. CI checks the current runtime,
recording tools, every historical archive, and the final documentation export.

This revision records local documentation and reproducibility checks, without
adding an external review result. Earlier source checkpoints and failures remain
available.

## Linux CI archive correction

The [first GitHub run](https://github.com/hyodotdev/openiap-commerce-protocol-example/actions/runs/34142131934)
passed runtime and tooling tests, then failed the first archive hash comparison.
macOS had added AppleDouble metadata files that Linux extracted as ordinary files.
`06-recover-reviewed-6` excludes that metadata when reading earlier archives and
disables it for new captures. The regression test compares extracted source hashes
with the original files. Historical archives and their source hashes are unchanged.

## Final CLI review

The cancellation-after-expiry check used a timestamp older than the expiry
observation, so it exercised stale ordering instead of the expired-state guard.
`06-recover-reviewed-7` uses the expiry timestamp and repeats the check. The
provider behavior is unchanged. The CI export guard now checks committed
evidence before archive verification regenerates its report.

## Webhook byte authentication

The Codex CLI review reproduced an exact-byte contract violation: decoding the
body before signature verification accepted an inserted UTF-8 BOM with the
original signature. A second local probe also replaced a Unicode character with
malformed UTF-8. Both requests returned 200 and reached the inbox.

The saved local probe ran the same two rejection cases now in `verify.mjs`
against the reviewed-7 receiver, then repeated them against reviewed-8.

`06-recover-reviewed-8` authenticates the original body bytes before decoding.
The [original probe](06-recover-reviewed-8/byte-auth-before.txt) and
[repeated probe](06-recover-reviewed-8/byte-auth-after.txt) show both requests
changing from 200 to 401, with no inbox insertion after the fix. Regression
checks also reject correctly signed malformed UTF-8 and accept correctly signed
Unicode and BOM bodies. Earlier source archives remain unchanged.
