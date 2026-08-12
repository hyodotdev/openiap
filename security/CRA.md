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

### Roles the CRA defines

Three roles carry different obligations. The distinction matters because it
decides whether the reporting duties below are mandatory or voluntary.

| Role                    | Who it covers                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manufacturer**        | Places a product with digital elements on the EU market under its own name, commercially                                                      |
| **Open-source steward** | A **legal person** that systematically provides sustained support for FOSS intended for commercial activities, without directly monetising it |
| **Neither**             | Individual maintainers and unincorporated projects — they lack legal personhood and fall outside the steward definition                       |

Two consequences follow for this repository as it stands today:

- The steward role requires a **legal person**. A project maintained by
  individuals, without a foundation or company behind it, is generally
  outside that definition. If OpenIAP is later hosted by a foundation, that
  foundation would be the candidate steward, not the repository.
- `packages/kit` is operated as a hosted service and is a separate question
  from the distributed SDKs. It is not covered by the SDK analysis here.

Stewards cannot be fined (Article 64(10)), and stewards must never issue
compliance attestations or warranties on behalf of downstream manufacturers —
that would improperly move legal responsibility upstream. OpenIAP issues no
such attestation.

## Reporting timeline

Article 14 reporting obligations apply from **11 September 2026**, ahead of the
main product requirements on 11 December 2027. Reports go to the relevant
national CSIRT and ENISA through ENISA's Single Reporting Platform (SRP).

| Trigger                                           | Early warning | Notification | Final report |
| ------------------------------------------------- | ------------- | ------------ | ------------ |
| Actively exploited vulnerability                  | 24 hours      | 72 hours     | 14 days      |
| Severe incident affecting operated infrastructure | 24 hours      | 72 hours     | 1 month      |

These clocks start when the responsible party **becomes aware**, not when a fix
exists. The operational procedure OpenIAP follows on becoming aware of an
actively exploited vulnerability is in
[`SECURITY.md`](../SECURITY.md#actively-exploited-vulnerabilities); it is
maintained whether or not the obligation is legally binding here, because the
first 24 hours are the part that cannot be improvised.

Article 15 additionally allows **voluntary** reporting of vulnerabilities,
incidents, and near misses by any party, including those with no mandatory
duty.

## Sources

This document is a reading of public material, not legal advice. The primary
sources are:

| Source                                                                                                         | What it provides                                             |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [Regulation (EU) 2024/2847](https://eur-lex.europa.eu/eli/reg/2024/2847/oj)                                    | The regulation itself, including Articles 14, 15, 24, and 64 |
| [European Commission — CRA implementation](https://digital-strategy.ec.europa.eu/en/policies/cra-summary)      | Official summary and implementation guidance                 |
| [European Commission — CRA and open source](https://digital-strategy.ec.europa.eu/en/policies/cra-open-source) | Open-source-specific position                                |
| [OpenSSF CRA Stewards Playbook](https://policy.openssf.org/CRA/stewards-playbook.html)                         | Practical checklist behind the obligations described here    |
| [Open Regulatory Compliance WG](https://orcwg.org/cra/) and its [FAQ](https://cra.orcwg.org/faq/stewards/)     | Community reading of steward vs manufacturer scope           |
| [ENISA](https://www.enisa.europa.eu/)                                                                          | Operates the Single Reporting Platform reports are filed to  |

Where this document and the regulation disagree, the regulation governs.

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
