import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../../../components/SEO';
import AnchorLink from '../../../components/AnchorLink';
import Callout from '../../../components/Callout';
import DataTable from '../../../components/DataTable';
import { useScrollToHash } from '../../../hooks/useScrollToHash';

type Status = 'Done' | 'In progress' | 'Not started';

interface Deliverable {
  name: string;
  description: ReactNode;
  status: Status;
  /** Where the shipped part lives, or what is still missing. */
  note?: ReactNode;
}

interface Phase {
  id: string;
  title: string;
  deliverables: Deliverable[];
}

const ROADMAP: Phase[] = [
  {
    id: 'phase-1',
    title: 'Phase 1: Foundation (Q2–Q3 2026)',
    deliverables: [
      {
        name: 'Open governance model',
        description:
          'Published governance document with maintainer policies and decision-making process',
        status: 'Done',
        note: (
          <>
            <Link to="/docs/foundation/governance">Governance</Link>, still
            marked draft
          </>
        ),
      },
      {
        name: 'Specification documentation',
        description: 'Normative documentation for both protocols',
        status: 'In progress',
        note: 'Commerce Protocol done; the Client Protocol has its schema and API reference but no normative prose yet',
      },
      {
        name: 'Purchase verification profile',
        description: 'Standardized server-side verification across stores',
        status: 'Done',
        note: (
          <>
            The Commerce Protocol{' '}
            <Link to="/commerce-protocol/profiles">verification profile</Link>
          </>
        ),
      },
      {
        name: 'Conformance test suite',
        description:
          'Shared behavioral expectations executed against every store implementation and verification provider, backed by a machine-checked capability matrix',
        status: 'In progress',
        note: 'Expo, React Native, Android, Apple and IAPKit cover documented subsets; Flutter, KMP, MAUI and Godot adapters are next',
      },
      {
        name: 'Founding supporter outreach',
        description: 'Engage 3–5 organizations as initial supporters',
        status: 'In progress',
      },
    ],
  },
  {
    id: 'phase-2',
    title: 'Phase 2: Ecosystem Growth (Q4 2026–Q1 2027)',
    deliverables: [
      {
        name: 'Security guidance document',
        description:
          'Transaction integrity best practices, fraud prevention patterns, audit-friendly purchase schema',
        status: 'In progress',
        note: (
          <>
            Receipt <Link to="/docs/features/validation">validation</Link>{' '}
            guidance exists; integrity and fraud guidance does not
          </>
        ),
      },
      {
        name: 'Expanded platform support',
        description:
          'Unity and Unreal Engine codegen plugins via the IR architecture',
        status: 'Not started',
      },
      {
        name: 'Secure provider interoperability spec',
        description:
          'Standardized handoff protocol between stores, apps, and verification services',
        status: 'Done',
        note: <Link to="/commerce-protocol">Commerce Protocol</Link>,
      },
      {
        name: 'Formal spec versioning',
        description:
          'Semantic versioning for the specification with migration guides per platform',
        status: 'Done',
        note: (
          <>
            Both protocols are versioned; see{' '}
            <Link to="/docs/updates/versions">Versions</Link>
          </>
        ),
      },
      {
        name: 'Open funding channel',
        description:
          'Transparent funding channel for individual and corporate donors',
        status: 'Done',
        note: <Link to="/sponsors">Sponsors</Link>,
      },
    ],
  },
  {
    id: 'phase-3',
    title: 'Phase 3: Industry Standard (Q2–Q4 2027)',
    deliverables: [
      {
        name: 'Conformance certification',
        description:
          'Formal certification process for libraries claiming OpenIAP compatibility',
        status: 'Not started',
      },
      {
        name: 'Third-party auditor guidelines',
        description: 'Guidance for auditors reviewing verification providers',
        status: 'Not started',
        note: 'The provider integration spec itself shipped as the Commerce Protocol',
      },
      {
        name: 'Alternative store support',
        description: 'EU DMA compliance, alternative app store billing APIs',
        status: 'In progress',
        note: 'Amazon Appstore, Meta Horizon, Onside and external purchase links are supported; HarmonyOS, Galaxy Store and AppGallery are not',
      },
      {
        name: 'Foundation hosting exploration',
        description:
          'Evaluate foundation hosting options for long-term neutral governance',
        status: 'Not started',
      },
      {
        name: 'Mentorship program',
        description:
          'Structured onboarding themes for new contributors (bindings, tests, docs)',
        status: 'Not started',
      },
    ],
  },
];

function RoadmapBudget() {
  useScrollToHash();

  return (
    <div className="doc-page">
      <SEO
        title="Roadmap & Budget"
        description="OpenIAP project roadmap and funding allocation plan — how sponsorship funds are used to build the open purchase interoperability standard."
        path="/docs/foundation/roadmap-budget"
        keywords="OpenIAP roadmap, funding plan, open source budget, IAP development roadmap"
      />
      <h1>Roadmap & Budget</h1>
      <Callout kind="note" title="Draft">
        The Foundation section is currently being prepared. Content may change
        as the governance structure is finalized.
      </Callout>
      <p>
        How OpenIAP plans to grow, what has shipped, and how sponsorship funding
        is planned to be spent.
      </p>

      <section>
        <AnchorLink id="roadmap" level="h2">
          Development Roadmap
        </AnchorLink>

        {ROADMAP.map((phase) => (
          <div key={phase.id}>
            <AnchorLink id={phase.id} level="h3">
              {phase.title}
            </AnchorLink>
            <DataTable
              rows={phase.deliverables}
              rowKey={(row) => row.name}
              columns={[
                { header: 'Deliverable', cell: (row) => row.name },
                { header: 'Description', cell: (row) => row.description },
                {
                  header: 'Status',
                  cell: (row) => (
                    <>
                      <strong>{row.status}</strong>
                      {row.note ? <> — {row.note}</> : null}
                    </>
                  ),
                },
              ]}
            />
          </div>
        ))}
      </section>

      <section>
        <AnchorLink id="budget" level="h2">
          Budget Allocation
        </AnchorLink>
        <p>The planned split of sponsorship funds:</p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Allocation</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Maintainer Compensation</strong>
              </td>
              <td>40%</td>
              <td>
                Core maintainer time for spec development, code review,
                releases, and community management
              </td>
            </tr>
            <tr>
              <td>
                <strong>Infrastructure</strong>
              </td>
              <td>15%</td>
              <td>
                CI/CD compute (GitHub Actions), hosting (Vercel), the IAPKit
                community instance (Convex), domain registration, code signing
                certificates
              </td>
            </tr>
            <tr>
              <td>
                <strong>Security & Testing</strong>
              </td>
              <td>20%</td>
              <td>
                Conformance test infrastructure, security audits, verification
                profile development
              </td>
            </tr>
            <tr>
              <td>
                <strong>Documentation</strong>
              </td>
              <td>10%</td>
              <td>
                API documentation, migration guides, tutorials, AI context
                compilation
              </td>
            </tr>
            <tr>
              <td>
                <strong>Community & Outreach</strong>
              </td>
              <td>10%</td>
              <td>
                Contributor onboarding, mentorship programs, conference
                participation
              </td>
            </tr>
            <tr>
              <td>
                <strong>Reserve</strong>
              </td>
              <td>5%</td>
              <td>Emergency platform API changes, legal/compliance needs</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="current-costs" level="h2">
          Current Operational Costs
        </AnchorLink>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Monthly Cost</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vercel hosting (docs site)</td>
              <td>$20</td>
              <td>
                <a
                  href="https://openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap.dev
                </a>
              </td>
            </tr>
            <tr>
              <td>IAPKit community instance (Convex)</td>
              <td>~$20</td>
              <td>
                <a
                  href="https://kit.openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  kit.openiap.dev
                </a>{' '}
                receipt validation
              </td>
            </tr>
            <tr>
              <td>Domain registration</td>
              <td>~$3</td>
              <td>
                <a
                  href="https://openiap.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  openiap.dev
                </a>{' '}
                annual amortized
              </td>
            </tr>
            <tr>
              <td>GitHub Actions CI/CD</td>
              <td>$0–50</td>
              <td>Variable based on PR volume</td>
            </tr>
            <tr>
              <td>Apple Developer account</td>
              <td>~$8</td>
              <td>$99/year amortized for testing</td>
            </tr>
            <tr>
              <td>Google Play Console</td>
              <td>~$2</td>
              <td>$25 one-time amortized</td>
            </tr>
            <tr>
              <td>Claude Code (AI assistant)</td>
              <td>$200</td>
              <td>Anthropic Max plan for development</td>
            </tr>
            <tr>
              <td>Codex (AI assistant)</td>
              <td>$100</td>
              <td>OpenAI for code review and testing</td>
            </tr>
            <tr>
              <td>
                <strong>Total baseline</strong>
              </td>
              <td>
                <strong>$350–400/month</strong>
              </td>
              <td>Excluding maintainer time</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="funding-milestones" level="h2">
          Funding Milestones
        </AnchorLink>
        <p>What becomes possible at each funding level:</p>

        <table className="doc-table">
          <thead>
            <tr>
              <th>Monthly Funding</th>
              <th>Unlocks</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>$500/mo</strong>
              </td>
              <td>
                Covers infrastructure costs + basic maintainer compensation for
                security updates
              </td>
            </tr>
            <tr>
              <td>
                <strong>$2,000/mo</strong>
              </td>
              <td>
                Part-time maintainer focus on spec development and conformance
                tests
              </td>
            </tr>
            <tr>
              <td>
                <strong>$5,000/mo</strong>
              </td>
              <td>
                Dedicated maintainer time + security audit + new platform
                bindings
              </td>
            </tr>
            <tr>
              <td>
                <strong>$10,000/mo</strong>
              </td>
              <td>
                Full-time spec development, mentorship program, conference
                presence, foundation hosting
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <AnchorLink id="transparency" level="h2">
          Transparency
        </AnchorLink>
        <p>
          OpenIAP is committed to financial transparency. As funding grows, we
          will:
        </p>
        <ul>
          <li>Publish quarterly financial reports on this page</li>
          <li>
            Disclose all sponsors and sponsorship amounts (with sponsor
            permission)
          </li>
          <li>Track spending against the budget allocation above</li>
          <li>Open the books to Advisory Board members</li>
        </ul>
      </section>
    </div>
  );
}

export default RoadmapBudget;
