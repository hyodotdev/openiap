import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

function SecurityCompliance() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Compliance"
        description="What OpenIAP provides for CRA readiness, OpenChain self-assessment, and behavioral conformance — and what it deliberately does not claim."
        path="/docs/security/compliance"
        keywords="Cyber Resilience Act, CRA, OpenChain, ISO 18974, ISO 5230, conformance suite, compliance evidence"
      />
      <h1>Compliance</h1>
      <p>
        If you integrate OpenIAP into a product placed on the EU market, you may
        carry obligations under the Cyber Resilience Act. This page describes
        what OpenIAP publishes to support that work.
      </p>

      <Callout kind="important" title="Not a compliance guarantee">
        OpenIAP does not claim CRA compliance, and nothing here is legal advice
        or a compliance attestation on your behalf. Whether the CRA applies to
        your product, and who the responsible economic operator is, are
        questions for you and your counsel.
      </Callout>

      <section>
        <AnchorLink id="timeline" level="h2">
          The dates that matter
        </AnchorLink>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>What applies</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>11 September 2026</strong>
              </td>
              <td>
                Reporting obligations. Actively exploited vulnerabilities and
                severe incidents must be reported to ENISA and the relevant
                national CSIRT — 24-hour early warning, 72-hour notification,
                14-day final report
              </td>
            </tr>
            <tr>
              <td>
                <strong>11 December 2027</strong>
              </td>
              <td>
                The main product security requirements, including the essential
                cybersecurity requirements and conformity assessment
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Reporting starts more than a year before the product requirements do,
          which is why the reporting path is the part worth having ready first.
        </p>
      </section>

      <section>
        <AnchorLink id="what-openiap-provides" level="h2">
          What OpenIAP provides
        </AnchorLink>
        <table>
          <thead>
            <tr>
              <th>Your need</th>
              <th>What to use</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Component inventory for a product you ship</td>
              <td>
                The per-release <a href="/docs/security/sbom">SBOM</a>, in
                CycloneDX 1.6
              </td>
            </tr>
            <tr>
              <td>Evidence of where a release came from</td>
              <td>
                Provenance attestation on the SBOM, npm provenance on npm
                packages, and immutable release tags
              </td>
            </tr>
            <tr>
              <td>A channel to report a vulnerability you found</td>
              <td>
                Private reporting with a documented response timeline — see{' '}
                <a href="/docs/security/overview#reporting">Overview</a>
              </td>
            </tr>
            <tr>
              <td>Whether a flagged CVE actually affects you</td>
              <td>
                VEX statements carried in the SBOM, where an analysis exists
              </td>
            </tr>
            <tr>
              <td>Evidence the SDK behaves to specification</td>
              <td>The conformance suite, below</td>
            </tr>
          </tbody>
        </table>
        <p>
          What OpenIAP will <strong>not</strong> issue is a compliance
          attestation or warranty on behalf of a downstream manufacturer. That
          would move legal responsibility upstream, which the CRA&apos;s
          guidance for open-source stewards explicitly warns against.
        </p>
      </section>

      <section>
        <AnchorLink id="conformance" level="h2">
          Behavioral conformance
        </AnchorLink>
        <p>
          A type-level contract proves an SDK <em>declares</em> an API. It does
          not prove the API <em>does</em> anything. An implementation could
          declare <code>restorePurchases</code> and return immediately while
          passing every type check.
        </p>
        <p>
          The <code>openiap-conformance</code> suite closes that gap with
          versioned behavioral tests: permanent behavior ids, RFC-2119 levels,
          and capability gates derived from a store capability matrix rather
          than self-declared by the adapter — so an implementation cannot excuse
          itself from its own store&apos;s requirements. A missing{' '}
          <strong>MUST</strong> behavior is reported as a failure, not skipped.
        </p>
        <p>
          It matters for compliance because it produces reproducible evidence
          that a released SDK behaves as the specification says — including
          around entitlement correctness, where the suite&apos;s first run
          surfaced real defects such as a pending subscription being treated as
          an active entitlement.
        </p>
        <ul>
          <li>
            <a href="/docs/ecosystem">Ecosystem</a> — which SDKs implement the
            specification
          </li>
          <li>
            <a
              href="https://github.com/hyodotdev/openiap/tree/main/packages/conformance"
              target="_blank"
              rel="noopener noreferrer"
            >
              packages/conformance
            </a>{' '}
            — the suite, its adapter contract, and how to run it
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="openchain" level="h2">
          OpenChain self-assessment
        </AnchorLink>
        <p>
          OpenIAP maintains an internal gap assessment against{' '}
          <strong>ISO/IEC 18974</strong> (open source security assurance) and{' '}
          <strong>ISO/IEC 5230</strong> (license compliance). These are the
          closest existing standards to what the CRA expects of a software
          supplier, and they are expressed as verifiable materials rather than
          legal language.
        </p>
        <p>
          The assessment is published as a gap list, not a conformance claim —
          it records what exists, what does not, and what is out of proportion
          for a project of this size. Met today: the public reporting channel
          with a documented response path, and the automated per-release SBOM.
          Open: a single named security-assurance policy document, a maintainer
          responsibility inventory, and a declared license policy.
        </p>
        <p>
          <a
            href="https://github.com/hyodotdev/openiap/blob/main/security/openchain.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read the current gap assessment
          </a>
        </p>
      </section>

      <section>
        <AnchorLink id="steward" level="h2">
          A note on roles
        </AnchorLink>
        <p>
          The CRA distinguishes <strong>manufacturers</strong>,{' '}
          <strong>open-source stewards</strong>, and everyone else. A steward
          must be a <em>legal person</em> that systematically supports
          open-source software intended for commercial activities; individual
          maintainers and unincorporated projects fall outside that definition.
        </p>
        <p>
          OpenIAP does not assert a determination about its own status here. The
          practices are maintained either way, because the value of an accurate
          inventory and a working reporting path does not depend on which label
          applies.
        </p>
      </section>
    </div>
  );
}

export default SecurityCompliance;
