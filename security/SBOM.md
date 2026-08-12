# Software Bill of Materials (SBOM)

## Purpose

Every OpenIAP release ships a machine-readable inventory of the third-party
code it contains. That inventory exists so a consumer — or a maintainer
responding to a new advisory — can answer one question without reading our
build scripts: _does this version of this package contain the vulnerable
dependency?_

SBOMs are generated from the same manifests the build reads. No one edits an
SBOM by hand, and none are committed to the repository.

## Scope

One SBOM per **releasable component**, not one per repository. A single
monorepo-wide document would describe an artifact nobody installs.

The component list is not maintained here. It is read from the release
single-source-of-truth, `scripts/release-branch-policy.mjs`, so a component
cannot be released without also being described:

| Component      | SBOM name                | Distribution                     | Release tag                     |
| -------------- | ------------------------ | -------------------------------- | ------------------------------- |
| `apple`        | `openiap-apple`          | CocoaPods, Swift Package Manager | `<version>`                     |
| `google`       | `openiap-google`         | Maven Central                    | `google-<version>`              |
| `react-native` | `react-native-iap`       | npm                              | `react-native-iap-<version>`    |
| `expo`         | `expo-iap`               | npm                              | `expo-iap-<version>`            |
| `conformance`  | `openiap-conformance`    | npm                              | `openiap-conformance-<version>` |
| `flutter`      | `flutter_inapp_purchase` | pub.dev                          | `flutter-iap-<version>`         |
| `kmp`          | `kmp-iap`                | Maven Central                    | `kmp-iap-<version>`             |
| `maui`         | `OpenIap.Maui`           | NuGet                            | `maui-iap-<version>`            |
| `godot`        | `godot-iap`              | GitHub Release                   | `godot-iap-<version>`           |
| `docs`         | `openiap-spec`           | GitHub Release                   | `docs-<version>`                |

`packages/kit` (IAPKit) is deliberately outside this list. It is a deployed
service rather than a distributed package: consumers call it over HTTPS and
never install its dependency tree. Its dependencies are monitored through
Dependabot instead — see [README.md](README.md).

## Standards

| Concern            | Standard                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document format    | [CycloneDX 1.6](https://cyclonedx.org/specification/overview/), JSON encoding ([schema](https://github.com/CycloneDX/specification))                       |
| Component identity | [Package URL (purl)](https://github.com/package-url/purl-spec)                                                                                             |
| License identity   | [SPDX license identifiers](https://spdx.org/licenses/)                                                                                                     |
| Vulnerability data | [CycloneDX VEX](https://cyclonedx.org/capabilities/vex/)                                                                                                   |
| Attestation        | [in-toto](https://in-toto.io/) statements carrying [SLSA provenance](https://slsa.dev/provenance/v1), signed through [Sigstore](https://www.sigstore.dev/) |

CycloneDX is the primary format. It was chosen over SPDX because purl coverage
across the six ecosystems this repository publishes into (npm, Maven, NuGet,
pub, CocoaPods, generic) is more direct, and because vulnerability tooling in
these ecosystems consumes CycloneDX with less translation. There is no second
format: publishing two documents that can disagree is a liability, not a
feature.

## What this system depends on

An SBOM pipeline is itself a supply-chain surface, so its own inputs are listed
here rather than left implicit.

**The generator** (`scripts/generate-sbom.mjs`, `scripts/sbom-dependencies.mjs`)
uses **only the Node.js standard library** — no npm dependency, no vendored
code, no external binary. It is plain ESM run by the Node version already
pinned in CI. This is deliberate: a tool that reports what you depend on should
not quietly add dependencies of its own.

**At generation time** it reads package registries over HTTPS, and only to
resolve declared licenses:

| Registry                                          | Used for                    |
| ------------------------------------------------- | --------------------------- |
| [Maven Central](https://repo1.maven.org/maven2/)  | Maven coordinate POMs       |
| [Google Maven](https://maven.google.com/)         | androidx / com.android POMs |
| [nuget.org](https://www.nuget.org/)               | NuGet `.nuspec`             |
| [registry.npmjs.org](https://registry.npmjs.org/) | npm package metadata        |

A registry failure degrades to a missing license field; it never blocks a
release.

**In CI**, `.github/workflows/sbom.yml` uses these actions:

| Action                                                                                  | Purpose                    | License |
| --------------------------------------------------------------------------------------- | -------------------------- | ------- |
| [`actions/checkout`](https://github.com/actions/checkout)                               | Check out the released tag | MIT     |
| [`actions/setup-node`](https://github.com/actions/setup-node)                           | Provide the Node runtime   | MIT     |
| [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance) | Sign SLSA provenance       | MIT     |
| [`gh` CLI](https://cli.github.com/)                                                     | Upload the release asset   | MIT     |

Action versions are pinned in the workflow and kept current by Dependabot.

## Naming convention

```text
<sbom-name>-<version>.cdx.json
```

Concretely:

```text
react-native-iap-16.3.0.cdx.json
openiap-conformance-1.0.0.cdx.json
openiap-google-3.3.0.cdx.json
```

The name and version always equal the published package's own name and
version, so a released artifact and its SBOM can be matched without a lookup
table.

## Generation

```bash
bun run sbom <component>                  # writes ./sbom/<name>-<version>.cdx.json
bun run sbom <component> --with-licenses  # also resolve licenses from registries
bun run sbom <component> --stdout         # print instead of writing
bun run sbom resolve-tag <tag>            # which component does this tag belong to?
```

The generator (`scripts/generate-sbom.mjs`) reads:

| Ecosystem | Dependency source                                                    |
| --------- | -------------------------------------------------------------------- |
| npm       | `package.json` (`dependencies`)                                      |
| Gradle    | `build.gradle.kts`, `gradle.properties`, `gradle/libs.versions.toml` |
| NuGet     | `*.csproj`, `Directory.Build.props`                                  |
| pub       | `pubspec.yaml`                                                       |
| Swift     | `Package.swift`                                                      |

### What is included

**Runtime dependencies of the published artifact.** Direct dependencies always;
transitive dependencies when a resolver export is supplied (see below).

### What is excluded, and why

- **Test and build-only dependencies.** `testImplementation`,
  `androidTestImplementation`, `compileOnly`, annotation processors, and NuGet
  references marked `PrivateAssets="all"` never reach a consumer. Listing them
  would inflate the apparent attack surface of the shipped artifact with code
  that is not in it.
- **`devDependencies`.** Same reasoning. Note that the npm packages here
  declare no runtime `dependencies` at all, so their SBOMs are legitimately
  empty of third-party components — that is a property of the artifact, not a
  gap in the tooling.
- **`peerDependencies`.** The host application supplies and versions these
  (React, React Native, Expo, Flutter SDK). They are part of the consuming
  application's SBOM, not ours.
- **Operating-system frameworks.** StoreKit is not a distributed package.

### Licenses

`--with-licenses` resolves each dependency's declared license from its own
registry — Maven Central and Google's Maven repository for Maven coordinates,
nuget.org for NuGet, registry.npmjs.org for npm. The release workflow passes
this flag; local runs default to offline.

Licenses are never guessed. A registry value is emitted as an SPDX identifier
only when it is a recognised one; anything else is recorded as a free-text
license name, because downstream tooling treats `license.id` as authoritative
and a confident wrong identifier is worse than an absent one. A lookup failure
leaves the field empty rather than failing the release — license data is
compliance metadata, not part of the security inventory.

Every direct dependency resolves a license except two structural cases, which
are limitations of the source metadata rather than bugs:

- **pub.dev packages** — Dart declares licensing in a `LICENSE` file, and
  package metadata exposes no standard license field.
- **NuGet packages whose nuspec carries only a license URL** that does not map
  to an SPDX identifier, such as `Xamarin.Android.Google.BillingClient`.

`bun run sbom <component> --with-licenses` prints the resolved count for a
component, so current coverage is checkable rather than quoted here — a fixed
number would go stale the next time a dependency changes.

### Transitive dependencies

Direct dependencies are read from the manifest. A complete transitive closure
requires the ecosystem's own resolver, which only a runner with that toolchain
can produce. When such an export is available it is merged in:

```bash
bun run sbom google --resolved gradle-dependencies.json
```

The file is a JSON array (or `{"components": [...]}`) of `{name, version, purl}`
entries. Merged entries are marked with an `openiap:sbom:relationship`
property of `transitive`, and the component's `dependsOn` list continues to
name only its direct dependencies.

Where a manifest declares a coordinate this reader cannot resolve, generation
**fails** rather than emitting a shorter list. An SBOM that silently omits a
dependency is worse than no SBOM, because it is trusted.

#### Planned: replace manifest parsing with resolver output

The Gradle, NuGet, and pub readers in `scripts/sbom-dependencies.mjs` parse
build manifests with regular expressions. That is a deliberate stopgap, and it
is the one part of this system expected to need maintenance: `build.gradle.kts`
is arbitrary Kotlin, so new declaration shapes will keep appearing. Two already
did — `for (module in listOf(...))` expansion and `project.findProperty(...)`
resolution.

**Do not keep growing the parsers.** When transitive support is implemented,
move these ecosystems onto their own resolvers instead:

| Ecosystem | Replace parser with                                            |
| --------- | -------------------------------------------------------------- |
| Gradle    | `cyclonedx-gradle-plugin`, or `gradlew :<module>:dependencies` |
| NuGet     | `dotnet list package --include-transitive --format json`       |
| pub       | `flutter pub deps --json`                                      |

That removes roughly 350 lines of parsing and delivers the transitive closure
in the same change — the ecosystem readers shrink rather than grow. It was not
done in the initial implementation because no JDK, Flutter, or .NET toolchain
was available to verify the result, and unverified code in a release path is
worse than a verified stopgap.

Until then, the parsers are safe to rely on for one reason: a coordinate they
cannot resolve raises an error instead of being dropped, and the tests read the
real manifests in this repository, so drift fails CI rather than silently
shortening an inventory.

## Release integration

`.github/workflows/sbom.yml` runs on `release: published` and on manual
dispatch. It does not modify the existing release workflows; it reacts to the
releases they create, so every component — including ones added later — is
covered by the same code path.

```text
release workflow  →  GitHub Release published
                            │
                            ▼
                  sbom.yml (release: published)
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    resolve component   generate SBOM   verify identity
      from the tag     at the tagged     (version, tag,
                          commit         commit, no paths)
                            │
                  ┌─────────┴─────────┐
                  ▼                   ▼
            attest provenance   upload as release asset
```

Before upload, the workflow asserts that the SBOM's version, release tag, and
commit all match the release being processed, and that no local filesystem
path leaked into the document. Any mismatch fails the run.

Tags that do not belong to a component are skipped with a notice rather than
failing.

## Storage location

Generated SBOMs live **only** as assets on their GitHub Release:

```text
https://github.com/hyodotdev/openiap/releases/tag/<release-tag>
  └── <sbom-name>-<version>.cdx.json
```

They are not committed. `sbom/` and `*.cdx.json` are gitignored. A checked-in
SBOM would be a second source of truth that drifts from the release it claims
to describe, and would add noise to every dependency-changing pull request.

## Verification

Any consumer can independently verify a published SBOM:

```bash
# 1. Download the SBOM from its release
gh release download react-native-iap-16.3.0 -p '*.cdx.json'

# 2. Confirm this repository's CI produced it
gh attestation verify react-native-iap-16.3.0.cdx.json \
  --repo hyodotdev/openiap

# 3. Validate it against the CycloneDX schema
cyclonedx validate --input-file react-native-iap-16.3.0.cdx.json \
  --input-format json --input-version v1_6 --fail-on-errors
```

Every tool above is independent of this repository, so verification does not
require trusting our tooling:

| Tool                                                                           | Role                                         | License    |
| ------------------------------------------------------------------------------ | -------------------------------------------- | ---------- |
| [`gh attestation verify`](https://cli.github.com/manual/gh_attestation_verify) | Confirm CI provenance against Sigstore       | MIT        |
| [`cyclonedx-cli`](https://github.com/CycloneDX/cyclonedx-cli)                  | Validate against the published schema        | Apache-2.0 |
| [`bomlens`](https://github.com/sktelecom/bomlens)                              | Local-first SBOM validation and risk report  | Apache-2.0 |
| [`osv-scanner`](https://github.com/google/osv-scanner)                         | Match components against the OSV database    | Apache-2.0 |
| [`grype`](https://github.com/anchore/grype)                                    | Match components against vulnerability feeds | Apache-2.0 |

OpenIAP runs none of these in CI — see [README.md](README.md#scanning-posture)
for why — but each accepts a CycloneDX 1.6 document directly, so a consumer can
point their own scanner at a release asset on their own schedule.

Maintainers can additionally reproduce it. Generation is deterministic for a
given commit — the document timestamp is the commit timestamp and the serial
number is derived from the release identity, not randomly generated — so
regenerating at the released commit yields a byte-identical file:

```bash
git checkout react-native-iap-16.3.0
bun run sbom react-native --output-dir /tmp/verify
diff /tmp/verify/react-native-iap-16.3.0.cdx.json ./react-native-iap-16.3.0.cdx.json
```

## Update policy

- An SBOM is produced for every published release, automatically.
- SBOMs are **immutable once published**, exactly like the release tag they
  belong to. A dependency change ships as a new release with a new SBOM; a
  published SBOM is never edited in place.
- If a release predates this system, its SBOM can be generated retroactively
  with `workflow_dispatch` against that tag. The result describes that tag's
  commit, not today's `main`.
- Changes to the generator are covered by `scripts/generate-sbom.test.mjs`,
  which runs in CI on every pull request. The test asserting that every
  releasable component has SBOM metadata fails if a new component is added
  without one.

## Relationship to vulnerability management

The SBOM is an input to vulnerability response, not the goal:

```text
SBOM (per released version)
   │
   ▼
dependency inventory  ←──  Dependabot alerts (packages/kit, GitHub Actions, Docker)
   │
   ▼
affected-version analysis  ──  "which shipped releases contain this CVE?"
   │
   ▼
security advisory + patch
   │
   ▼
new release  →  new SBOM
```

Its concrete value here is answering the affected-version question. Dependabot
tells us a dependency is vulnerable _today, on `main`_. The published SBOMs
tell us which already-shipped versions contain it — which is what a consumer
needs to know and what an advisory has to state.

See [README.md](README.md) for the full vulnerability-management picture and
[CRA.md](CRA.md) for how this maps onto Cyber Resilience Act expectations.
