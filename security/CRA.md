# CRA readiness

This document describes the engineering practices OpenIAP maintains that
correspond to EU Cyber Resilience Act (CRA) expectations. It is written for
OpenIAP maintainers, not as a legal analysis, and it is **not a substitute for
legal advice**.

## Applicability

Applicability of the CRA may depend on how individual OpenIAP components are
made available or used in commercial activities. OpenIAP does not assert a
determination here.

Regardless of legal applicability, OpenIAP maintains SBOM and software-supply-chain
security practices as part of its security governance. Nothing in this
repository should be read as a claim of certified or guaranteed compliance.

The practices below are designed to support OpenIAP's software-supply-chain
security and its preparation for applicable CRA requirements.

## What maintainers are responsible for

### 1. SBOM

**Expectation:** maintain a machine-readable inventory of the components a
product contains.

**How OpenIAP does this:** a CycloneDX 1.6 SBOM is generated for every
published release of every releasable component and attached to its GitHub
Release. Generation is automated, reads the same manifests the build reads, and
is reproducible from the released commit.

See [SBOM.md](SBOM.md). Practical constraint: transitive closure is complete
only where an ecosystem resolver export is supplied; direct runtime
dependencies are always present.

### 2. Vulnerability handling

**Expectation:** have a process to receive, assess, and act on vulnerability
reports.

**How OpenIAP does this:** private reporting and coordinated disclosure are
defined in the repository-root [`SECURITY.md`](../SECURITY.md), including the
reporting channel, a 72-hour acknowledgment commitment, and the prioritization
of receipt-validation and entitlement issues. Dependency vulnerabilities are
surfaced by Dependabot alerts.

### 3. Security updates

**Expectation:** define how fixes reach users, and for how long.

**How OpenIAP does this:** `SECURITY.md` states the supported-version policy —
security fixes land on `main` and ship in the next release of each affected
package; the latest published version of each package is supported, with older
majors fixed case by case for critical issues. Releases are cut per component
through the workflows in `.github/workflows/`, and each produces a new SBOM.

### 4. Technical evidence

**Expectation:** be able to reproduce and evidence how a release was produced.

**How OpenIAP does this** — for any published release, these are recoverable:

| Question                                 | Where the answer is                                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| What source produced this release?       | Immutable release tag; `scripts/assert-release-tag.mjs` enforces that the tag matches the published version and is reachable from `main` |
| What dependencies went into it?          | The `.cdx.json` SBOM asset on that release                                                                                               |
| Which SBOM version corresponds to it?    | SBOM filename and `metadata.component.version`; the workflow refuses to upload on a mismatch                                             |
| Which workflow generated it?             | The provenance attestation on the SBOM, verifiable with `gh attestation verify`                                                          |
| Which commit was it built from?          | `openiap:release:commit` property inside the SBOM, and the attestation subject                                                           |
| Was the npm artifact itself built by us? | npm provenance (`npm publish --provenance`), checked at release time by `scripts/verify-npm-release-provenance.mjs`                      |

## Deliberate boundaries

- **No compliance claim.** This repository does not state that OpenIAP is CRA
  compliant. It documents practices.
- **No legal interpretation.** Questions about whether a given component is in
  scope, or who the responsible economic operator is, are out of scope here.
- **Open-source specifics.** The CRA treats non-commercial open-source
  development differently from commercial supply. OpenIAP does not resolve
  that question in this repository; the practices are maintained either way.

## Where this fits

CRA readiness is a consequence of OpenIAP's supply-chain security work, not a
separate program. The umbrella is described in [README.md](README.md).
