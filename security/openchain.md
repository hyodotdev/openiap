# OpenChain gap assessment

A self-assessment of OpenIAP against **ISO/IEC 18974** (OpenChain Security
Assurance) and, where relevant, **ISO/IEC 5230** (OpenChain License
Compliance). It records what exists, what does not, and what is deliberately
out of scope.

This is an internal gap list, **not a conformance claim**. OpenIAP has not
submitted a self-certification.

Reference material, all openly licensed:

| Source                                                                                                                                                          | Use                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [OpenChain ISO/IEC 18974](https://openchainproject.org/security-assurance) ([spec text](https://github.com/OpenChain-Project/Security-Assurance-Specification)) | Security-assurance requirements assessed below              |
| [OpenChain ISO/IEC 5230](https://openchainproject.org/license-compliance)                                                                                       | License-compliance requirements                             |
| [Trusted OSS](https://trustedoss.github.io/en)                                                                                                                  | Self-study guide mapping the standards to concrete evidence |

Why bother: 18974 is the closest existing standard to what the CRA expects of
software suppliers, and it is expressed as verifiable materials rather than
legal language. Closing these gaps improves the security programme regardless
of which regulation applies. It also aligns with the foundation track, since
OpenChain is a Linux Foundation project.

## ISO/IEC 18974 — Security Assurance

| Req   | Requirement                   | Status      | Where / what is missing                                                                                                                                                                                                                                                              |
| ----- | ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1.1 | Policy                        | **Partial** | [`ASSURANCE.md`](ASSURANCE.md) is the named policy, identifies its owner and participants, and links executable controls. A documented procedure and retained evidence for communicating the policy to participants are still missing                                                |
| 4.1.2 | Competence                    | **Partial** | [`../MAINTAINERS.md`](../MAINTAINERS.md) names the current owner and scope. There are no competency definitions or assessment records                                                                                                                                                |
| 4.1.3 | Awareness                     | **Missing** | No assessed-awareness evidence. Low value at current project size — see _Proportionality_                                                                                                                                                                                            |
| 4.1.4 | Program scope                 | **Partial** | [`ASSURANCE.md`](ASSURANCE.md#scope-and-objectives) defines the repository and service scope, objectives, owner, and review cadence. Review/audit records, metric history, and evidence of resulting updates are still missing                                                       |
| 4.1.5 | Standard practice (8 methods) | **Partial** | Threat identification, dependency/source scanning, weekly published-SBOM scanning, negative regression tests, follow-up, communication, and SBOM/VEX export are documented. Releases without SBOMs and retained action records remain incomplete                                     |
| 4.2.1 | Access                        | **Met**     | Public reporting contact and private disclosure channel in [`../SECURITY.md`](../SECURITY.md), with a documented internal response path including the 24/72-hour timeline                                                                                                            |
| 4.2.2 | Effectively resourced         | **Partial** | [`ASSURANCE.md`](ASSURANCE.md) assigns the project lead. Evidence that available time, funding, staffing, and expertise are adequate is still missing                                                                                                                                |
| 4.3.1 | Software bill of materials    | **Partial** | [`SBOM.md`](SBOM.md) documents and publishes current direct release inventories. Platform transitive dependencies require an external resolver export, and no continuous archive covers every OSS component                                                                          |
| 4.3.2 | Security assurance            | **Partial** | [`ASSURANCE.md`](ASSURANCE.md#vulnerability-management) defines the response path, published stable release SBOMs are scanned weekly, and [`vex/`](vex/README.md) can record non-applicability. Per-component risk scores, releases without SBOMs, and action records are incomplete |
| 4.4.1 | Completeness                  | **Missing** | No affirmation document; would be the output of closing the above                                                                                                                                                                                                                    |
| 4.4.2 | Duration                      | **Missing** | No 18-month re-affirmation cycle defined                                                                                                                                                                                                                                             |

## ISO/IEC 5230 — License Compliance (partial view)

Only the parts touched by the SBOM work are assessed here.

| Area                                                 | Status      | Notes                                                                                                                                                                                 |
| ---------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component license inventory                          | **Partial** | Published SBOMs carry local-known and registry-resolved license data, while ecosystems without standard machine-readable metadata retain visible gaps ([`SBOM.md`](SBOM.md#licenses)) |
| License policy (allowed/conditional/forbidden tiers) | **Met**     | [`ASSURANCE.md`](ASSURANCE.md#dependency-and-license-policy) defines preferred licenses and changes requiring explicit maintainer review                                              |
| Attribution / NOTICE generation                      | **Missing** | Not generated. Release SBOMs expose native and framework dependencies but do not produce consumer attribution bundles                                                                 |
| Per-package LICENSE files                            | **Partial** | Current source packages `openiap-conformance` with a LICENSE, but the already published 1.0.0 and 1.0.1 tarballs predate that fix                                                     |

## Proportionality

Several 18974 requirements — competence assessment, awareness training,
staffing adequacy — assume an organisation with employees. OpenIAP is a
small-maintainer open-source project. Producing HR-shaped evidence for a
project this size would be paperwork that no one reads and that no consumer
benefits from.

The honest position: these are marked **Missing** rather than
_Not applicable_, because they would become real if OpenIAP moves under a
foundation. Until then, the requirements worth closing are the ones that
produce something a consumer or downstream manufacturer can actually use.

## Priority

Ordered by value to someone consuming OpenIAP, not by requirement number.

1. **Post-release vulnerability records** (4.1.5, 4.3.1, 4.3.2) — backfill
   supported releases that predate SBOM publication, retain risk/impact scores
   and remediation decisions, and archive the supporting records.
2. **Policy communication and review evidence** (4.1.1, 4.1.4) — define a
   proportionate communication procedure and retain metric-backed review and
   update records.
3. **Competence, awareness, and resourcing evidence** (4.1.2, 4.1.3, 4.2.2) —
   define proportionate evidence if the project gains an organisational home.
4. **Attribution generation** (5230) — determine whether a consolidated NOTICE
   artifact adds value beyond package licenses and SBOM metadata.
5. **Self-affirmation and re-affirmation** (4.4.1, 4.4.2) — only after the
   remaining programme requirements are met and the evidence has been reviewed.

These are declared programme-maturity gaps, not evidence of conformance. The
technical controls above still apply to each release. Any failed control or
newly applicable vulnerability must be triaged before the next affected
release, with the resolution or time-bounded exception recorded.
