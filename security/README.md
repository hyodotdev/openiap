# OpenIAP software supply-chain security

This directory documents how OpenIAP secures what it ships. It holds policy and
the reasoning behind it; the automation lives in `scripts/` and
`.github/workflows/`, and no generated artifact is stored here.

| Document                           | Covers                                                                      |
| ---------------------------------- | --------------------------------------------------------------------------- |
| [ASSURANCE.md](ASSURANCE.md)       | Security objectives, threat identification, response, and dependency policy |
| [SBOM.md](SBOM.md)                 | Release dependency inventories: scope, format, generation, verification     |
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
                       dependency inputs
                   (published POM/nuspec,
                    package.json, pubspec,
                       Gradle, SwiftPM)
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
                                    release dispatches sbom.yml
                                               │
                                     ┌─────────┴─────────┐
                                     ▼                   ▼
                              CycloneDX SBOM      provenance
                             (release asset)      attestation
                                     │
                                     ▼
                         weekly identity verification
                             and vulnerability scan
```

## What is in place

| Capability              | Mechanism                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release SBOM            | `scripts/generate-sbom.mjs` + `.github/workflows/sbom.yml` — [CycloneDX 1.6](https://cyclonedx.org/specification/overview/)                                                                                         |
| SBOM provenance         | [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance) — [SLSA](https://slsa.dev/provenance/v1) via [Sigstore](https://www.sigstore.dev/), verifiable with `gh attestation verify` |
| npm artifact provenance | `npm publish --provenance`, re-verified by `scripts/verify-npm-release-provenance.mjs`                                                                                                                              |
| Release identity        | `scripts/assert-release-tag.mjs` — tag/version/full commit verified at check time, with the commit reachable from its release branch (`main` stable, `next` prerelease)                                             |
| Publish authorization   | `scripts/npm-publish-authorization.mjs` — publishing runs only from a verified release tag                                                                                                                          |
| Dependency monitoring   | `bun run audit:dependencies`, OSV-Scanner, Bun dependency submission, and [Dependabot](https://docs.github.com/en/code-security/dependabot)                                                                         |
| Static analysis         | [CodeQL](https://codeql.github.com/) with `security-extended` queries for JavaScript/TypeScript, C#, Actions, traced JVM Kotlin core/wrapper builds, and traced Swift core/wrapper builds                           |
| Post-release scanning   | `.github/workflows/security-rescan.yml` — weekly verification and OSV scan of published stable release SBOMs, plus HIGH/CRITICAL vulnerability and EOL scanning of the current Kit source image                     |
| Secret prevention       | GitHub secret scanning and push protection                                                                                                                                                                          |
| Repository posture      | [`ossf/scorecard-action`](https://github.com/ossf/scorecard-action) — [OpenSSF Scorecard](https://scorecard.dev/), results in code scanning                                                                         |
| Vulnerability reporting | [`../SECURITY.md`](../SECURITY.md) — private reporting, 72-hour acknowledgment                                                                                                                                      |
| Release-branch policy   | `scripts/release-branch-policy.mjs` — no prerelease metadata on `main`                                                                                                                                              |

## Dependency monitoring coverage

CI installs and scans every committed JavaScript lock: the root Bun workspace,
the standalone Expo package and example, the Expo and React Native Vega
examples, the agent toolchain, and the React Native Yarn project. The six Bun
graphs are also submitted as exact GitHub dependency snapshots. Dependabot
version-update pull requests remain
deliberately focused on `packages/kit`, GitHub Actions, and the kit Dockerfile:

- **`packages/kit`** is a deployed service with a large runtime dependency
  tree. It is the component where a vulnerable dependency has the most
  immediate consequence, and where we control the deployed version.
- **The published JavaScript SDK artifacts** (`react-native-iap`, `expo-iap`,
  `openiap-conformance`) declare no npm runtime `dependencies`. Their build and
  release graphs are still locked and scanned here; their peer dependencies are
  resolved and owned by the consuming application. React Native and Expo SBOMs
  separately include the native Apple and Google contracts selected at build
  time.
- **Native SDKs** (`packages/apple`, `packages/google`, `kmp-iap`,
  `OpenIap.Maui`, `flutter_inapp_purchase`, `godot-iap`) pin their platform
  dependencies deliberately, often with compatibility constraints documented
  inline in the build files. Automated bumps there tend to break consumers'
  toolchain compatibility rather than help; their versions are reviewed as part
  of platform upgrade work. Each supported release SBOM records its published
  direct dependency contract; a toolchain resolver export can add transitive
  entries for a consuming application.

## GitHub dependency graph

GitHub does not parse `bun.lock` directly. The
[`dependency-submission.yml`](../.github/workflows/dependency-submission.yml)
workflow converts every exact npm resolution in all six Bun locks into
commit-bound dependency snapshots. Pull requests validate the snapshot with a
read-only token. Submission runs only after changes reach `main`, on the weekly
schedule, or through a manual dispatch. React Native's Yarn lock remains covered
by OSV-Scanner and GitHub's native lockfile support.

The submitted graph and the published SBOMs answer different questions:

- **The submitted graph** describes the exact Bun dependency state of a source
  commit. It includes hosted, build, and development dependencies and is used
  for repository vulnerability monitoring.
- **Published SBOMs** describe the direct runtime contract of one released
  component. Platform transitive dependencies are included only when a
  resolver export is supplied.

An empty Dependabot alert list is evidence only after the snapshot workflow has
completed successfully for the commit being assessed. The local Bun and OSV
gates remain independent of that hosted view.

## Deliberate remaining boundaries

- `main` is not protected by a generic branch-protection rule. Stable release
  workflows make verified version commits directly to `main`; enabling a
  blanket rule without a tested, narrowly scoped automation bypass would break
  those release lanes. The repository instead defaults workflow tokens to
  read-only and grants write permissions per job.
- CodeQL's traced Kotlin jobs build the Google and KMP Android cores plus the
  React Native, Expo, Flutter, Godot, and MAUI JVM wrappers. Its traced Swift
  jobs build the Apple core, KMP Swift bridge, and React Native, Expo, Flutter,
  and Godot wrappers. KMP Kotlin/Native remains covered by its compile/test lane
  and review because CodeQL's Kotlin extractor traces JVM compilation.
- OpenIAP does not claim continuous fuzzing. Security-boundary changes require
  explicit negative regression tests, but the whole repository is not under a
  fuzzing service.
- Secret scanning and push protection cover GitHub's supported provider
  patterns. Validity checks and non-provider pattern scanning remain disabled
  under the repository's current GitHub feature set.
- `openiap-conformance@1.0.0` predates the corrected trusted-publisher lane and
  has no npm provenance. Version 1.0.1 is the first provenance-verified release;
  tag, registry-integrity, reproducibility, and SBOM evidence for 1.0.0 do not
  retroactively create npm build provenance.

## Scanning posture

Every pull request installs all committed Bun locks and the React Native Yarn
lock without mutation. It then runs Bun's advisory audit across all Bun graphs
and OSV-Scanner across all seven locks. Unaccepted findings fail the build.
Upstream-unpatched, build-only findings may be accepted only in the owning
project's `osv-scanner.toml` with a reason and expiry; expired or stale
exceptions fail the dependency audit, and OSV enforces the same expiry. The IAPKit
deployment repeats the Bun gate. The submitted dependency graph provides hosted
Dependabot monitoring, while CodeQL covers source and workflow vulnerabilities
in its configured languages.

Published release SBOMs are not treated as a substitute for the repository
gate. A weekly read-only job re-verifies and scans every published stable
release that carries an SBOM; the newest stable release of each component must
carry one. Declared version constraints are logged and omitted from the
exact-version scan copy instead of being misread as installed versions; the
signed SBOM is never changed. The same workflow rebuilds the current Kit source
image and fails on HIGH/CRITICAL vulnerabilities or an end-of-life base, while
the deploy workflow runs that image gate before production. Older releases without
an SBOM and dependencies absent from a direct-only SBOM remain outside this
coverage. See
[SBOM.md](SBOM.md#verification).

## Adding a releasable component

`scripts/generate-sbom.test.mjs` asserts that every component in the release
SSOT has SBOM metadata, so CI fails if a new component is added without it.
To satisfy it, add an entry to `COMPONENTS` in `scripts/generate-sbom.mjs`
declaring the component's distribution and dependency source. Tag aliases are
derived from the release configuration. The generator test also requires every
workflow that creates a GitHub Release to dispatch `sbom.yml`, so a new release
lane cannot silently omit the inventory.
