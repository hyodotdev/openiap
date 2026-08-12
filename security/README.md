# OpenIAP software supply-chain security

This directory documents how OpenIAP secures what it ships. It holds policy and
the reasoning behind it; the automation lives in `scripts/` and
`.github/workflows/`, and no generated artifact is stored here.

| Document                           | Covers                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| [SBOM.md](SBOM.md)                 | Per-release dependency inventories: scope, format, generation, verification |
| [CRA.md](CRA.md)                   | How these practices map to EU Cyber Resilience Act expectations             |
| [`../SECURITY.md`](../SECURITY.md) | Vulnerability reporting, disclosure, supported versions                     |

Vulnerability reporting stays at the repository root, where GitHub and most
contributors look for it.

## The pipeline

```text
                        OpenIAP source
                              │
                              ▼
                     dependency manifests
                    (package.json, gradle,
                     csproj, pubspec, spm)
                              │
                              ▼
                        CI (ci.yml)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
            build          tests        audits: parity,
                                        docs, lockfile,
                                        release state
                              │
                              ▼
                    release workflow (per component)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           package        npm/registry    GitHub Release
                           provenance          │
                                               ▼
                                    sbom.yml (release: published)
                                               │
                                     ┌─────────┴─────────┐
                                     ▼                   ▼
                              CycloneDX SBOM      provenance
                             (release asset)      attestation
```

## What is in place

| Capability              | Mechanism                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Per-release SBOM        | `scripts/generate-sbom.mjs` + `.github/workflows/sbom.yml`                                   |
| SBOM provenance         | `actions/attest-build-provenance`, verifiable with `gh attestation verify`                   |
| npm artifact provenance | `npm publish --provenance`, re-verified by `scripts/verify-npm-release-provenance.mjs`       |
| Release-tag integrity   | `scripts/assert-release-tag.mjs` — immutable tags, version must match, reachable from `main` |
| Publish authorization   | `scripts/npm-publish-authorization.mjs` — publishing runs only from a verified release tag   |
| Dependency monitoring   | Dependabot: npm (`packages/kit`), GitHub Actions, Docker                                     |
| Vulnerability reporting | [`../SECURITY.md`](../SECURITY.md) — private reporting, 72-hour acknowledgment               |
| Release-branch policy   | `scripts/release-branch-policy.mjs` — no prerelease metadata on `main`                       |

## Dependency monitoring coverage

Dependabot is configured for `packages/kit`, GitHub Actions, and the kit
Dockerfile. That is a deliberate scope, not an oversight:

- **`packages/kit`** is a deployed service with 34 direct runtime dependencies
  and a large transitive tree. It is the component where a vulnerable
  dependency has the most immediate consequence, and where we control the
  deployed version.
- **The published SDKs** (`react-native-iap`, `expo-iap`,
  `openiap-conformance`) declare **no runtime `dependencies`**. There is no
  third-party runtime tree to monitor. Their peer dependencies are resolved and
  owned by the consuming application.
- **Native SDKs** (`packages/apple`, `packages/google`, `kmp-iap`,
  `OpenIap.Maui`, `flutter_inapp_purchase`, `godot-iap`) pin their platform
  dependencies deliberately, often with compatibility constraints documented
  inline in the build files. Automated bumps there tend to break consumers'
  toolchain compatibility rather than help; their versions are reviewed as part
  of platform upgrade work, and the SBOMs record exactly what each release
  shipped.

## Scanning posture

OpenIAP does not run a separate vulnerability scanner (Trivy, Grype, Snyk) in
CI today. The reasoning:

- GitHub's Dependabot alerts already match this repository's manifests against
  the GitHub Advisory Database, which is the same data an OSV-backed scanner
  would use for these ecosystems.
- The published SDKs have no runtime dependency tree for a scanner to examine.
- A second scanner would add alert triage and CI maintenance without new
  signal.

The published SBOMs mean this decision is reversible without rework: any
CycloneDX-consuming scanner can be pointed at a release asset — including by
consumers, on their own schedule — without changes here. If `packages/kit`
grows a deployment story where image scanning matters, that is the point to
revisit it.

## Adding a releasable component

`scripts/generate-sbom.test.mjs` asserts that every component in the release
SSOT has SBOM metadata, so CI fails if a new component is added without it.
To satisfy it, add an entry to `COMPONENTS` in `scripts/generate-sbom.mjs`
declaring the component's distribution and where its dependencies are declared.
Nothing else needs to change — `sbom.yml` picks it up from the release tag.
