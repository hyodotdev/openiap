# Following the guide in a separate existing app

The guide was followed with **Studio Notes**, a small existing-project fixture
created for this reader simulation. It already had a paywall, a fixed experiment
variant, host purchase callbacks, and a configured fixture backend. Its purchase
button was not connected. This is an AI simulation, not a human user study or a
production app integration.

## What happened at each step

| Step | Action | Observed result |
| --- | --- | --- |
| CLI | Run `npx --yes @hyodotdev/openiap init --role experience` in the app | A brief was printed. All project files stayed unchanged; the button still showed “Not connected.” |
| AI handoff | Combine the complete CLI output with the guide's paywall request | The AI read the project, public integration guide, published contract, and downloaded reference. |
| Implementation | Connect `app.mjs` to the host callbacks using the reference's `purchase-flow.mjs` | The existing HTML/CSS, experiment selection, and `host.mjs` stayed byte-for-byte unchanged. |
| Reference verification | `npm ci`, then `npm test` in the extracted example | 229 checks and 5 tests passed. |
| Project verification | `npm ci`, then `npm test` in a clean extraction of Studio Notes | Its own running HTTP gateway and adapter passed 31 assertions. |
| Negative control | Remove the grant check in a disposable copy; rerun the app test | It failed: denied access incorrectly returned `fulfilled`. The tested result retains the guard. |
| Try the app | Click through all five outcomes on the running paywall | Only the successful purchase opened Premium and called finish. |

The test also exercised a temporary finish failure and retry, with only one
stored purchase. The store callbacks are fixtures; this does not test a real
SDK's pending-purchase listener or store acknowledgement.

## What the reader sees

| Selected result | Paywall result | Current access | Finish calls |
| --- | --- | --- | --- |
| Pending | `pending` | Locked | 0 |
| Canceled | `canceled` | Locked | 0 |
| Store failure | `failed` | Locked | 0 |
| Backend denies access | `failed` | Locked | 0 |
| Successful purchase | `fulfilled` | Premium open | 1 |

A later canceled attempt on mobile preserved the already-paid access and kept
finish calls at 1. Neither desktop (1280px) nor mobile (390px) overflowed
horizontally.

[Before connecting](./reader-before.png) · [After connecting](./reader-result.png)
· [Mobile result](./reader-mobile.png)

## Reproduce the finished result

Use Bun 1.3.13 and Node.js/npm. Create one directory with these two sibling folders:

- `reference`: extract the [verified example source](./experience-source.tar.gz).
- `my-paywall`: extract the [finished app source](./reader-result.tar.gz).

Run in `reference`:

```sh
npm ci
npm test
```

Then run in `my-paywall`:

```sh
npm ci
npm test
```

The app's test starts isolated HTTP services and stops them afterward. For the
visible app, keep this command running in `reference`:

```sh
COMMERCE_EXPERIENCE_PORT=5194 npm run demo:experience
```

In another terminal, run `npm start` in `my-paywall`. Open
`http://127.0.0.1:5195`, select an outcome, and click **Get Premium**. Restart both
commands for fresh state. The paywall uses the reference only as its configured
test backend; a production app uses its chosen authenticated backend.

## Inspect the change and its limits

[Starter source](./reader-starter.tar.gz) · [Finished source](./reader-result.tar.gz)
· [Inputs, complete prompt, commands, failed control, and file hashes](./reader-followup.json)

Changed files are `app.mjs`, the package metadata/lockfile, and a port option in
`server.mjs`. Added files are the reference's `purchase-flow.mjs` and the app's
own `purchase.test.mjs`. The published scoped contract was installed as a
development reference; the browser adapter has no protocol runtime dependency.

The same AI prepared the starter and followed the guide in this session. It
used the local documentation preview plus public references and registry
packages; this is not an independent model trial or a claim that one prompt
always succeeds. The finished archive was separately extracted and tested.
The exact paywall request was retained while the surrounding reader guidance
was clarified afterward.

Only the **experience** role was implemented in this separate app. No new
purchase provider or analytics service was built. IAPKit's linked replacement
checks were reviewed for the selected-product access condition; IAPKit was not
run again. The reference's earlier backend/receiver checks remain separate.
Store responses and login are fictional; HTTP and SQLite execute locally.

The current reference bundle has a documentation-only wording correction. Its implementation is unchanged and `npm ci` / `npm test` were rerun successfully. [Distribution hashes and rerun output](https://openiap.dev/commerce-example/experience-verification.json) record both `distributionFollowup.previousArchiveSha256` and the current `archiveSha256`; earlier input hashes remain the historical download record.
