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

## Supported Versions

Security fixes land on `main` and ship in the next release of each affected
package. The latest published version of each package is supported; older
majors receive fixes only for critical vulnerabilities, judged case by case.

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
