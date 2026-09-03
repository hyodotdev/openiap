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

- Both OpenIAP specifications (`specs/client` and
  `specs/commerce-protocol`) and their generated artifacts
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

This is an **internal service level**, not a restatement of any statutory
deadline:

| When                                                  | What happens                                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Within 24 hours of awareness                          | Triage and an initial assessment: which components and published versions are affected, and whether exploitation is confirmed |
| Within 72 hours of awareness                          | Assessment updated with severity, impact, and any mitigation available to users                                               |
| Within 14 days of a fix or mitigation being available | Final assessment: root cause, the fix or mitigation, and the affected-version list                                            |

For dependency advisories, attached SBOMs identify which releases declare the
affected dependency. First-party source issues require release-commit
comparison, reproduction, and regression testing. Older releases without a
backfilled asset are investigated from the full commit SHA recorded for the
release, its tag as verified at investigation time, and the published
descriptors. Users are informed through the GitHub Security
Advisory, the release notes of the fixing release, and the repository README
when the impact is broad.

These windows are modelled on the EU Cyber Resilience Act's Article 14 staging,
which applies from 11 September 2026, but they are not the statutory deadlines
themselves and do not discharge anyone's reporting duty. Whether OpenIAP is
legally required to report is a separate question — see
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

Current component release workflows attach a CycloneDX SBOM as a GitHub Release
asset, and a daily repair job fills any missed latest-stable-release asset. Use
it to check whether a specific version declares a given dependency:

```bash
gh release download react-native-iap-16.3.0 \
  --repo hyodotdev/openiap -p '*.cdx.json'
CERT_IDENTITY=https://github.com/hyodotdev/openiap
CERT_IDENTITY="$CERT_IDENTITY/.github/workflows/sbom.yml@refs/heads/main"
gh attestation verify react-native-iap-16.3.0.cdx.json \
  --repo hyodotdev/openiap --cert-identity "$CERT_IDENTITY" \
  --deny-self-hosted-runners
```

- [`security/SBOM.md`](security/SBOM.md) — what the SBOMs cover, how they are
  generated, and how to verify or reproduce one
- [`security/README.md`](security/README.md) — dependency monitoring, artifact
  provenance, and release integrity
- [`security/ASSURANCE.md`](security/ASSURANCE.md) — threat boundaries,
  dependency policy, and vulnerability-response procedure
- [`security/CRA.md`](security/CRA.md) — how these practices map to EU Cyber
  Resilience Act expectations
