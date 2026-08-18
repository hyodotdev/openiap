# Security Policy — packages/kit

This policy covers **`packages/kit`** of the OpenIAP monorepo — the
hosted purchase-validation and entitlement service at `kit.openiap.dev`. For security
issues in other packages (`apple`, `google`, `gql`, `docs`) or the
framework libraries under `libraries/`, see the monorepo-wide policy
or open a discussion in the relevant category.

IAPKit handles receipt verification for production apps, so we take
security issues seriously. Please do not open a public GitHub issue
for anything that looks like a vulnerability.

## Reporting a vulnerability

Email **hyo@hyo.dev** with:

- A description of the issue and its impact (what an attacker can do).
- Steps or a proof-of-concept that reproduces it. If you prefer to share a
  private repo or gist, say so and we'll coordinate.
- The IAPKit commit or deployment where you observed it, if known.

We aim to acknowledge reports within **72 hours** and to ship a fix or
mitigation within **14 days** for confirmed issues of medium severity or
higher. Maintainer is based in Asia/Seoul (UTC+9); please allow for
timezone and weekend delays — we'll keep you updated on the status
either way.

## Scope

In scope:

- The hosted service at `kit.openiap.dev` (SPA + `/api/v1/*` verification).
- The Convex functions in `packages/kit/convex/` that back that service.
- Authentication / session handling, API key issuance, project settings,
  receipt verification logic, and anything in `packages/kit/server/`.

Out of scope:

- Findings that require an attacker to already have full control of a
  maintainer's machine or Convex dashboard credentials.
- Reports that merely send raw request volume without demonstrating a bypass,
  amplification issue, or other vulnerability. IAPKit uses defense-in-depth:
  bounded key/IP/process rate limits, per-payload replay protection, request and
  field-size gates, key/IP/process verification concurrency limits, and Fly
  Proxy concurrency limits. These controls reduce impact; they do not guarantee
  that a public endpoint can absorb every volumetric DDoS attack. A way to evade
  a layer, cheaply amplify work, exhaust capacity below its intended threshold,
  or reach Convex/store work with a request that should be rejected is in scope.
- Issues that only affect a fork running with modified code.

## Coordinated disclosure

We prefer coordinated disclosure: hold off public details until a fix is
deployed or we've agreed on a timeline. We're happy to credit reporters in
release notes unless they ask to stay anonymous.
