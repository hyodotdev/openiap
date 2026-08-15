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

### Relevant classifications

The CRA defines manufacturer and open-source steward roles; other contributors
may meet neither definition. The distinction matters because it decides whether
the reporting duties below are mandatory or voluntary.

| Role                    | Who it covers                                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manufacturer**        | A natural or legal person that develops or manufactures a product with digital elements and markets it under its own name or trademark, whether for payment, monetisation, or free of charge |
| **Open-source steward** | A **legal person other than a manufacturer** that systematically provides sustained support for specific FOSS intended for commercial activities and ensures its viability                   |
| **Other contributor**   | A person or project that does not meet either definition; an individual cannot be a steward but may still be a manufacturer depending on how a product is marketed                           |

Two consequences follow for this repository as it stands today:

- The steward role requires a **legal person**. A project maintained by
  individuals, without a foundation or company behind it, is generally
  outside that definition. If OpenIAP is later hosted by a foundation, that
  foundation would be the candidate steward, not the repository.
- `packages/kit` is operated as a hosted service and is a separate question
  from the distributed SDKs. It is not covered by the SDK analysis here.

Following the 2 July 2025 corrigendum, Article 64(10) exempts open-source
software stewards from the administrative fines set out in Article 64(2) to
(9). This does not remove the steward obligations in Article 24 or settle other
forms of liability. Treat the precise liability position as a question for
legal advice rather than something this repository settles.

Recital 19 says stewards must not affix CE marking to products whose
development they support. Article 25 separately empowers the Commission to
establish voluntary FOSS security-attestation programmes through delegated
acts. OpenIAP's technical evidence does not replace a downstream manufacturer's
conformity assessment, CE marking, or warranties.

## Reporting timeline

Article 14 reporting obligations apply from **11 September 2026**, ahead of the
main product requirements on 11 December 2027. Reports go to the relevant
national CSIRT and ENISA through ENISA's Single Reporting Platform (SRP).

Each stage starts from a different event, which is easy to get wrong:

| Trigger                                                                                   | Early warning       | Notification        | Final report                                                  |
| ----------------------------------------------------------------------------------------- | ------------------- | ------------------- | ------------------------------------------------------------- |
| Actively exploited vulnerability                                                          | 24 h from awareness | 72 h from awareness | 14 days after a corrective or mitigating measure is available |
| Manufacturer: severe incident affecting the security of the product                       | 24 h from awareness | 72 h from awareness | 1 month after the 72-hour notification                        |
| Steward: severe incident affecting systems it provides for the product's FOSS development | 24 h from awareness | 72 h from awareness | 1 month after the 72-hour notification                        |

For a steward, Article 24(3) applies the vulnerability and incident reporting
duties only to the extent that the steward is involved in developing the
product. Its incident duty is further limited to the network and information
systems it provides for that development.

Only the first two clocks run from **becoming aware**. The final report for a
vulnerability runs from the availability of a fix or mitigation, and the final
report for an incident runs from the notification.

The operational procedure OpenIAP follows on becoming aware of an actively
exploited vulnerability is in
[`SECURITY.md`](../SECURITY.md#actively-exploited-vulnerabilities). That is an
**internal service level**, not a restatement of the statutory deadlines: it is
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
| [2 July 2025 corrigendum](https://eur-lex.europa.eu/eli/reg/2024/2847/corrigendum/2025-07-02/oj)               | Corrected Article 64(10) to cover paragraphs 2 to 9          |
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

**How OpenIAP does this:** each current component release workflow creates the
GitHub Release, then dispatches `sbom.yml` because a release created with
`GITHUB_TOKEN` does not trigger another workflow. The SBOM workflow generates
and uploads the CycloneDX 1.6 asset; a daily scan repairs missed latest stable
release assets. Prereleases rely on their release-time dispatch and are not
backfilled by the daily scan. Generation records the release and generator
commits, and the core dependency inventory is reproducible from those inputs.
Registry-sourced license and supplier metadata is point-in-time enrichment.

See [SBOM.md](SBOM.md). Practical constraint: transitive closure is complete
only where an ecosystem resolver export is supplied; direct runtime
dependencies are always present.

### 2. Vulnerability handling

**Expectation:** have a process to receive, assess, and act on vulnerability
reports.

**How OpenIAP does this:** the end-to-end procedure is defined in
[`ASSURANCE.md`](ASSURANCE.md), while private reporting and coordinated
disclosure are defined in the repository-root
[`SECURITY.md`](../SECURITY.md). Every committed JavaScript lock graph is
checked for unaccepted advisories in CI, the Bun gate is repeated before IAPKit
deployment, the Bun graphs are submitted to GitHub for Dependabot monitoring,
published stable release SBOMs and the Kit source image are rescanned weekly, and CodeQL
complements the dependency checks with source analysis.

### 3. Security updates

**Expectation:** define how fixes reach users, and for how long.

**How OpenIAP does this:** `SECURITY.md` states the supported-version policy —
security fixes land on `main` and ship in the next release of each affected
package; the latest published version of each package is supported, with older
majors fixed case by case for critical issues. Releases are cut per component
through the workflows in `.github/workflows/`, and each produces a new SBOM.

### 4. Technical evidence

**Expectation:** be able to reproduce and evidence how a release was produced.

**How OpenIAP does this** — for each published release carrying an SBOM, the
applicable evidence below is recoverable. Older releases without a backfilled
asset use their recorded full commit SHA, tag as verified at investigation time,
and published descriptors as the evidence source.

| Question                                 | Where the answer is                                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What source identifies this release?     | Full commit SHA plus a tag that `scripts/assert-release-tag.mjs` verifies against the published version and its release branch (`main` stable, `next` prerelease) at check time |
| What direct dependencies did it declare? | The `.cdx.json` SBOM asset on that release                                                                                                                          |
| Which SBOM version corresponds to it?    | SBOM filename and `metadata.component.version`; the workflow refuses to upload on a mismatch                                                                        |
| Which workflow generated the SBOM?       | The provenance attestation whose subject is the SBOM file digest, verifiable with `gh attestation verify`                                                           |
| Which release commit does it describe?   | The `openiap:release:commit` property inside the SBOM, checked against the release tag at publication and verification time                                         |
| Which generator revision was used?       | The `openiap:generator:commit` property and the attestation's resolved dependency for the generator                                                                 |
| Was the npm artifact itself built by us? | npm provenance (`npm publish --provenance`), checked by `scripts/verify-npm-release-provenance.mjs`; `openiap-conformance@1.0.0` is the documented legacy exception |

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
