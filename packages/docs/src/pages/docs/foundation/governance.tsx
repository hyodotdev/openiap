import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';
import { FUNDING_LINKS } from '../../../lib/sponsors';

function Governance() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Governance"
        description="OpenIAP project governance model — open decision-making, maintainer structure, and path toward community-driven Technical Steering Committee."
        path="/docs/foundation/governance"
        keywords="OpenIAP governance, open source governance, TSC, technical steering committee, maintainer policy"
      />
      <h1>Project Governance</h1>
      <Callout kind="note" title="Draft">
        The Foundation section is currently being prepared. Content may change
        as the governance structure is finalized.
      </Callout>
      <p>
        OpenIAP is an open-source project providing a neutral interoperability
        standard for in-app purchase APIs and verification across platforms.
        This page describes the governance model for the project.
      </p>

      <section>
        <AnchorLink id="mission" level="h2">
          Mission
        </AnchorLink>
        <p>
          To establish and maintain an open, vendor-neutral standard for in-app
          purchase interoperability, verification, and security — enabling
          consistent behavior across all platforms, frameworks, and store
          providers.
        </p>
      </section>

      <section>
        <AnchorLink id="governance-model" level="h2">
          Governance Model
        </AnchorLink>
        <p>
          OpenIAP currently operates under a{' '}
          <strong>founder-led governance model</strong> with a clear path toward
          a <strong>Technical Steering Committee (TSC)</strong> structure as the
          community grows.
        </p>

        <AnchorLink id="current-phase" level="h3">
          Current Phase: Founder-Led
        </AnchorLink>
        <ul>
          <li>
            <strong>Project Lead</strong>: Hyo (
            <a href="https://hyo.dev" target="_blank" rel="noopener noreferrer">
              hyo.dev
            </a>
            ) — responsible for overall project direction, releases, and
            community stewardship
          </li>
          <li>
            <strong>Decision-making</strong>: Benevolent dictator model with
            open discussion encouraged on all proposals
          </li>
          <li>
            <strong>Transparency</strong>: All significant decisions are
            documented in GitHub issues/PRs with rationale
          </li>
        </ul>

        <AnchorLink id="target-phase" level="h3">
          Target Phase: TSC Governance
        </AnchorLink>
        <p>
          As the project grows to include multiple organizational contributors,
          governance will transition to:
        </p>
        <ul>
          <li>
            <strong>Technical Steering Committee (TSC)</strong>: 3-7 members
            representing diverse organizations and perspectives
          </li>
          <li>
            <strong>TSC Chair</strong>: Elected by TSC members, rotating
            annually
          </li>
          <li>
            <strong>Advisory Board</strong>: Representatives from sponsoring
            organizations (non-binding input on direction)
          </li>
        </ul>
      </section>

      <section>
        <AnchorLink id="roles" level="h2">
          Roles and Responsibilities
        </AnchorLink>

        <AnchorLink id="project-lead" level="h3">
          Project Lead (Current)
        </AnchorLink>
        <ul>
          <li>Sets project vision and roadmap priorities</li>
          <li>
            Has final authority on technical decisions (until TSC is formed)
          </li>
          <li>Manages releases and deployment processes</li>
          <li>Represents the project in external communications</li>
        </ul>

        <AnchorLink id="maintainers" level="h3">
          Maintainers
        </AnchorLink>
        <p>
          Maintainers have write access to one or more packages in the monorepo.
        </p>

        <h4>Becoming a Maintainer</h4>
        <ol>
          <li>Demonstrate sustained, quality contributions over 3+ months</li>
          <li>
            Show understanding of the project's architecture and conventions
          </li>
          <li>Be nominated by an existing maintainer or the Project Lead</li>
          <li>Receive approval from the Project Lead (or TSC, when formed)</li>
        </ol>

        <h4>Maintainer Responsibilities</h4>
        <ul>
          <li>Review and merge pull requests in their area</li>
          <li>Triage issues and provide guidance to contributors</li>
          <li>Follow the project's coding standards and conventions</li>
          <li>Participate in release planning</li>
        </ul>

        <h4>Removing a Maintainer</h4>
        <ul>
          <li>Voluntary resignation at any time</li>
          <li>Inactivity for 6+ months without communication</li>
          <li>Violation of the Code of Conduct</li>
          <li>Decision by Project Lead (or TSC majority vote, when formed)</li>
        </ul>

        <AnchorLink id="contributors" level="h3">
          Contributors
        </AnchorLink>
        <p>
          Anyone who contributes code, documentation, bug reports, or other
          improvements. No formal approval needed — just submit a pull request
          or open an issue.
        </p>
      </section>

      <section>
        <AnchorLink id="decision-making" level="h2">
          Decision-Making Process
        </AnchorLink>

        <AnchorLink id="routine-decisions" level="h3">
          Routine Decisions
        </AnchorLink>
        <ul>
          <li>
            Bug fixes, documentation improvements, minor refactors: Maintainer
            approval + merge
          </li>
          <li>
            New features within existing scope: PR review by 1+ maintainer,
            72-hour comment period for significant changes
          </li>
        </ul>

        <AnchorLink id="significant-decisions" level="h3">
          Significant Decisions
        </AnchorLink>
        <p>These require broader discussion and explicit approval:</p>
        <ul>
          <li>
            <strong>Specification changes</strong> (GraphQL schema modifications
            affecting generated types)
          </li>
          <li>
            <strong>New platform support</strong> (adding a new language plugin
            or platform implementation)
          </li>
          <li>
            <strong>Breaking changes</strong> to public APIs
          </li>
          <li>
            <strong>Governance changes</strong>
          </li>
          <li>
            <strong>License changes</strong>
          </li>
        </ul>

        <p>Process for significant decisions:</p>
        <ol>
          <li>Open a GitHub Issue or Discussion with the proposal</li>
          <li>Allow minimum 7-day comment period</li>
          <li>
            Project Lead (or TSC) makes final decision, documenting rationale
          </li>
          <li>
            For specification changes: affected platform maintainers must be
            consulted
          </li>
        </ol>

        <AnchorLink id="spec-change-process" level="h3">
          Specification Change Process
        </AnchorLink>
        <p>
          Changes to the core GraphQL schema (the source of truth for all
          platforms) follow a stricter process:
        </p>
        <ol>
          <li>
            <strong>Proposal</strong>: Open an issue describing the change,
            motivation, and impact on all platforms
          </li>
          <li>
            <strong>Impact Assessment</strong>: Document effects on TypeScript,
            Swift, Kotlin, Dart, C#, and GDScript generated types
          </li>
          <li>
            <strong>Review Period</strong>: Minimum 14-day review period for
            platform maintainers
          </li>
          <li>
            <strong>Approval</strong>: Requires Project Lead approval + no
            unresolved objections from platform maintainers
          </li>
          <li>
            <strong>Implementation</strong>: Schema change + regeneration of all
            platform types in a single PR
          </li>
        </ol>
      </section>

      <section>
        <AnchorLink id="release-authority" level="h2">
          Release Authority
        </AnchorLink>
        <ul>
          <li>
            <strong>Patch releases</strong> (bug fixes): Any maintainer for
            their package
          </li>
          <li>
            <strong>Minor releases</strong> (new features): Project Lead
            approval required
          </li>
          <li>
            <strong>Major releases</strong> (breaking changes): Project Lead
            approval + 30-day notice to community
          </li>
          <li>
            <strong>Specification releases</strong>: Follow the Specification
            Change Process above
          </li>
        </ul>

        <h4>Release Artifacts</h4>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Package</th>
              <th>Distribution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Apple</td>
              <td>CocoaPods + Swift Package Manager</td>
            </tr>
            <tr>
              <td>Google</td>
              <td>Maven Central</td>
            </tr>
            <tr>
              <td>Documentation</td>
              <td>
                <a
                  href="https://openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap.dev
                </a>{' '}
                (Vercel)
              </td>
            </tr>
            <tr>
              <td>Versions</td>
              <td>Synchronized by CI/CD (never manual)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="intellectual-property" level="h2">
          Intellectual Property
        </AnchorLink>

        <AnchorLink id="license" level="h3">
          License
        </AnchorLink>
        <p>
          OpenIAP is licensed under the <strong>MIT License</strong>, with one
          exception: <code>kmp-iap</code> is licensed under{' '}
          <strong>Apache-2.0</strong>. All contributions must be compatible with
          the license of the package they touch.
        </p>

        <AnchorLink id="contributions" level="h3">
          Contributions
        </AnchorLink>
        <ul>
          <li>
            All contributors must agree to the project's contribution terms
          </li>
          <li>
            <strong>DCO (Developer Certificate of Origin)</strong>: adoption is
            planned as part of foundation onboarding. Until CI enforcement is
            enabled, contributions are accepted under the project license
            through pull-request review; a <code>Signed-off-by</code> line is
            welcome but not yet required
          </li>
          <li>
            Future consideration: Migration to a CLA (Contributor License
            Agreement) may occur if/when the project joins a foundation
          </li>
        </ul>

        <AnchorLink id="trademarks" level="h3">
          Trademarks and Assets
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Current Owner</th>
              <th>Direction</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>"OpenIAP" name and logo</td>
              <td>
                <a
                  href="https://hyo.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  hyo.dev
                </a>
              </td>
              <td rowSpan={3}>
                Upon foundation hosting, trademarks and critical assets would
                transfer to the foundation for neutral ownership
              </td>
            </tr>
            <tr>
              <td>
                Domain (
                <a
                  href="https://openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap.dev
                </a>
                )
              </td>
              <td>
                <a
                  href="https://hyo.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  hyo.dev
                </a>
              </td>
            </tr>
            <tr>
              <td>GitHub organization</td>
              <td>hyodotdev</td>
            </tr>
          </tbody>
        </table>

        <AnchorLink id="hosted-services" level="h3">
          Hosted Services
        </AnchorLink>
        <p>
          The IAPKit instance at{' '}
          <a
            href="https://kit.openiap.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            kit.openiap.dev
          </a>{' '}
          is a{' '}
          <strong>community service operated under project governance</strong>:
          its source is open (<code>packages/kit</code>, MIT, self-hostable as a
          single binary), its infrastructure costs are funded through the
          project's{' '}
          <a
            href={FUNDING_LINKS.openCollectiveUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            OpenCollective
          </a>{' '}
          with transparent expenses, and its fair-use and capacity policies are
          documented in the package README. It is operated by project
          maintainers on the project's behalf — not as a separate commercial
          offering — and would transfer with the other project assets upon
          foundation hosting.
        </p>
      </section>

      <section>
        <AnchorLink id="code-of-conduct" level="h2">
          Code of Conduct
        </AnchorLink>
        <p>
          All participants in the OpenIAP project are expected to follow the
          project's Code of Conduct. Violations should be reported to{' '}
          <a href="mailto:conduct@hyo.dev">conduct@hyo.dev</a> (or the
          designated conduct committee, when formed).
        </p>
      </section>

      <section>
        <AnchorLink id="amendments" level="h2">
          Amendments
        </AnchorLink>
        <p>
          This governance document may be amended through the Significant
          Decisions process described above. Changes require a minimum 14-day
          review period and explicit approval from the Project Lead (or TSC
          majority, when formed).
        </p>
        <p
          style={{
            marginTop: '2rem',
            fontStyle: 'italic',
            color: 'var(--text-secondary)',
          }}
        >
          This governance model is designed to evolve. As OpenIAP grows, we are
          committed to transitioning toward broader community governance while
          maintaining the project's technical integrity and mission.
        </p>
      </section>
    </div>
  );
}

export default Governance;
