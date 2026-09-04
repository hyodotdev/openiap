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

CI installs and scans every committed dependency lock: the root Bun workspace,
the standalone Expo package and example, the Expo and React Native Vega
examples, the agent toolchain, and the React Native Yarn and Ruby projects. The
six Bun graphs are also submitted as exact GitHub dependency snapshots.
Dependabot version-update pull requests cover `packages/kit`, GitHub Actions,
the kit Dockerfile, and the React Native CocoaPods toolchain:

- **`packages/kit`** is a deployed service with a large runtime dependency
  tree. It is the component where a vulnerable dependency has the most
  immediate consequence, and where we control the deployed version.
- **The published JavaScript SDK artifacts** (`react-native-iap`, `expo-iap`,
  `openiap-conformance`) declare no npm runtime `dependencies`. Their build and
  release graphs are still locked and scanned here; their peer dependencies are
  resolved and owned by the consuming application. React Native and Expo SBOMs
  separately include the native Apple and Google contracts selected at build
  time.
- **The React Native CocoaPods toolchain** has a committed Bundler lock and a
  pinned Ruby CI runtime, so Dependabot can propose reviewed toolchain updates
  without changing resolution between builds.
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
by OSV-Scanner and GitHub's native lockfile support. Its Bundler lock is covered
by OSV-Scanner, Dependabot, and GitHub's native Bundler support.

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
  jobs build the Apple core and the React Native, Expo, Flutter, and Godot
  wrappers. The KMP Swift bridge is compiled in the same job but after the
  analysis step, so it is checked without being traced. Its whole source is one
  `@_exported import` and its package pins openiap to a released tag, so tracing
  it put a second, older copy of the Apple core in the database rather than new
  coverage — and an alert against that copy would name code no pull request can
  change. Nothing else in CI compiles the package, so the build itself stays.
- CodeQL's Kotlin extractor traces JVM compilation, so it cannot analyse
  Kotlin/Native. This is a CodeQL platform limitation, not an OpenIAP
  configuration gap: no CodeQL setting reaches this code. The uncovered shipped
  surface is exactly `libraries/kmp-iap/library/src/iosMain` — 4 files, 1,931
  lines, 13% of the library's main-source Kotlin. `commonMain` (7,337 lines) is
  covered, because it compiles into the traced Android target.
  Three things bound the residual risk, each independently checkable:
  - The uncovered code performs no security-relevant operation. Searching
    `iosMain` for URL loading, Keychain or `SecItem`, file and defaults writes,
    crypto, and unsafe interop (`memScoped`, `usePinned`, `refTo`, `cstr`)
    returns no hits, and the repository defines no custom cinterop `.def` file.
  - Every StoreKit call, receipt read, JWS fetch, and IAPKit HTTP request runs
    in `packages/apple`, which the traced Swift job does analyse. The one place
    `iosMain` touches a secret forwards the API key and JWS straight into that
    module without storing, logging, or reshaping them.
  - `ci-kmp-iap.yml` runs `:library:iosSimulatorArm64Test`, which compiles
    `iosMain` for a real Kotlin/Native target and runs the `iosTest` suite.
    A Kotlin linter would not change this: Detekt and ktlint find style and
    complexity issues, not the taint flows CodeQL is here for, so adding one
    would grow the toolchain without closing the gap.
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

## Release artifact verification

What each lane proves about the bytes a consumer actually receives. The
distinction that matters is whether a check runs against the _published_
artifact or against a local copy that was never at risk.

| Lane                                                             | Attested                                       | Post-publication check                                                     |
| ---------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| npm (`react-native`, `expo`, `conformance`, `commerce-protocol`) | npm provenance, bound to the published tarball | `scripts/verify-npm-release-provenance.mjs`                                |
| GitHub Release (`godot`)                                         | `attest-build-provenance` over the ZIP         | downloads the served asset, compares SHA-256, runs `gh attestation verify` |
| Maven Central (`google`, `kmp`)                                  | no                                             | none                                                                       |
| pub.dev (`flutter`)                                              | no                                             | none                                                                       |
| NuGet (`maui`)                                                   | no                                             | none                                                                       |
| CocoaPods / SwiftPM (`apple`)                                    | no                                             | none                                                                       |
| SBOM artifacts (all components)                                  | `attest-build-provenance` over the `.cdx.json` | `sbom.yml` re-verifies an existing SBOM before replacing it                |

The `curl`-based HTTP status checks in the Maven, pub.dev, and NuGet lanes are
**pre-publish** guards that stop a duplicate upload. They answer "does this
coordinate already exist", not "are the published bytes the bytes CI built", and
should not be read as post-publication verification.

Closing the remaining rows means downloading each published artifact and
comparing it to the build output. That is straightforward for Maven Central,
which serves the uploaded file verbatim, and less so for registries that may
re-archive on ingest. None of it is implemented yet, and an existence check must
not be relabelled as verification in the meantime.

### Horizon app id resolution

The Horizon billing client reads `com.meta.horizon.platform.HORIZON_APP_ID` from
the merged Android manifest and throws inside `startConnection` when it is
absent, so an example that omits it compiles, installs, and fails only on a
headset.

Two checks cover this, and they prove different things:

| Check                                        | Proves                                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run audit:horizon-app-id`               | every example _declares_ the meta-data under `<application>`, with a literal id or a Gradle placeholder                                                                                            |
| `scripts/verify-horizon-merged-manifest.mjs` | the manifest merger _resolved_ a value under `<application>` that is non-empty, not an unresolved placeholder, and shaped like an app id. Nothing offline can prove the id is registered with Meta |

The declaration check is static and runs on every pull request. The resolution
check needs a built variant, and CI runs it for both targets that resolve their
id through a Gradle placeholder:

- `packages/google/Example`, via `:Example:processHorizonDebugManifest`
- `libraries/flutter_inapp_purchase/example`, via
  `:app:processDebugManifest -PhorizonEnabled=true`

Both merge the manifest without building an APK. The other examples ship the
literal in their own manifest or config, so the declaration check covers them.

Do not replace either with a check that reads the build file's text. The value
is decided by the manifest merger, and approximating that decision from source
is what an earlier revision of this audit got wrong.

### IAPKit toolchain boundary

IAPKit deploys with `flyctl deploy --remote-only`, so the image is built by
Fly's builder from `packages/kit/Dockerfile`, not by CI. Two different Bun
versions are therefore in play, and they are not interchangeable:

| Role                             | Version | What it touches                                              |
| -------------------------------- | ------- | ------------------------------------------------------------ |
| `toolchain.bun` / `pinned`       | 1.3.13  | what CI installs to lint, typecheck and test                 |
| `toolchain.bun` / `runtimeImage` | 1.4.0   | the `oven/bun` base that compiles the binary serving traffic |

The tests that gate a deploy run on the first; the artifact that serves traffic
is compiled by the second.

After the deploy, the workflow reads `https://kit.openiap.dev/health` and
requires the `revision` it reports to be the commit just built. Every earlier
step proves what was built and pushed; this is the only one that proves what is
serving, so a rollout that kept the previous machine is visible rather than
assumed away. Both are declared in `scripts/facts.mjs` and scanned,
so neither can move without the declared-fact audit failing — but the gap
between them is a real one, not an artefact of the audit. Closing it means
agreeing a single version and moving both together.

### Release immutability

GitHub's immutable releases would stop a published asset being replaced after
the fact, which is the threat the digest and attestation checks above only
_detect_. It is deliberately **not enabled**, for a mechanical reason: SBOMs are
attached by `sbom.yml` after the release exists, so turning immutability on today
would make every SBOM upload fail.

Enabling it requires moving SBOM generation into each release job so the release
is created complete. Until then the compensating controls are the attestation
and post-publication digest check on the lanes that have them, and `sbom.yml`
verifying an existing SBOM's attestation before it would replace one.

### What "immutable tag" means here

`knowledge/internal/06-git-deployment.md` calls release tags immutable. That
describes what the tag is _used for_ — npm provenance binds to the workflow run
and the commit SHA behind the tag, so a published attestation cannot be changed
by anything done to the tag afterwards. It does not describe an enforced
protection: this repository has no rulesets and `main` carries no branch
protection, so a maintainer with write access can move or delete a tag.

The consequence is bounded but real. Published provenance stays true, and the
post-publication checks on the lanes that have them compare against what the
release actually serves. What a moved tag would break is the repository's own
record agreeing with that attestation. Tag protection is a repository setting,
not a file in this tree, so it is recorded here rather than changed by a pull
request.

## Scanning posture

Every pull request installs all committed Bun locks plus the React Native Yarn
and Ruby locks without mutation. It then runs Bun's advisory audit across all
Bun graphs and OSV-Scanner across all eight locks. Unaccepted findings fail the
build.
Upstream-unpatched, build-only findings may be accepted only in the owning
project's `osv-scanner.toml` with a reason and expiry; expired or stale
exceptions fail the dependency audit, and OSV enforces the same expiry. The IAPKit
deployment repeats the Bun gate. The submitted dependency graph provides hosted
Dependabot monitoring, while CodeQL covers source and workflow vulnerabilities
in its configured languages.

Published release SBOMs are not treated as a substitute for the repository
gate. A weekly read-only job re-verifies and scans every published stable
release that carries an SBOM. Every stable release at or after its component's
coverage floor must carry one, not merely the newest. Declared version constraints are logged and omitted from the
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
