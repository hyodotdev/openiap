import { Link } from 'react-router-dom';
import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

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
      <p>How decisions are made in OpenIAP, and who makes them.</p>

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
        <p>
          The project lead merges a change once CI, the repository audits and
          automated review pass.
        </p>

        <AnchorLink id="significant-decisions" level="h3">
          Significant Decisions
        </AnchorLink>
        <p>These require broader discussion and explicit approval:</p>
        <ul>
          <li>
            <strong>Specification changes</strong> to either protocol: the
            Client Protocol GraphQL schema, or the Commerce Protocol, which
            follows its own{' '}
            <a
              href="https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/CONVENTION.md#changing-the-contract"
              target="_blank"
              rel="noopener noreferrer"
            >
              change rules
            </a>
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

        <p>
          Today the project lead decides and records the rationale in the pull
          request. Once the TSC forms, a significant decision starts as a GitHub
          issue or discussion with at least a 7-day comment period, and affected
          platform maintainers are consulted on specification changes.
        </p>

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
            <strong>Review Period</strong>: none required today; 14 days for
            platform maintainers once the TSC forms
          </li>
          <li>
            <strong>Approval</strong>: Project Lead approval, and no unresolved
            objections from platform maintainers once the TSC forms
          </li>
          <li>
            <strong>Implementation</strong>: Schema change + regeneration of all
            platform types in a single PR
          </li>
        </ol>
      </section>

      <section>
        <AnchorLink id="commerce-protocol" level="h2">
          Commerce Protocol participation
        </AnchorLink>
        <p>
          Providers, app developers, and event consumers can propose changes or
          contribute interoperability reports. The{' '}
          <a href="https://github.com/hyodotdev/openiap/blob/main/specs/commerce-protocol/CONVENTION.md#public-collaboration-and-implementation-evidence">
            protocol contribution procedure
          </a>{' '}
          defines the required use case, executable evidence, compatibility
          assessment, and public decision record. IAPKit receives no exemption
          from the shared contract or its checks.
        </p>
        <p>
          Decisions remain with the current project lead under the review
          process above. Reports identify their authors and actual reviewers; a
          project-authored fixture does not count as independent company
          validation. The{' '}
          <Link to="/commerce-protocol/ecosystem#composition-proof">
            runnable composition example
          </Link>{' '}
          provides a starting point for another implementer to reproduce and
          challenge the expected results.
        </p>
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
            approval, announced on{' '}
            <Link to="/docs/updates/announcements">Announcements</Link> before
            the release
          </li>
          <li>
            <strong>Specification releases</strong>: Follow the Specification
            Change Process above
          </li>
        </ul>

        <p>
          Versions are set by CI, never by hand. Every package and where it is
          published is listed on{' '}
          <Link to="/docs/updates/versions">Versions</Link>.
        </p>
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
          Hyo Dev operates the IAPKit instance at{' '}
          <a
            href="https://kit.openiap.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            kit.openiap.dev
          </a>{' '}
          under its{' '}
          <a
            href="https://kit.openiap.dev/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
          >
            terms of service
          </a>
          . It is free within its{' '}
          <a
            href="https://github.com/hyodotdev/openiap/blob/main/packages/kit/README.md#hosted-fair-use-and-capacity-planning"
            target="_blank"
            rel="noopener noreferrer"
          >
            fair-use limits
          </a>
          , and its running costs are meant to be covered by sponsorship; the
          plan is to share those costs openly as usage grows. Organizations
          whose usage goes well beyond fair use may be asked to sponsor, or can
          self-host it instead: the source is open (<code>packages/kit</code>,
          MIT).
        </p>
      </section>

      <section>
        <AnchorLink id="code-of-conduct" level="h2">
          Code of Conduct
        </AnchorLink>
        <p>
          All participants in the OpenIAP project are expected to follow the
          project&apos;s{' '}
          <a
            href="https://github.com/hyodotdev/openiap/blob/main/CODE_OF_CONDUCT.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Code of Conduct
          </a>
          . Violations should be reported to{' '}
          <a href="mailto:conduct@hyo.dev">conduct@hyo.dev</a> (or the
          designated conduct committee, when formed).
        </p>
      </section>

      <section>
        <AnchorLink id="amendments" level="h2">
          Amendments
        </AnchorLink>
        <p>
          This page changes through a reviewed pull request the Project Lead
          approves. Once the TSC forms, an amendment gets a 14-day review period
          and needs a TSC majority.
        </p>
      </section>
    </div>
  );
}

export default Governance;
