# OpenIAP software supply-chain security

This directory documents how OpenIAP secures what it ships. It holds policy and
the reasoning behind it; the automation lives in `scripts/` and
`.github/workflows/`, and no generated artifact is stored here.

| Document                           | Covers                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| [SBOM.md](SBOM.md)                 | Per-release dependency inventories: scope, format, generation, verification |
| [vex/](vex/README.md)              | Recorded judgements on whether a known CVE actually affects a component     |
| [CRA.md](CRA.md)                   | How these practices map to EU Cyber Resilience Act expectations             |
| [openchain.md](openchain.md)       | Self-assessment against ISO/IEC 18974 and 5230, with the current gap list   |
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

| Capability              | Mechanism                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Per-release SBOM        | `scripts/generate-sbom.mjs` + `.github/workflows/sbom.yml` — [CycloneDX 1.6](https://cyclonedx.org/specification/overview/)                                                                                         |
| SBOM provenance         | [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance) — [SLSA](https://slsa.dev/provenance/v1) via [Sigstore](https://www.sigstore.dev/), verifiable with `gh attestation verify` |
| npm artifact provenance | `npm publish --provenance`, re-verified by `scripts/verify-npm-release-provenance.mjs`                                                                                                                              |
| Release-tag integrity   | `scripts/assert-release-tag.mjs` — immutable tags, version must match, reachable from `main`                                                                                                                        |
| Publish authorization   | `scripts/npm-publish-authorization.mjs` — publishing runs only from a verified release tag                                                                                                                          |
| Dependency monitoring   | [Dependabot](https://docs.github.com/en/code-security/dependabot): npm (`packages/kit`), GitHub Actions, Docker                                                                                                     |
| Repository posture      | [`ossf/scorecard-action`](https://github.com/ossf/scorecard-action) — [OpenSSF Scorecard](https://scorecard.dev/), results in code scanning                                                                         |
| Vulnerability reporting | [`../SECURITY.md`](../SECURITY.md) — private reporting, 72-hour acknowledgment                                                                                                                                      |
| Release-branch policy   | `scripts/release-branch-policy.mjs` — no prerelease metadata on `main`                                                                                                                                              |

## Dependency monitoring coverage

Dependabot is configured for `packages/kit`, GitHub Actions, and the kit
Dockerfile. That is a deliberate scope, not an oversight:

- **`packages/kit`** is a deployed service with a large runtime dependency
  tree. It is the component where a vulnerable dependency has the most
  immediate consequence, and where we control the deployed version.
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

## What GitHub's dependency graph does and does not see

Worth stating plainly, because it explains why the SBOMs are not redundant with
the platform:

```bash
gh api repos/hyodotdev/openiap/dependency-graph/sbom   # → 0 packages
```

GitHub's [dependency graph](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/dependency-graph-supported-package-ecosystems)
does not parse this repository's dependency state: Bun lockfiles are not a
supported format, Gradle is not resolved from source, and this repository does
not commit `pubspec.lock` or `Package.resolved` because those are libraries.

Consequences:

- **Dependabot version updates work.** They read manifests directly, and open
  pull requests for `packages/kit`, GitHub Actions, and the kit Dockerfile.
- **Dependabot security alerts depend on the dependency graph**, so alert
  coverage is limited to what the graph can populate. Do not read an empty
  alert list as "no vulnerable dependencies".
- **The published SBOMs are the only complete inventory** of what each release
  contains.

Closing this gap properly would mean submitting a snapshot through the
[dependency submission API](https://docs.github.com/en/rest/dependency-graph/dependency-submission),
which is tracked as future work rather than done here.

## Known gaps

Recorded rather than silently carried. Each is repository-wide work that does
not belong to whichever change surfaced it.

| Gap                                                        | Why it is open                                                                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Actions are pinned by major tag, not commit SHA**        | A mutable tag in a privileged publish or signing path is a supply-chain risk. Fixing it means pinning every workflow at once and reconfiguring Dependabot, not two workflows in isolation |
| **Several CI workflows declare no `permissions:` block**   | They inherit the repository default instead of least privilege. OpenSSF Scorecard's Token-Permissions check reports this                                                                  |
| **GitHub's dependency graph is empty for this repository** | Bun lockfiles are unsupported and Gradle is not resolved from source, so Dependabot security alerts cannot cover the tree. Closing it needs the dependency submission API                 |

`/audit-security` re-checks each of these and prints the current state.

## Scanning posture

OpenIAP does not run a separate vulnerability scanner
([Trivy](https://github.com/aquasecurity/trivy),
[Grype](https://github.com/anchore/grype),
[osv-scanner](https://github.com/google/osv-scanner)) in CI today:

- The published SDKs have no runtime dependency tree for a scanner to examine.
- `packages/kit`'s dependencies are the meaningful surface, and Dependabot
  already opens update pull requests for them.
- A second scanner would add alert triage and CI maintenance for a signal we
  cannot yet act on better than the update stream.

The published SBOMs make this reversible without rework: any CycloneDX-consuming
scanner can be pointed at a release asset — including by consumers, on their own
schedule — without changes here. See
[SBOM.md](SBOM.md#verification) for the tools that accept one. If
`packages/kit` grows a deployment story where image scanning matters, that is
the point to revisit it.

## Adding a releasable component

`scripts/generate-sbom.test.mjs` asserts that every component in the release
SSOT has SBOM metadata, so CI fails if a new component is added without it.
To satisfy it, add an entry to `COMPONENTS` in `scripts/generate-sbom.mjs`
declaring the component's distribution and where its dependencies are declared.
Nothing else needs to change — `sbom.yml` picks it up from the release tag.
