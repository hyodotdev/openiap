# Security Policy

## Reporting a Vulnerability

Please report suspected security vulnerabilities **privately** — do not open a
public GitHub issue.

- Email: <hyo@hyo.dev> with the subject prefix `[SECURITY]`
- Or use GitHub's private vulnerability reporting on this repository
  (Security → Report a vulnerability)

Include the affected package (for example `packages/kit`,
`libraries/react-native-iap`), a description of the issue, reproduction steps
or a proof of concept, and the impact you believe it has.

You will receive an acknowledgment within 72 hours. We follow coordinated
disclosure: please give us a reasonable window to ship a fix before any public
disclosure, and we will credit reporters in the release notes unless you prefer
otherwise.

## Scope

This policy covers everything in this monorepo, including:

- The OpenIAP specification and generated types (`packages/gql`)
- Native packages (`packages/apple`, `packages/google`)
- Framework SDKs under `libraries/`
- IAPKit server and dashboard (`packages/kit`), including the community
  instance at `kit.openiap.dev`
- The documentation site (`packages/docs`)

Receipt-validation and purchase-verification logic is the highest-sensitivity
area — reports touching verification bypasses, replay, or entitlement forgery
are prioritized.

## What Counts as a Vulnerability

This bug bar keeps triage predictable and tells reporters what to expect.

**In scope:**

- Verification bypass — accepting a forged, replayed, or tampered receipt or
  purchase token as valid
- Entitlement forgery or privilege escalation in IAPKit
- Leaking purchase tokens, receipts, credentials, or API keys through logs,
  errors, or SDK surfaces
- Remote code execution, injection, or dependency confusion in a published
  artifact
- Authentication or authorization flaws in `kit.openiap.dev`

**Not a vulnerability on its own:**

- Behaviour that requires a compromised device, jailbroken OS, or attacker-run
  debugger against their own app
- Missing hardening that is not exploitable (absent headers, verbose version
  strings)
- Store-side policy behaviour owned by Apple, Google, Amazon, or Meta
- Vulnerabilities in a peer dependency the host application selects and
  versions — report those to that project, and tell us if OpenIAP forces a
  vulnerable range

If you are unsure, report it. A borderline report is more useful than a missed
one.

## Actively Exploited Vulnerabilities

If a vulnerability in an OpenIAP component is **being exploited in the wild**,
say so explicitly in your report — put `[SECURITY][ACTIVE]` in the subject.
That changes the response path:

| When                         | What happens                                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Within 24 hours of awareness | Triage and an initial assessment: which components and published versions are affected, and whether exploitation is confirmed |
| Within 72 hours              | Assessment updated with severity, impact, and any mitigation available to users                                               |
| Within 14 days               | Final assessment: root cause, fix or mitigation, and affected-version list                                                    |

Affected published versions are determined from the SBOM attached to each
release, so the answer is derived from what actually shipped rather than
reconstructed from memory. Users are informed through the GitHub Security
Advisory, the release notes of the fixing release, and the repository README
when the impact is broad.

These timelines mirror the EU Cyber Resilience Act's Article 14 reporting
windows, which apply from 11 September 2026. Whether OpenIAP is legally
required to report is a separate question — see
[`security/CRA.md`](security/CRA.md) — but the process is maintained either
way, because the first 24 hours are the part that cannot be improvised.

Reporters who need to make their own regulatory notification should tell us;
we will share the assessment on the timeline above so it can support it.

## Supported Versions

Security fixes land on `main` and ship in the next release of each affected
package. The latest published version of each package is supported; older
majors receive fixes only for critical vulnerabilities, judged case by case.

There is no long-term-support branch. When a package reaches end of life, it is
announced in its release notes and in the documentation's release history, so
integrators can plan a migration rather than discover it during an incident.

## Supply Chain

Every published release carries a CycloneDX SBOM as a GitHub Release asset, so
you can check whether a specific version contains a given dependency:

```bash
gh release download react-native-iap-16.3.0 -p '*.cdx.json'
gh attestation verify react-native-iap-16.3.0.cdx.json --repo hyodotdev/openiap
```

- [`security/SBOM.md`](security/SBOM.md) — what the SBOMs cover, how they are
  generated, and how to verify or reproduce one
- [`security/README.md`](security/README.md) — dependency monitoring, artifact
  provenance, and release integrity
- [`security/CRA.md`](security/CRA.md) — how these practices map to EU Cyber
  Resilience Act expectations
