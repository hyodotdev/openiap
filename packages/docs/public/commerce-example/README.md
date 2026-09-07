# From contract to a working backend

Give AI a small job, run the result, and inspect what changed. If a check or the
screen is wrong, fix it and repeat that check before adding the next feature.

This example grew through six executable source checkpoints. Each folder holds
its AI task, source hashes, actual HTTP results, and verification in `run.json`;
`source.tar.gz` runs independently and `changes.patch` shows the added code.

| Step                                                   | Ask AI to build                                            | What the run demonstrates                                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [1. Contract](01-contract/run.json)                    | Load the published schemas and start a local server        | Inputs validate; storage is empty; discovery is unfinished and returns an error not permitted for the core operation.                                 |
| [2. Verification](02-verify/run.json)                  | Recognize fixture evidence and persist the purchase        | A purchase exists, but nobody has access yet. Bad evidence and an upstream outage produce different results.                                          |
| [3. Ownership](03-bind/run.json)                       | Bind through the backend and read access                   | Alice gains Premium. Verification credentials cannot bind, and Bob cannot take Alice's purchase.                                                      |
| [4. Cancellation](04-cancel/run.json)                  | Stop renewal and queue the event atomically                | Alice keeps paid access. Discovery can now advertise an event the implementation actually emits.                                                      |
| [5. Delivery](05-deliver/run.json)                     | Sign, retry, and deduplicate                               | A failed delivery retries after reopening storage. A repeated delivery has one inbox effect.                                                          |
| [6. Reviewed recovery](06-recover-reviewed-7/run.json) | Enforce expiry, check persistence, and map client evidence | The reviewed final version adds atomic binding grants, rejects conflicting expiry, closes access at the deadline, and preserves storage on reopening. |

## What review changed

The first discovery response failed schema validation. The early workaround also violated the core discovery contract, as the later
external review identified. The original unfinished checkpoints are preserved. The response
viewer also hid the end of long request lists, so we changed it to individual
disclosures and verified opening and closing the last response on desktop and
mobile in the reviewed capture. [REVIEW.md](REVIEW.md) records the failure, correction, and recheck.

## Try a checkpoint

Extract that step's `source.tar.gz` into an empty folder. With Bun installed:

```sh
npm install # or pnpm install, yarn install, bun install
npm test
npm start
```

Open http://127.0.0.1:5181. Earlier archives contain fewer routes and no later
webhook worker; the final server's demo buttons replay its completed flow.

The task descriptions record the implementation intent. These are not model
transcripts or recordings of an AI editor typing. Code was adapted incrementally
from an earlier internal prototype replaced by this example. No live store purchase or
production-provider conformance is demonstrated.

The original [step 6](06-recover/run.json) is retained before the reviewed final
revision. Apply patches in folder order, including that intermediate version.
[verification.json](verification.json) records a fresh extraction, source hash
comparison, patch application, and npm test for every archived revision.

The [ready receiver report](consumer-run.json) records standalone ingestion of
fictional lifecycle events, deduplicated replays, rejected tampering, and
reopened storage. Run `npm run demo:consumer` in the latest source to reproduce it.
