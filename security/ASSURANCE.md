# Open source security assurance policy

## Policy

OpenIAP maintains security controls for the source, hosted IAPKit service, and
released SDKs in this repository. The project lead named in
[`MAINTAINERS.md`](../MAINTAINERS.md) owns this policy. Contributors are expected
to follow it for changes to authentication, purchase verification, release
automation, dependencies, and generated contracts.

This policy is reviewed before each release train and at least every six
months. It is an engineering policy, not an ISO, OpenChain, or CRA conformance
claim.

## Scope and objectives

The scope is the full monorepo and `kit.openiap.dev`. A consuming application's
backend, store configuration, and resolved dependency graph remain the
consumer's responsibility.

OpenIAP measures source-changing objectives on the reviewed commit that starts
the release workflow. The workflow separately verifies the exact release
commit, tag, package metadata, and SBOM. Version-only commits created with the
workflow token do not recursively start CodeQL, so they inherit source-analysis
evidence from the reviewed source commit rather than claiming a second scan:

- no unaccepted advisory in any committed dependency lock graph; temporary
  upstream-unpatched exceptions must be scoped, justified, and expiring;
- immutable external GitHub Action references and explicit workflow token
  permissions;
- CodeQL analysis of the hosted/web, C#, workflow, JVM Kotlin core/wrapper, and
  Swift core/wrapper surfaces;
- a valid, attested CycloneDX SBOM for each published stable release carrying
  one; the newest stable release of every releasable component must have one,
  with weekly identity verification and exact-version vulnerability scanning
  for those assets; older releases without an SBOM use the documented fallback;
  and
- the acknowledgment and active-exploitation timelines in
  [`SECURITY.md`](../SECURITY.md).

The executable checks are `bun run audit:dependencies`, `/audit-security`, and
the package-specific tests. A check that did not run is not evidence.

## Threat identification

The primary assets are purchase tokens and receipts, entitlement state,
project credentials, release credentials, and published artifacts. The main
trust boundaries are:

| Boundary                                      | Required control                                                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| App or developer input → SDK/IAPKit           | Strict request decoding, size limits, and fail-closed security decisions                                                      |
| Store response/webhook → entitlement state    | Signature or token verification, replay-safe identity, and store-derived product data                                         |
| Repository input → CI shell                   | No untrusted expression interpolation; explicit environment variables and least privilege                                     |
| Third-party package/action → build or service | Locked safe versions, advisory scanning, immutable Action SHAs, and reviewable update metadata                                |
| Release workflow → registry/GitHub Release    | Tag/version/full commit verification, branch reachability, npm OIDC provenance where supported, and separate SBOM attestation |

Changes crossing one of these boundaries must include a negative test for the
relevant malformed, unauthorized, replayed, mismatched, or stale input. The
review must also check whether logs or diagnostics expose a token, receipt,
credential, or customer payload.

## Vulnerability management

1. Receive reports through the private channels in `SECURITY.md`.
2. Identify affected deployed services and release commits. Use the attested
   SBOM or the full commit SHA bound to a tag verified at investigation time
   when an older release has no SBOM.
3. Reproduce the issue and record exploitability. A dependency advisory that
   is not applicable may be recorded as CycloneDX VEX under [`vex/`](vex/).
4. Patch the owning source of truth, add a regression test, and run the full
   affected package and release-integrity gates.
5. Release every affected component, verify the published artifact, verify
   registry provenance where it exists, and communicate affected versions
   through a GitHub Security Advisory and release notes when user action is
   required.

The weekly post-release workflow re-verifies and scans every published stable
release SBOM and rebuilds the current Kit source image for a fixed-severity
container scan. Older releases without an SBOM remain outside that automation.
It does not replace affected-version analysis, consumer lock graphs, or retained
risk and remediation records.

## Dependency and license policy

Dependency changes must have a maintained upstream, a clear runtime or build
purpose, and a license suitable for that use. Prefer SPDX-declared permissive
licenses such as MIT, BSD-2-Clause, BSD-3-Clause, ISC, Apache-2.0, and 0BSD.

The following require explicit maintainer review before they enter a released
artifact or hosted service:

- copyleft or source-available licenses;
- custom terms, a missing license, or a non-SPDX license URL;
- packages installed from a Git branch, mutable URL, or unpublished tarball;
- lifecycle scripts or binaries that execute during installation; and
- an override that crosses a dependency's declared major-version range.

Do not merge a dependency whose obligations cannot be met by the distribution
or deployment model. Published SBOM license metadata is evidence of declared
licenses, not legal advice.

[`dependency-reviews.md`](dependency-reviews.md) records which dependencies
currently trip these triggers and whether each has been reviewed, so an
outstanding review is visible rather than implicit. It also carries the log for
the policy review cadence above.
